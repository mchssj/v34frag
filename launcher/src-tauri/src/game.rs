//! ClientMod: encontrarlo y abrirlo conectado a la sala (plan, sección 4).
//! Siempre por CMLauncher.exe (nunca hl2.exe): el connect va en Params= de clientmod.ini mientras arranca.

use std::path::Path;
use std::process::Command;

use serde::Serialize;

use crate::settings;

#[derive(Serialize)]
pub struct GameInfo {
    pub dir: String,
    pub launcher: String,
}

/// Carpetas donde se busca ClientMod si el jugador no eligió una.
const COMMON_DIRS: &[&str] = &[
    r"C:\CSSv34_ClientMod",
    r"C:\ClientMod",
    r"C:\Program Files (x86)\ClientMod",
    r"C:\Program Files\ClientMod",
    r"D:\CSSv34_ClientMod",
    r"D:\ClientMod",
    r"E:\CSSv34_ClientMod",
    r"E:\ClientMod",
];

/// ClientMod se abre siempre con CMLauncher.exe (nunca con hl2.exe): es el que arranca el juego con EasyAntiCheat.
fn inspect(dir: &Path) -> Option<GameInfo> {
    let launcher = dir.join("CMLauncher.exe");
    launcher.is_file().then(|| GameInfo {
        dir: dir.to_string_lossy().into_owned(),
        launcher: launcher.to_string_lossy().into_owned(),
    })
}

pub fn find_game(app: &tauri::AppHandle) -> Option<GameInfo> {
    let saved = settings::load(app).clientmod_dir;
    if let Some(info) = saved.as_deref().map(str::trim).filter(|d| !d.is_empty()).and_then(|d| inspect(Path::new(d))) {
        return Some(info);
    }
    COMMON_DIRS.iter().find_map(|d| inspect(Path::new(d)))
}

/// Dónde está ClientMod: la carpeta guardada o, si no hay, la primera de las comunes que tenga CMLauncher.exe.
#[tauri::command]
pub fn game_detect(app: tauri::AppHandle) -> Option<GameInfo> {
    find_game(&app)
}

/// Guarda la carpeta de ClientMod que eligió el jugador (tiene que tener CMLauncher.exe).
#[tauri::command]
pub fn game_set_dir(app: tauri::AppHandle, dir: String) -> Result<GameInfo, String> {
    let info = inspect(Path::new(dir.trim())).ok_or("No encontré CMLauncher.exe en esa carpeta.")?;
    let mut s = settings::load(&app);
    s.clientmod_dir = Some(info.dir.clone());
    settings::save(&app, &s)?;
    Ok(info)
}

/// `ip:puerto` o `host:puerto`. Lo que va a la línea de comandos del juego no puede traer espacios, `;` ni comillas:
/// el motor los leería como otro comando.
fn valid_address(a: &str) -> bool {
    let Some((host, port)) = a.rsplit_once(':') else { return false };
    !host.is_empty()
        && host.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
        && port.parse::<u16>().is_ok()
}

fn valid_password(p: &str) -> bool {
    !p.is_empty() && p.len() <= 64 && p.chars().all(|c| c.is_ascii_graphic() && !matches!(c, ';' | '"' | '\''))
}

/// Título de la ventana del juego. Con ClientMod no hay hl2.exe: el juego y los procesos de ayuda del launcher
/// corren todos como CMLauncher.exe (visto en una PC con el juego abierto, 2026-11-24). El juego es el único con
/// esta ventana. FALTA confirmar el título de la ventana del launcher con el juego cerrado (launcher/README.md).
const GAME_WINDOW: &str = "CS:S v34 ClientMod";

