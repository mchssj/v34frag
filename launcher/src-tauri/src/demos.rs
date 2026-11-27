//! Demos: "Ver demo" y "Descargar demo" bajan el `.dem` a la carpeta `cstrike` del ClientMod elegido (pedido de
//! Kyan, 2026-11-27), así queda listo para `playdemo` en la consola. Sin ClientMod elegido, va a Descargas.

use std::io::Write;
use std::path::PathBuf;

use crate::{game, settings, status};

/// El Worker de demos (`DEMO_BASE_URL`): `<base>/demo/<id>` o `<base>/demo/<id>.dem`. Solo de nuestros dominios.
pub fn demo_id(url: &tauri::Url) -> Option<String> {
    if url.scheme() != "https" {
        return None;
    }
    let host = url.host_str()?;
    let ours = host == "cmleague.lat" || host.ends_with(".cmleague.lat") || host == "v34frag-demos.agusb06-ab.workers.dev";
    if !ours {
        return None;
    }
    let id = url.path().strip_prefix("/demo/")?;
    let id = id.strip_suffix(".dem").unwrap_or(id);
    let ok = (6..=80).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
    ok.then(|| id.to_string())
}

/// Dónde va la demo: `<ClientMod>\cstrike` si hay ClientMod elegido o encontrado; si no, Descargas.
fn destination(app: &tauri::AppHandle) -> Option<(PathBuf, bool)> {
    use tauri::Manager;
    if let Some(info) = game::find_game(app) {
        let cstrike = PathBuf::from(&info.dir).join("cstrike");
        if cstrike.is_dir() {
            return Some((cstrike, true));
        }
    }
    app.path().download_dir().ok().map(|d| (d, false))
}

/// Si el launcher tiene que bajar la demo él (opción de Configuración, prendida de fábrica).
pub fn handles(app: &tauri::AppHandle, url: &tauri::Url) -> bool {
    settings::load(app).demos_to_game && demo_id(url).is_some()
}

/// Baja la demo en segundo plano y avisa al terminar.
pub fn download(app: &tauri::AppHandle, url: tauri::Url) {
    let Some(id) = demo_id(&url) else { return };
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let Some((dir, in_game)) = destination(&app) else {
            status::notify(&app, "No se pudo bajar la demo", "No encontré dónde guardarla.");
            return;
        };
        let file = dir.join(format!("{id}.dem"));
        if file.is_file() {
            status::notify(&app, "Ya tienes esta demo", &ready_text(&id, &file, in_game));
            return;
        }
        status::notify(&app, "Bajando la demo…", "Te aviso cuando esté lista.");
        match fetch(&url, &file).await {
            Ok(()) => status::notify(&app, "Demo lista", &ready_text(&id, &file, in_game)),
            Err(e) => status::notify(&app, "No se pudo bajar la demo", &e),
        }
    });
}

fn ready_text(id: &str, file: &std::path::Path, in_game: bool) -> String {
    if in_game {
        format!("Está en la carpeta cstrike de ClientMod. En la consola del juego: playdemo {id}")
    } else {
        format!("Está en {}. Elige la carpeta de ClientMod en Configuración para que vaya directo al juego.", file.display())
    }
}

/// Descarga a `<archivo>.part` y lo renombra al terminar: una demo cortada no queda como si estuviera completa.
async fn fetch(url: &tauri::Url, file: &std::path::Path) -> Result<(), String> {
    let mut res = reqwest::get(url.as_str()).await.map_err(|e| format!("Sin conexión con el servidor de demos ({e})."))?;
    if !res.status().is_success() {
        // El Worker explica en texto por qué no hay demo ("todavía no está disponible", "ya venció").
        let text = res.text().await.unwrap_or_default();
        let text = text.trim();
        return Err(if text.is_empty() || text.len() > 200 { "El servidor de demos no la tiene.".into() } else { text.to_string() });
    }
    let part = file.with_extension("dem.part");
    let mut out = std::fs::File::create(&part).map_err(|e| format!("No pude crear el archivo: {e}."))?;
    while let Some(chunk) = res.chunk().await.map_err(|e| format!("Se cortó la descarga ({e})."))? {
        if let Err(e) = out.write_all(&chunk) {
            let _ = std::fs::remove_file(&part);
            return Err(format!("No pude escribir la demo: {e}."));
        }
    }
    drop(out);
    std::fs::rename(&part, file).map_err(|e| format!("No pude guardar la demo: {e}."))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn links_de_demos() {
        let id = |s: &str| demo_id(&s.parse().unwrap());
        assert_eq!(id("https://v34frag-demos.agusb06-ab.workers.dev/demo/abc123XYZ"), Some("abc123XYZ".into()));
        assert_eq!(id("https://demos.cmleague.lat/demo/abc-123_x.dem"), Some("abc-123_x".into()));
        // Otros sitios, otras rutas o nombres raros: no.
        assert_eq!(id("https://otro.com/demo/abc123XYZ"), None);
        assert_eq!(id("https://cmleague.lat.otro.com/demo/abc123XYZ"), None);
        assert_eq!(id("https://demos.cmleague.lat/crash"), None);
        assert_eq!(id("https://demos.cmleague.lat/demo/ab"), None);
        assert_eq!(id("http://demos.cmleague.lat/demo/abc123XYZ"), None);
    }
}
