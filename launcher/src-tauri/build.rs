fn main() {
    // Los comandos propios se declaran para poder dárselos a la web remota (capabilities/web.json).
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["game_detect", "game_set_dir", "game_launch", "window_attention"]),
    ))
    .expect("no se pudo preparar el build");
}
