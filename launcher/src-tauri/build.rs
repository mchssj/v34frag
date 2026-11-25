fn main() {
    // Los comandos propios se declaran para poder dárselos por separado a la web (capabilities/web.json) y a la
    // ventana de Configuración (capabilities/ajustes.json).
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
        "game_detect",
        "game_set_dir",
        "game_launch",
        "window_attention",
        "launcher_status",
        "launcher_prefs",
        "window_theme",
        "settings_open",
        "settings_get",
        "settings_set",
        "update_check",
        "update_install",
        "app_version",
    ])))
    .expect("no se pudo preparar el build");
}
