//! Lo que pasa en el matchmaking, contado por la web (`launcher_status`): el ícono de la bandeja (estado y "Aceptar
//! partida"), los avisos de Windows y Discord Rich Presence.

use std::sync::mpsc::{channel, Sender};
use std::sync::Mutex;

use serde::Deserialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::{Manager, UserAttentionType};
use tauri_plugin_notification::NotificationExt;

use crate::settings;

pub const TRAY_ID: &str = "main";

/// Estado del matchmaking que manda la web. `state`: idle, queue, found, lobby (veto, servidor, entrando) o live.
#[derive(Deserialize, Clone, Default, PartialEq, Debug)]
pub struct Status {
    pub state: String,
    pub mode: Option<String>,
    pub map: Option<String>,
    /// Desde cuándo (Unix en milisegundos): entrada a la cola o inicio de la partida.
    pub since: Option<i64>,
    /// "9-7" en vivo.
    pub score: Option<String>,
}

/// Datos que la app comparte entre comandos.
#[derive(Default)]
pub struct Shared {
    pub status: Mutex<Status>,
    /// Versión de la actualización descargable, si hay.
    pub update: Mutex<Option<String>>,
    discord: Mutex<Option<Sender<Option<Presence>>>>,
}

/// Texto del estado para la bandeja y Discord: (detalle, estado).
fn describe(s: &Status) -> Option<(String, String)> {
    let mode = s.mode.clone().unwrap_or_default();
    let map = s.map.clone().unwrap_or_default();
    let join = |a: &str, b: &str| [a, b].iter().filter(|x| !x.is_empty()).copied().collect::<Vec<_>>().join(" · ");
    match s.state.as_str() {
        "queue" => Some(("Buscando partida".into(), mode)),
        "found" => Some(("¡Partida encontrada!".into(), mode)),
        "lobby" => Some(("Preparando la partida".into(), join(&mode, &map))),
        "live" => Some((
            if mode.is_empty() { "Jugando".into() } else { format!("Jugando {mode}") },
            join(&map, s.score.as_deref().unwrap_or("")),
        )),
        _ => None,
    }
}

#[tauri::command]
pub fn launcher_status(app: tauri::AppHandle, status: Status) {
    let shared = app.state::<Shared>();
    {
        let mut cur = shared.status.lock().unwrap();
        if *cur == status {
            return;
        }
        *cur = status;
    }
    refresh(&app);
}

/// Vuelve a dibujar la bandeja y a mandar el estado a Discord (también al cambiar la configuración).
pub fn refresh(app: &tauri::AppHandle) {
    let shared = app.state::<Shared>();
    let status = shared.status.lock().unwrap().clone();
    let update = shared.update.lock().unwrap().clone();
    let text = describe(&status);

    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let tip = match &text {
            Some((d, s)) if !s.is_empty() => format!("CMLeague · {d} · {s}"),
            Some((d, _)) => format!("CMLeague · {d}"),
            None => "CMLeague".into(),
        };
        let _ = tray.set_tooltip(Some(tip));
        if let Ok(menu) = tray_menu(app, &status, text.as_ref().map(|t| t.0.as_str()), update.as_deref()) {
            let _ = tray.set_menu(Some(menu));
        }
    }

    let presence = if settings::load(app).discord_presence {
        text.map(|(details, state)| Presence { details, state, start: status.since })
    } else {
        None
    };
    let tx = shared.discord.lock().unwrap().clone();
    if let Some(tx) = tx {
        let _ = tx.send(presence);
    }
}

