//! Actualización automática (tauri-plugin-updater). Busca al abrir y cada 6 horas; si hay una versión nueva, avisa y
//! la ofrece en la bandeja y en Configuración. Se instala solo cuando el jugador lo pide, así nunca corta una partida.
//!
//! Hace falta la clave pública de la firma al compilar (`CMLEAGUE_UPDATER_PUBKEY`): sin ella no busca nada. Las
//! versiones se publican en https://descargas.cmleague.lat/launcher/latest.json (ver launcher/README.md).

use std::time::Duration;

use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

use crate::status::{notify, refresh, Shared};
use crate::settings;

pub const PUBKEY: Option<&str> = option_env!("CMLEAGUE_UPDATER_PUBKEY");
const ENDPOINT: &str = "https://descargas.cmleague.lat/launcher/latest.json";

pub fn enabled() -> bool {
    PUBKEY.is_some_and(|k| !k.is_empty())
}

fn updater(app: &tauri::AppHandle) -> Result<tauri_plugin_updater::Updater, String> {
    app.updater_builder()
        .pubkey(PUBKEY.unwrap_or_default())
        .endpoints(vec![ENDPOINT.parse().map_err(|_| "URL inválida".to_string())?])
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())
}

/// Busca una versión nueva. Devuelve su número, o None si no hay.
async fn check(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    if !enabled() {
        return Err("Esta versión del launcher no tiene activadas las actualizaciones.".into());
    }
    let found = updater(app)?.check().await.map_err(|e| format!("No pude buscar actualizaciones: {e}."))?;
    let version = found.map(|u| u.version);
    let shared = app.state::<Shared>();
    let changed = *shared.update.lock().unwrap() != version;
    *shared.update.lock().unwrap() = version.clone();
    if changed {
        refresh(app);
        if let Some(v) = &version {
            notify(app, "Hay una actualización del launcher", &format!("La versión {v} está lista. Instálala desde la bandeja o desde Configuración."));
        }
    }
    Ok(version)
}

/// Al abrir y cada 6 horas, si el jugador no lo apagó.
pub fn start(app: &tauri::AppHandle) {
    if !enabled() {
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(10)).await;
        loop {
            if settings::load(&app).auto_update {
                let _ = check(&app).await;
            }
            tokio::time::sleep(Duration::from_secs(6 * 3600)).await;
        }
    });
}

#[tauri::command]
pub async fn update_check(app: tauri::AppHandle) -> Result<Option<String>, String> {
    check(&app).await
}

/// Descarga, instala y reinicia el launcher.
#[tauri::command]
pub async fn update_install(app: tauri::AppHandle) -> Result<(), String> {
    if !enabled() {
        return Err("Esta versión del launcher no tiene activadas las actualizaciones.".into());
    }
    let update = updater(&app)?
        .check()
        .await
        .map_err(|e| format!("No pude buscar actualizaciones: {e}."))?
        .ok_or("Ya tienes la última versión.")?;
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| format!("No pude instalar la actualización: {e}."))?;
    app.restart();
}

#[tauri::command]
pub fn app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}
