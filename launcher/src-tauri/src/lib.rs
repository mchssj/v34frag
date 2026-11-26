//! Launcher de escritorio: la web de CMLeague en una ventana propia (como el cliente de FACEIT), más lo que el
//! navegador no puede hacer: abrir ClientMod conectado a la sala, avisos de Windows, la bandeja con el estado,
//! Discord, actualizaciones y una Configuración propia que no toca la web.
//! La web llama a sus comandos solo desde https://cmleague.lat (capabilities/web.json).

mod game;
mod settings;
mod status;
mod updater;

use tauri::tray::TrayIconBuilder;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use status::Shared;

/// La web que abre la ventana.
const WEB_ORIGIN: &str = "https://cmleague.lat";
const WEB_URL: &str = "https://cmleague.lat/play";

/// `cmleague://play` o `cmleague://match/<id>`: abre esa página de la web en el launcher (links de la web o de
/// Discord). Solo rutas de la web: letras, números, `/`, `-` y `_`; la consulta y el fragmento se ignoran.
fn link_path(url: &tauri::Url) -> Option<String> {
    if url.scheme() != "cmleague" {
        return None;
    }
    let path = format!("/{}{}", url.host_str().unwrap_or(""), url.path());
    let path = path.trim_end_matches('/');
    let ok = path.len() <= 200 && path.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'/' | b'-' | b'_'));
    ok.then(|| if path.is_empty() { "/play".to_string() } else { path.to_string() })
}

/// Si la ventana puede navegar a esa URL: solo la web de CMLeague (y las páginas internas). Lo demás (demos, Discord,
/// Steam, YouTube…) se abre en el navegador: así las demos se descargan como siempre y la ventana no sale de la web.
fn stays_in_app(url: &tauri::Url) -> bool {
    match url.scheme() {
        "https" => matches!(url.host_str(), Some("cmleague.lat" | "www.cmleague.lat")),
        "about" | "blob" | "data" | "tauri" => true,
        "http" => matches!(url.host_str(), Some("tauri.localhost" | "ipc.localhost")),
        _ => false,
    }
}

/// Solo direcciones web y correo. Nada de `file:` ni de protocolos de programas (`steam://`, `discord://`…): el
/// navegador pregunta antes de abrir un programa y la app no, y un link así en una bio o un comentario (por ejemplo
/// `steam://run/...` con argumentos) se abriría con un clic. Los "Conectar" no pasan por acá: abren ClientMod.
fn can_open_outside(url: &tauri::Url) -> bool {
    matches!(url.scheme(), "https" | "http" | "mailto")
}

fn open_outside(app: &tauri::AppHandle, url: &tauri::Url) {
    use tauri_plugin_opener::OpenerExt;
    if can_open_outside(url) {
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
}

fn open_link(app: &tauri::AppHandle, url: &tauri::Url) {
    let Some(path) = link_path(url) else { return };
    if let (Some(w), Ok(target)) = (app.get_webview_window("main"), format!("{WEB_ORIGIN}{path}").parse()) {
        let _ = w.navigate(target);
    }
    status::show_main(app);
}

/// Fondo oscuro de la web (`--background` de .dark, oklch(0.145 0 0)), para que no haya un destello blanco al abrir.
const BACKGROUND: (u8, u8, u8) = (0x0a, 0x0a, 0x0a);

/// Scroll fino y del color del texto con poca opacidad, como `scrollbar-thin` de la web. Se agrega en cada carga de
/// cmleague.lat, así no depende de desplegar la web.
const SCROLL_STYLE: &str = r#"
(() => {
  if (!/(^|\.)cmleague\.lat$/.test(location.hostname)) return;
  const css = `
    * { scrollbar-width: thin; scrollbar-color: color-mix(in oklch, var(--foreground, #fafafa) 22%, transparent) transparent; }
    html { scrollbar-gutter: stable; }
  `;
  const add = () => {
    const s = document.createElement("style");
    s.dataset.cmleagueLauncher = "";
    s.textContent = css;
    document.head.appendChild(s);
  };
  if (document.head) add(); else document.addEventListener("DOMContentLoaded", add, { once: true });
})();
"#;

/// Barra de título nativa (Windows 11; en Windows 10 queda la de siempre): fondo, texto y borde en 0xRRGGBB.
#[cfg(windows)]
fn style_title_bar(w: &tauri::WebviewWindow, caption: u32, border: u32) {
    use windows_sys::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_CAPTION_COLOR, DWMWA_TEXT_COLOR, DWMWA_USE_IMMERSIVE_DARK_MODE,
    };
    let Ok(hwnd) = w.hwnd() else { return };
    let hwnd = hwnd.0 as _;
    // COLORREF es 0x00BBGGRR.
    let bgr = |rgb: u32| ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 0xff);
    let set = |attr: i32, value: u32| unsafe {
        DwmSetWindowAttribute(hwnd, attr as u32, &value as *const u32 as _, 4);
    };
    set(DWMWA_USE_IMMERSIVE_DARK_MODE, 1);
    set(DWMWA_CAPTION_COLOR, bgr(caption));
    set(DWMWA_TEXT_COLOR, bgr(0xfafafa));
    set(DWMWA_BORDER_COLOR, bgr(border));
}

