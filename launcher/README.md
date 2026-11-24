# Launcher de escritorio de CMLeague

Aplicación de Windows (Tauri 2) para buscar partida del matchmaking, aceptarla con un aviso encima de todo y entrar a ClientMod conectado a la sala. Plan: [`docs/bitacora/2026-11-24-launcher-escritorio/PLAN.md`](../docs/bitacora/2026-11-24-launcher-escritorio/PLAN.md).

**Estado: prototipo.** Compila (la interfaz y el chequeo de Rust para Windows), pero todavía no se abrió en Windows ni se probó con una partida real.

## Qué hace hoy

- Inicia sesión con email y contraseña (`/auth/login`, `/auth/refresh`).
- Escucha el socket del matchmaking (`/api/v1/mm/ws`) y muestra la cola, la sala y el servidor.
- Entra y sale de la cola, y acepta o rechaza la partida.
- Con una partida encontrada, trae la ventana al frente, la deja encima de todo, hace parpadear el ícono y suena `public/match.wav` hasta que aceptas.
- "Entrar al servidor": copia el `connect` y abre ClientMod. Con el juego cerrado, agrega `+connect` y `+password` a `Params=` de `clientmod.ini`, abre `CMLauncher.exe` (con el aviso de UAC) y restaura el `.ini` cuando aparece el juego. Siempre por `CMLauncher.exe`, nunca por `hl2.exe`. Con el juego ya abierto, solo copia el `connect` para pegarlo en la consola.
- Al cerrar la ventana, sigue en la bandeja del sistema.

## Pendiente de confirmar

- **Cómo se reconoce el juego abierto.** Con ClientMod no hay `hl2.exe`: el juego y cinco procesos de ayuda corren como `CMLauncher.exe`. El juego es el que tiene la ventana `CS:S v34 ClientMod` (visto en la PC de Agus el 2026-11-24, dentro de un servidor). `game_running()` busca `CMLauncher.exe` con esa ventana. Falta ver el título de la ventana del launcher con el juego cerrado, para confirmar que no coincide.
- **Si `CMLauncher.exe` toma `+connect` desde `Params=`.** Falta probarlo a mano.

## Correrlo

Hace falta Node 22, pnpm 12.8.1 (Corepack) y, para la app, Rust con las Build Tools de Visual Studio (C++) y WebView2 en Windows.

```bash
pnpm install --frozen-lockfile
```

```bash
pnpm tauri dev
```

Solo la interfaz, en el navegador (sin abrir el juego):

```bash
pnpm dev
```

Contra la API local: `VITE_API_URL=http://localhost:8787`. La API tiene que permitir el origen en `CORS_ORIGINS`: `http://localhost:1420` en desarrollo y `http://tauri.localhost` en la app instalada.

## Instalador

```bash
pnpm tauri build
```

Queda en `src-tauri/target/release/bundle/nsis/`. Por ahora sin firma de código (Windows muestra el aviso de SmartScreen).

## Pruebas

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Prueba la validación de la dirección y la contraseña (no pueden meter otro comando en la línea del juego) y la edición de `clientmod.ini`.
