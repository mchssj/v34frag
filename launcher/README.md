# Launcher de escritorio de CMLeague

Es la web de CMLeague (`https://cmleague.lat`) en una ventana propia, como el cliente de FACEIT. No es un anticheat. Tiene la misma sesión, las mismas secciones y el mismo matchmaking, más lo que el navegador no puede hacer:

- **Abrir ClientMod conectado a la sala.** En la web, "Conectar" (sala del matchmaking), "Volver a la partida" y "Entrar" (PCW) abren el juego en lugar de `steam://connect`, que no funciona con ClientMod. Agrega `+connect` y `+password` a `Params=` de `clientmod.ini`, abre `CMLauncher.exe` (con el aviso de UAC, nunca `hl2.exe`) y restaura el `.ini` cuando aparece el juego. Con el juego ya abierto, solo copia el `connect`. El `connect` siempre queda copiado.
- **Traer la ventana al frente** cuando aparece la partida o el servidor está listo, aunque esté minimizada o en la bandeja.
- **Bandeja del sistema:** cerrar la ventana no cierra el launcher, así sigues en la cola.

Plan: [`docs/bitacora/2026-11-24-launcher-escritorio/PLAN.md`](../docs/bitacora/2026-11-24-launcher-escritorio/PLAN.md). Se cambió el enfoque después del plan: la interfaz aparte del plan se reemplazó por la web misma.

## Cómo se conecta con la web

- La ventana abre `https://cmleague.lat/play` (`src-tauri/tauri.conf.json`). `offline/` es la carpeta local que Tauri exige.
- La web detecta el launcher (`web/frontend/src/lib/launcher.ts`) y llama a los comandos nativos por el IPC de Tauri. Fuera del launcher no cambia nada.
- Solo `https://cmleague.lat` y `www` pueden usar los comandos, y solo estos cuatro: `game_detect`, `game_set_dir`, `game_launch` y `window_attention` (`src-tauri/capabilities/web.json`). La dirección y la contraseña se validan en Rust: no pueden meter otro comando en la línea del juego.
- La carpeta de ClientMod se busca en las rutas comunes (`C:\CSSv34_ClientMod`, `C:\ClientMod`, …). Si no aparece, la web la pide una vez y queda guardada.
- No hace falta tocar la API ni `CORS_ORIGINS`: la web carga desde su propio dominio, como en el navegador.

## Pendiente de confirmar

- **Cómo se reconoce el juego abierto.** Con ClientMod no hay `hl2.exe`: el juego y cinco procesos de ayuda corren como `CMLauncher.exe`. El juego es el que tiene la ventana `CS:S v34 ClientMod` (visto en la PC de Agus el 2026-11-24, dentro de un servidor). Falta ver el título de la ventana del launcher con el juego cerrado.
- **Si `CMLauncher.exe` toma `+connect` desde `Params=`.** Falta probarlo a mano.
- Los cambios de la web (`launcher.ts` y los botones) tienen que estar desplegados en `cmleague.lat` para que "Conectar" abra el juego.

## Compilar

El instalador lo arma GitHub Actions en Windows (`.github/workflows/launcher.yml`) y queda como artefacto `cmleague-launcher-windows`. En una PC con Windows, Rust y las Build Tools de Visual Studio (C++):

```bash
pnpm install --frozen-lockfile
```

```bash
pnpm build
```

Para probar contra una web local, cambia `url` en `tauri.conf.json` (por ejemplo `http://localhost:5173/play`) y suma ese origen en `capabilities/web.json`.

## Pruebas

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```