#[cfg(not(windows))]
fn style_title_bar(_w: &tauri::WebviewWindow, _caption: u32, _border: u32) {}

const CAPTION: u32 = ((BACKGROUND.0 as u32) << 16) | ((BACKGROUND.1 as u32) << 8) | BACKGROUND.2 as u32;
const BORDER: u32 = 0x262626;

/// "#rrggbb" a 0xRRGGBB.
fn parse_hex(s: &str) -> Option<u32> {
    let h = s.trim().strip_prefix('#')?;
    (h.len() == 6).then(|| u32::from_str_radix(h, 16).ok()).flatten()
}

/// La web pinta la barra de título con el tema de la tienda (o la devuelve a los colores de fábrica con null).
#[tauri::command]
fn window_theme(app: tauri::AppHandle, caption: Option<String>, border: Option<String>) {
    if let Some(w) = app.get_webview_window("main") {
        let c = caption.as_deref().and_then(parse_hex).unwrap_or(CAPTION);
        let b = border.as_deref().and_then(parse_hex).unwrap_or(BORDER);
        style_title_bar(&w, c, b);
    }
}

/// Abre la ventana de Configuración (página local `ajustes.html`, sin la web).
fn open_settings(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    if let Ok(w) = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("ajustes.html".into()))
        .title("Configuración de CMLeague")
        .inner_size(560.0, 860.0)
        .min_inner_size(480.0, 500.0)
        .theme(Some(tauri::Theme::Dark))
        .background_color(tauri::window::Color(BACKGROUND.0, BACKGROUND.1, BACKGROUND.2, 255))
        .build()
    {
        style_title_bar(&w, CAPTION, BORDER);
    }
}

/// Abre Configuración fuera del evento o comando que lo pidió. En Windows, crear una ventana de WebView2 adentro de un
/// evento de la bandeja o de un comando sincrónico puede dejarla sin IPC: se ve, pero sus pedidos al launcher no
/// reciben respuesta (no guardaba la configuración ni abría el selector, 2026-11-26).
fn open_settings_later(app: &tauri::AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move { open_settings(&app) });
}

#[tauri::command]
async fn settings_open(app: tauri::AppHandle) {
    open_settings_later(&app);
}

/// Argumento con el que Windows lo abre al iniciar (ver la opción "Abrir con Windows").
const AUTOSTART_ARG: &str = "--al-iniciar";

/// Abre Configuración directo (acceso directo, o con el launcher ya abierto).
const SETTINGS_ARG: &str = "--ajustes";

/// Si el launcher se cierra por un error, lo deja en %LOCALAPPDATA%\lat.cmleague.launcher\error.log (sin consola en
/// release, si no, no se vería nada).
fn log_panics() {
    let default = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        if let Some(dir) = std::env::var_os("LOCALAPPDATA").map(|d| std::path::PathBuf::from(d).join("lat.cmleague.launcher")) {
            let _ = std::fs::create_dir_all(&dir);
            let _ = std::fs::write(dir.join("error.log"), format!("{info}\n"));
        }
        default(info);
    }));
}

