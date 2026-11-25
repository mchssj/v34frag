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
const WEB_URL: &str = "https://cmleague.lat/play";

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
        .inner_size(560.0, 720.0)
        .resizable(false)
        .theme(Some(tauri::Theme::Dark))
        .background_color(tauri::window::Color(BACKGROUND.0, BACKGROUND.1, BACKGROUND.2, 255))
        .build()
    {
        style_title_bar(&w, CAPTION, BORDER);
    }
}

#[tauri::command]
fn settings_open(app: tauri::AppHandle) {
    open_settings(&app);
}

/// Argumento con el que Windows lo abre al iniciar (ver la opción "Abrir con Windows").
const AUTOSTART_ARG: &str = "--al-iniciar";

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
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| status::show_main(app)))
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
                    "settings" => open_settings(app),
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

            status::start_discord(handle);
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
            game::game_set_dir,
            game::game_launch,
            status::window_attention,
            status::launcher_status,
            settings::settings_get,
            settings::settings_set,
            settings::launcher_prefs,
            updater::update_check,
            updater::update_install,
            updater::app_version,
            window_theme,
            settings_open,
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar el launcher");
}
