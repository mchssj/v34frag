//! Configuración propia del launcher. Se guarda en la PC (carpeta de configuración de la app, `ajustes.json`), no en
//! la cuenta: no cambia nada de la web ni de otros dispositivos.

use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default)]
pub struct Settings {
    /// Abrir el launcher al iniciar Windows.
    pub start_with_windows: bool,
    /// Al iniciar con Windows, quedar en la bandeja sin abrir la ventana.
    pub start_minimized: bool,
    /// La X de la ventana la manda a la bandeja (sigue en la cola y avisa). Si no, cierra el launcher.
    pub close_to_tray: bool,
    /// Avisos de Windows: partida encontrada, servidor listo y actualizaciones.
    pub notifications: bool,
    /// Traer la ventana al frente cuando aparece la partida o el servidor está listo.
    pub bring_to_front: bool,
    /// Mostrar en Discord lo que estás haciendo (en cola, jugando).
    pub discord_presence: bool,
    /// Buscar actualizaciones al abrir y cada 6 horas.
    pub auto_update: bool,
    /// Pintar el launcher con el tema de la tienda que tenés equipado en tu perfil (solo se pueden equipar los que
    /// tenés). Apagado de fábrica; no cambia la web en el navegador.
    pub shop_theme: bool,
    /// Carpeta de ClientMod elegida a mano; sin ella se busca en las rutas comunes.
    pub clientmod_dir: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            start_with_windows: false,
            start_minimized: true,
            close_to_tray: true,
            notifications: true,
            bring_to_front: true,
            discord_presence: true,
            auto_update: true,
            shop_theme: false,
            clientmod_dir: None,
        }
    }
}

fn file(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("ajustes.json"))
}

/// La configuración guardada; si no hay o no se puede leer, la de fábrica.
pub fn load(app: &tauri::AppHandle) -> Settings {
    file(app)
        .and_then(|f| std::fs::read(f).ok())
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

pub fn save(app: &tauri::AppHandle, s: &Settings) -> Result<(), String> {
    let f = file(app).ok_or("No encontré dónde guardar la configuración.")?;
    if let Some(dir) = f.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("No pude guardar la configuración: {e}."))?;
    }
    let json = serde_json::to_vec_pretty(s).map_err(|e| e.to_string())?;
    std::fs::write(f, json).map_err(|e| format!("No pude guardar la configuración: {e}."))
}

#[tauri::command]
pub fn settings_get(app: tauri::AppHandle) -> Settings {
    load(&app)
}

/// Guarda y aplica lo que cambia en el momento (arranque con Windows y Discord).
#[tauri::command]
pub fn settings_set(app: tauri::AppHandle, settings: Settings) -> Result<Settings, String> {
    apply_autostart(&app, settings.start_with_windows)?;
    let before = load(&app);
    save(&app, &settings)?;
    crate::status::refresh(&app);
    if before.shop_theme != settings.shop_theme {
        // La web vuelve a leer la configuración y pone o saca el tema.
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.eval("window.__cmleagueLauncher && window.__cmleagueLauncher.prefsChanged && window.__cmleagueLauncher.prefsChanged()");
        }
    }
    Ok(settings)
}

/// Lo que la web necesita saber de la configuración del launcher (sin la carpeta de ClientMod ni lo demás).
#[derive(Serialize)]
pub struct WebPrefs {
    pub shop_theme: bool,
}

#[tauri::command]
pub fn launcher_prefs(app: tauri::AppHandle) -> WebPrefs {
    WebPrefs { shop_theme: load(&app).shop_theme }
}

fn apply_autostart(app: &tauri::AppHandle, on: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let auto = app.autolaunch();
    let now = auto.is_enabled().unwrap_or(false);
    if on && !now {
        auto.enable().map_err(|e| format!("No pude activar el inicio con Windows: {e}."))?;
    } else if !on && now {
        auto.disable().map_err(|e| format!("No pude desactivar el inicio con Windows: {e}."))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn faltan_campos() {
        // Un ajustes.json de una versión anterior, con menos campos, toma los de fábrica para el resto.
        let s: Settings = serde_json::from_str(r#"{"notifications": false}"#).unwrap();
        assert!(!s.notifications);
        assert!(s.close_to_tray);
        assert_eq!(s.clientmod_dir, None);
    }
}