pub fn run() {
    log_panics();
    let mut builder = tauri::Builder::default();
    // Actualizaciones solo con la clave pública puesta al compilar (src/updater.rs).
    if updater::enabled() {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }
    builder
        // Abrirlo de nuevo no crea otro: trae la ventana que ya está.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if args.iter().any(|a| a == SETTINGS_ARG) {
                open_settings_later(app);
            } else {
                status::show_main(app);
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::Builder::new().args([AUTOSTART_ARG]).build())
        .manage(Shared::default())
        .setup(|app| {
            let prefs = settings::load(app.handle());
            let at_boot = std::env::args().any(|a| a == AUTOSTART_ARG);
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(WEB_URL.parse().expect("URL")))
                .title("CMLeague")
                .inner_size(1280.0, 800.0)
                .min_inner_size(900.0, 600.0)
                .theme(Some(tauri::Theme::Dark))
                .background_color(tauri::window::Color(BACKGROUND.0, BACKGROUND.1, BACKGROUND.2, 255))
                .initialization_script(SCROLL_STYLE)
                .on_navigation({
                    let app = app.handle().clone();
                    move |url| {
                        if stays_in_app(url) {
                            return true;
                        }
                        open_outside(&app, url);
                        false
                    }
                })
                // Links con target="_blank" (o window.open): al navegador.
                .on_new_window({
                    let app = app.handle().clone();
                    move |url, _| {
                        if stays_in_app(&url) && url.host_str().is_some_and(|h| h.ends_with("cmleague.lat")) {
                            // Una página de la web en otra pestaña: se abre en la misma ventana.
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.navigate(url);
                            }
                        } else {
                            open_outside(&app, &url);
                        }
                        tauri::webview::NewWindowResponse::Deny
                    }
                })
                // Descargas de la propia web (por ejemplo, exportar un recap): a Descargas, con aviso al terminar.
                .on_download({
                    let app = app.handle().clone();
                    move |_, event| {
                        match event {
                            tauri::webview::DownloadEvent::Requested { url, destination } => {
                                if let Ok(dir) = app.path().download_dir() {
                                    let name = destination
                                        .file_name()
                                        .map(|n| n.to_os_string())
                                        .or_else(|| url.path_segments().and_then(|mut s| s.next_back()).map(Into::into))
                                        .unwrap_or_else(|| "descarga".into());
                                    *destination = dir.join(name);
                                }
                            }
                            tauri::webview::DownloadEvent::Finished { path, success, .. } => {
                                if success {
                                    let name = path
                                        .as_ref()
                                        .and_then(|p| p.file_name())
                                        .map(|n| n.to_string_lossy().into_owned())
                                        .unwrap_or_default();
                                    status::notify(&app, "Descarga lista", &format!("{name} está en tu carpeta Descargas."));
                                } else {
                                    status::notify(&app, "No se pudo descargar", "Prueba de nuevo desde el navegador.");
                                }
                            }
                            _ => {}
                        }
                        true
                    }
                })
                .visible(!(at_boot && prefs.start_minimized))
                .build()?;
            if let Some(icon) = app.default_window_icon() {
                let _ = window.set_icon(icon.clone());
            }
            style_title_bar(&window, CAPTION, BORDER);

            let handle = app.handle();
            let menu = status::tray_menu(handle, &status::Status::default(), None, None)?;
            let mut tray = TrayIconBuilder::with_id(status::TRAY_ID)
                .menu(&menu)
                .tooltip("CMLeague")
                .on_menu_event(|app, e| match e.id.as_ref() {
                    "show" => status::show_main(app),
                    "accept" => status::accept_from_tray(app),
                    "settings" => open_settings_later(app),
                    "update" => {
                        let app = app.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(e) = updater::update_install(app.clone()).await {
                                status::notify(&app, "No se pudo actualizar", &e);
                            }
                        });
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, e| {
                    if let tauri::tray::TrayIconEvent::DoubleClick { .. } = e {
                        status::show_main(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            if std::env::args().any(|a| a == SETTINGS_ARG) {
                open_settings_later(handle);
            }
            // Prueba de GitHub Actions: con CMLEAGUE_AUTOPRUEBA=1, la ventana de Configuración guarda un cambio por la
            // misma vía que un clic (IPC y permisos), y el workflow revisa ajustes.json. Solo en el build de prueba
            // (`--features autoprueba`): el instalador que se reparte no la trae.
            #[cfg(feature = "autoprueba")]
            if std::env::var("CMLEAGUE_AUTOPRUEBA").as_deref() == Ok("1") {
                // Por el mismo camino que la bandeja.
                open_settings_later(handle);
                let h = handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(6));
                    if let Some(w) = h.get_webview_window("settings") {
                        let _ = w.eval(
                            // Clics en los interruptores de la página: prueba su código, no uno propio.
                            "document.querySelector('input[data-key=notifications]').click();setTimeout(()=>document.querySelector('input[data-key=discord_presence]').click(),1500)",
                        );
                    }
                    // Lo que muestra la página después de los clics, para el registro del workflow.
                    std::thread::sleep(std::time::Duration::from_secs(5));
                    if let Some(w) = h.get_webview_window("settings") {
                        let out = std::env::var_os("LOCALAPPDATA")
                            .map(|d| std::path::PathBuf::from(d).join("lat.cmleague.launcher").join("autoprueba.txt"));
                        let _ = w.eval_with_callback(
                            "JSON.stringify({url:location.href,ipc:typeof window.__TAURI_INTERNALS__,msg:document.getElementById('msg')?.textContent,dir:document.getElementById('dir-msg')?.textContent,disabled:document.querySelector('input[data-key=notifications]')?.disabled,checked:document.querySelector('input[data-key=notifications]')?.checked})",
                            move |r| {
                                if let Some(f) = &out {
                                    let _ = std::fs::create_dir_all(f.parent().unwrap());
                                    let _ = std::fs::write(f, r);
                                }
                            },
                        );
                    }
                });
            }
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let dl = app.deep_link();
                // Abierto por un link: va a esa página. Con el launcher ya abierto, el link llega por on_open_url.
                if let Ok(Some(urls)) = dl.get_current() {
                    if let Some(u) = urls.first() {
                        open_link(handle, u);
                    }
                }
                let h = handle.clone();
                dl.on_open_url(move |e| {
                    if let Some(u) = e.urls().first() {
                        open_link(&h, u);
                    }
                });
                // En desarrollo el instalador no registró el protocolo: se registra al abrir.
                #[cfg(debug_assertions)]
                let _ = dl.register_all();
            }
            status::start_discord(handle);
            status::start_game_watch(handle);
            // Primer estado para Discord ("En el launcher"), sin esperar a la web.
            status::refresh(handle);
            updater::start(handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            // La X de la ventana principal la manda a la bandeja (si el jugador no lo cambió): sigue en la cola y avisa.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" && settings::load(window.app_handle()).close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                } else if window.label() == "main" {
                    window.app_handle().exit(0);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            game::game_detect,
            game::game_pick_dir,
            game::game_launch,
            status::window_attention,
            status::launcher_status,
            settings::settings_get,
            settings::settings_set,
            settings::launcher_prefs,
            settings::launcher_set_theme,
            updater::update_check,
            updater::update_install,
            updater::app_version,
            window_theme,
            settings_open,
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar el launcher");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn links() {
        let p = |s: &str| link_path(&s.parse().unwrap());
        assert_eq!(p("cmleague://play"), Some("/play".into()));
        assert_eq!(p("cmleague://play/"), Some("/play".into()));
        assert_eq!(p("cmleague://match/0f8d-12?x=1#y"), Some("/match/0f8d-12".into()));
        assert_eq!(p("https://otro.com/play"), None);
        assert_eq!(p("cmleague://play/a.b"), None);
        // El lector de URL resuelve ".." (también escrito %2e%2e) dentro de la ruta: nunca sale de la web.
        assert_eq!(p("cmleague://play/%2e%2e"), Some("/play".into()));
    }

    #[test]
    fn navegacion() {
        let ok = |s: &str| stays_in_app(&s.parse().unwrap());
        assert!(ok("https://cmleague.lat/play"));
        assert!(ok("https://www.cmleague.lat/match/1"));
        // Las demos y los sitios de afuera van al navegador.
        assert!(!ok("https://demos.cmleague.example/partida.dem"));
        assert!(!ok("https://discord.gg/abc"));
        assert!(!ok("https://cmleague.lat.otro.com/"));
        assert!(!ok("http://cmleague.lat/"));
        assert!(!ok("file:///C:/Windows"));
    }

    #[test]
    fn afuera_solo_web() {
        let out = |s: &str| can_open_outside(&s.parse().unwrap());
        assert!(out("https://discord.gg/abc"));
        assert!(out("mailto:hola@cmleague.lat"));
        assert!(!out("steam://run/240//-novid"));
        assert!(!out("discord://-/channels/1"));
        assert!(!out("file:///C:/Windows/System32/calc.exe"));
        assert!(!out("ms-settings:privacy"));
    }
}