/// Si el juego está abierto: un CMLauncher.exe con la ventana del juego.
pub fn game_running() -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let title = format!("windowtitle eq {GAME_WINDOW}");
        Command::new("tasklist")
            .args(["/fi", "imagename eq CMLauncher.exe", "/fi", &title, "/fo", "csv", "/nh"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            // Sin coincidencias, tasklist escribe un aviso (en el idioma de Windows) que no nombra el proceso.
            .map(|o| String::from_utf8_lossy(&o.stdout).to_lowercase().contains("cmlauncher.exe"))
            .unwrap_or(false)
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// Agrega `extra` al final de la línea `Params=` de clientmod.ini, trabajando en bytes para no cambiar la
/// codificación del archivo. Devuelve el contenido original para restaurarlo después.
fn patch_ini(ini: &Path, extra: &str) -> Result<Vec<u8>, String> {
    let original = std::fs::read(ini).map_err(|e| format!("No pude leer clientmod.ini: {e}."))?;
    let mut out = Vec::with_capacity(original.len() + extra.len() + 16);
    let mut found = false;
    for line in original.split_inclusive(|&b| b == b'\n') {
        let body_len = line.iter().rposition(|&b| b != b'\n' && b != b'\r').map_or(0, |i| i + 1);
        let (body, end) = line.split_at(body_len);
        if !found && body.to_ascii_lowercase().starts_with(b"params=") {
            found = true;
            out.extend_from_slice(body);
            if !body.ends_with(b"=") && !body.ends_with(b" ") {
                out.push(b' ');
            }
            out.extend_from_slice(extra.as_bytes());
            out.extend_from_slice(end);
        } else {
            out.extend_from_slice(line);
        }
    }
    if !found {
        if !out.is_empty() && !out.ends_with(b"\n") {
            out.extend_from_slice(b"\r\n");
        }
        out.extend_from_slice(format!("Params={extra}\r\n").as_bytes());
    }
    std::fs::write(ini, &out).map_err(|e| format!("No pude escribir clientmod.ini: {e}."))?;
    Ok(original)
}

#[cfg(windows)]
fn run_elevated(exe: &str, dir: &str) -> Result<(), String> {
    // CMLauncher.exe pide administrador: Start-Process -Verb RunAs muestra el aviso de UAC (ShellExecute "runas").
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let q = |s: &str| s.replace('\'', "''");
    let status = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!("Start-Process -FilePath '{}' -WorkingDirectory '{}' -Verb RunAs", q(exe), q(dir)),
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| format!("No pude abrir CMLauncher.exe: {e}."))?;
    if status.success() { Ok(()) } else { Err("Se canceló el aviso de Windows (UAC) o no se pudo abrir CMLauncher.exe.".into()) }
}

#[cfg(not(windows))]
fn run_elevated(_exe: &str, _dir: &str) -> Result<(), String> {
    Err("ClientMod solo corre en Windows.".into())
}

#[tauri::command]
pub fn game_launch(app: tauri::AppHandle, address: String, password: Option<String>) -> Result<String, String> {
    if !valid_address(&address) {
        return Err("La dirección del servidor no es válida.".into());
    }
    // Sin contraseña: SourceTV.
    let password = password.filter(|p| !p.is_empty());
    if password.as_deref().is_some_and(|p| !valid_password(p)) {
        return Err("La contraseña de la sala tiene caracteres que no se pueden pasar al juego.".into());
    }
    let info = find_game(&app).ok_or("NO_GAME")?;

    // Con el juego abierto no hay cómo pasarle el connect desde afuera (el juego corre con EasyAntiCheat):
    // queda copiado y se pega en la consola.
    if game_running() {
        return Ok("El juego ya está abierto: pega el connect en la consola (º).".into());
    }

    // El connect va en Params= de clientmod.ini y se restaura cuando aparece el juego.
    let ini = Path::new(&info.dir).join("clientmod.ini");
    let extra = match &password {
        Some(p) => format!("+connect {address} +password {p}"),
        None => format!("+connect {address}"),
    };
    let original = patch_ini(&ini, &extra)?;
    if let Err(e) = run_elevated(&info.launcher, &info.dir) {
        let _ = std::fs::write(&ini, &original);
        return Err(e);
    }
    std::thread::spawn(move || {
        // Hasta que aparezca el juego (el jugador aprieta PLAY) o 2 minutos, lo que pase primero.
        for _ in 0..120 {
            std::thread::sleep(std::time::Duration::from_secs(1));
            if game_running() {
                std::thread::sleep(std::time::Duration::from_secs(5));
                break;
            }
        }
        let _ = std::fs::write(&ini, &original);
    });
    Ok("Abrí ClientMod: aprieta PLAY y entras directo al servidor.".into())
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn direcciones() {
        assert!(valid_address("190.104.34.3:27022"));
        assert!(!valid_address("190.104.34.3"));
        assert!(!valid_address("1.2.3.4:27015; quit"));
    }

    #[test]
    fn contrasenas() {
        assert!(valid_password("abc123"));
        assert!(!valid_password("a b"));
        assert!(!valid_password("x;quit"));
        assert!(!valid_password(""));
    }

    #[test]
    fn ini() {
        let dir = std::env::temp_dir().join(format!("cmlauncher-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let ini = dir.join("clientmod.ini");
        std::fs::write(&ini, b"[Main]\r\nParams=-novid\r\nOther=1\r\n").unwrap();
        let orig = patch_ini(&ini, "+connect 1.2.3.4:27015 +password x").unwrap();
        assert_eq!(std::fs::read(&ini).unwrap(), b"[Main]\r\nParams=-novid +connect 1.2.3.4:27015 +password x\r\nOther=1\r\n");
        std::fs::write(&ini, &orig).unwrap();
        std::fs::write(&ini, b"[Main]\r\nOther=1").unwrap();
        patch_ini(&ini, "+connect a:1").unwrap();
        assert_eq!(std::fs::read(&ini).unwrap(), b"[Main]\r\nOther=1\r\nParams=+connect a:1\r\n");
        // El clientmod.ini real de una instalación (2026-11-24): Params= termina con un espacio.
        let real = b"[Launcher]\r\nInstalled=true\r\n[Game]\r\nParams=-console -tickrate 128 -high +exec autoexec.cfg \r\nInstalled=true\r\n";
        std::fs::write(&ini, real).unwrap();
        let orig = patch_ini(&ini, "+connect 190.104.34.3:27022 +password abc").unwrap();
        assert_eq!(orig, real);
        assert_eq!(
            std::fs::read(&ini).unwrap(),
            b"[Launcher]\r\nInstalled=true\r\n[Game]\r\nParams=-console -tickrate 128 -high +exec autoexec.cfg +connect 190.104.34.3:27022 +password abc\r\nInstalled=true\r\n"
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