pub fn tray_menu(
    app: &tauri::AppHandle,
    status: &Status,
    label: Option<&str>,
    update: Option<&str>,
) -> tauri::Result<Menu<tauri::Wry>> {
    let state = MenuItem::with_id(app, "state", label.unwrap_or("Sin buscar partida"), false, None::<&str>)?;
    let accept = MenuItem::with_id(app, "accept", "Aceptar partida", status.state == "found", None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let show = MenuItem::with_id(app, "show", "Abrir CMLeague", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Configuración", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&state, &accept, &sep, &show, &settings])?;
    if let Some(v) = update {
        let item = MenuItem::with_id(app, "update", format!("Instalar la actualización {v}"), true, None::<&str>)?;
        menu.append(&item)?;
    }
    menu.append(&sep2)?;
    menu.append(&quit)?;
    Ok(menu)
}

/// "Aceptar partida" desde la bandeja: la acepta la web, con la sesión que ya tiene.
pub fn accept_from_tray(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.eval("window.__cmleagueLauncher && window.__cmleagueLauncher.accept && window.__cmleagueLauncher.accept()");
    }
}

pub fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Aviso de Windows, si el jugador los tiene activados.
pub fn notify(app: &tauri::AppHandle, title: &str, body: &str) {
    if settings::load(app).notifications {
        let _ = app.notification().builder().title(title).body(body).show();
    }
}

/// Partida encontrada (`found`) o servidor listo (`server`): aviso de Windows si la ventana no está a la vista, y la
/// ventana al frente si el jugador lo tiene activado.
#[tauri::command]
pub fn window_attention(app: tauri::AppHandle, kind: Option<String>) -> Result<(), String> {
    let w = app.get_webview_window("main").ok_or("sin ventana")?;
    let s = settings::load(&app);
    let in_view = w.is_visible().unwrap_or(false) && w.is_focused().unwrap_or(false) && !w.is_minimized().unwrap_or(false);
    if !in_view {
        match kind.as_deref() {
            Some("server") => notify(&app, "Tu servidor está listo", "Entra antes de que venza el tiempo."),
            _ => notify(&app, "¡Partida encontrada!", "Acéptala desde CMLeague o desde la bandeja."),
        }
    }
    if s.bring_to_front {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
    let _ = w.request_user_attention(Some(UserAttentionType::Critical));
    Ok(())
}

// ---- Discord Rich Presence ----

/// ID de la aplicación de Discord (Discord Developer Portal), al compilar: `CMLEAGUE_DISCORD_APP_ID`. Sin él, no hay
/// Rich Presence.
const DISCORD_APP_ID: Option<&str> = option_env!("CMLEAGUE_DISCORD_APP_ID");

#[derive(Clone, PartialEq)]
struct Presence {
    details: String,
    state: String,
    start: Option<i64>,
}

/// Un hilo aparte habla con Discord: si no está abierto, lo vuelve a intentar con el próximo cambio.
pub fn start_discord(app: &tauri::AppHandle) {
    let Some(id) = DISCORD_APP_ID.filter(|i| !i.is_empty()) else { return };
    let (tx, rx) = channel::<Option<Presence>>();
    *app.state::<Shared>().discord.lock().unwrap() = Some(tx);
    std::thread::spawn(move || {
        use discord_rich_presence::activity::{Activity, Assets, Timestamps};
        use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
        let mut client: Option<DiscordIpcClient> = None;
        let mut last: Option<Presence> = None;
        while let Ok(p) = rx.recv() {
            if p == last {
                continue;
            }
            if client.is_none() {
                let mut c = DiscordIpcClient::new(id);
                if c.connect().is_ok() {
                    client = Some(c);
                }
            }
            let Some(c) = client.as_mut() else { continue };
            let ok = match &p {
                Some(p) => {
                    let mut a = Activity::new()
                        .details(p.details.as_str())
                        .assets(Assets::new().large_image("cmleague").large_text("CMLeague"));
                    if !p.state.is_empty() {
                        a = a.state(p.state.as_str());
                    }
                    if let Some(t) = p.start {
                        a = a.timestamps(Timestamps::new().start(t));
                    }
                    c.set_activity(a).is_ok()
                }
                None => c.clear_activity().is_ok(),
            };
            if ok {
                last = p;
            } else {
                client = None;
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn textos() {
        let s = |state: &str| Status { state: state.into(), mode: Some("5v5".into()), map: Some("de_dust2".into()), since: None, score: Some("9-7".into()) };
        assert_eq!(describe(&s("idle")), None);
        assert_eq!(describe(&s("queue")), Some(("Buscando partida".into(), "5v5".into())));
        assert_eq!(describe(&s("lobby")), Some(("Preparando la partida".into(), "5v5 · de_dust2".into())));
        assert_eq!(describe(&s("live")), Some(("Jugando 5v5".into(), "de_dust2 · 9-7".into())));
    }
}
