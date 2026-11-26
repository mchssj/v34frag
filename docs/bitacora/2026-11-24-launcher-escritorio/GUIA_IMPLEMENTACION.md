# Launcher de escritorio: guía de implementación

## Estado

Compilado y probado en Windows por GitHub Actions: abre, sigue abierto y saca capturas. **Sin desplegar ni publicar** (2026-11-26).

Faltan:

- probar el `+connect` en una PC con ClientMod;
- desplegar la web;
- publicar la primera versión en el VPS;
- que Daniel encienda las actualizaciones y Discord.

Todo está en la rama `claude/relaxed-einstein-sl0cme`.

## Archivos

| Archivo | Cambio |
|---|---|
| `launcher/` | Proyecto nuevo (Tauri 2, pnpm): `package.json`, `pnpm-workspace.yaml`, `README.md`, `local/` (Configuración e `index.html`) y `src-tauri/` (Rust, íconos, permisos) |
| `.github/workflows/launcher.yml` | Nuevo. En Windows: pruebas de Rust, instalador (firmado si están las claves), prueba de que abre, capturas, `latest.json` y artefactos |
| `deploy/vps/Caddyfile` | `/descargas/*` sale de `/srv/cmleague/descargas`, fuera de la web |
| `web/frontend/src/lib/launcher.ts` | Nuevo: el puente con el launcher y el "Conectar" del navegador (copia el `connect`) |
| `web/frontend/src/features/launcher/` | Nuevo: `LauncherTheme`, `LauncherThemeCard`, `useLauncherPrefs`, `latest.ts` y la página `/launcher` |
| `web/frontend/src/routes/launcher.tsx` | Nuevo: ruta pública `/launcher` |
| `web/frontend/src/routes/_app.tsx` | `<LauncherTheme />` |
| `web/frontend/src/features/matchmaking/MatchAlerts.tsx` | Estado para el launcher (`launcherStatusOf`) y Aceptar desde la bandeja |
| `web/frontend/src/features/matchmaking/alert.ts` | Avisos al launcher en partida encontrada y servidor listo |
| `web/frontend/src/features/matchmaking/room/RoomOverview.tsx`, `ReconnectBanner.tsx`, `features/pcw/components/SeriesPanel.tsx`, `features/shell/components/NowBar.tsx`, `features/mixes/components/parts.tsx` | Los "Conectar" y "Ver en TV" usan `launchOnClick` |
| `web/frontend/src/features/matchmaking/PlayPage.tsx` | Link "Launcher para Windows" fuera del launcher |
| `web/frontend/src/features/profile/pages/PreferencesSection.tsx` | Tarjeta **Tema del launcher**, solo en el launcher |
| `web/frontend/src/config/site.ts` | `LAUNCHER` (dónde está `latest.json` y el link `cmleague://play`) |
| `web/frontend/src/features/legal/pages/PrivacyPage.tsx`, `TermsPage.tsx`, `terms/privacidad.html`, `terms/terminos.html` | Párrafo del launcher, "En preparación" |
| Pruebas | `src/lib/launcher.test.ts`, `features/launcher/lib/latest.test.ts`, `features/matchmaking/launcherStatus.test.ts` y las de Rust en `game.rs`, `settings.rs`, `status.rs` y `lib.rs` |
| `docs/manual/jugador/launcher.md` | Nueva |
| `docs/manual/jugador/buscar-partida.md` | Conectar en el navegador y en el launcher |

## Despliegue (no hecho)

1. **Probar el `connect`** en una PC con ClientMod (ver "Pruebas"). Si no funciona, hay que cambiar cómo se abre el juego antes de seguir.
2. **Web** (Daniel). Pasar los cambios de `web/frontend` a la rama de la que despliega y, desde su PC:
   ```bash
   deploy/vps/desplegar.sh web
   ```
3. **Caddy** (Daniel). Copiar `deploy/vps/Caddyfile` al VPS, crear la carpeta y recargar Caddy:
   ```bash
   sudo install -d -o deploy -g deploy /srv/cmleague/descargas/launcher
   ```
   ```bash
   sudo caddy validate --config /etc/caddy/Caddyfile
   ```
   ```bash
   sudo systemctl reload caddy
   ```
   **No se validó acá**: no había Caddy en el entorno.
4. **Claves en GitHub** (Daniel), en Settings › Secrets and variables › Actions. Los pasos están en `launcher/README.md`:
   - `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (secretos);
   - `CMLEAGUE_UPDATER_PUBKEY` (variable);
   - `CMLEAGUE_DISCORD_APP_ID` (variable), con la imagen `cmleague` en Rich Presence › Art Assets.
5. **Publicar la versión.** Volver a correr el workflow, bajar el artefacto `cmleague-launcher-windows` y copiar el `.exe` y `latest.json` a `/srv/cmleague/descargas/launcher/`.
6. **Después de publicar:**
   - quitar "En preparación" del párrafo del launcher en `/privacidad` y `/terminos` (web y `.html`);
   - publicar el `CHANGELOG_DISCORD.txt`.

No toca la base, la API ni los servidores de juego.

## Pruebas

### GitHub Actions (Windows, `windows-latest`)

- Pasan las pruebas de Rust: validación de dirección y contraseña, `clientmod.ini` (incluido el `.ini` real de Agus, con `Params=` terminado en espacio), los textos de la bandeja, la configuración con campos de menos y los links `cmleague://`.
- Compila el instalador NSIS.
- **Abre y no se cierra:** el `.exe` sigue abierto a los 25 s. Con `--ajustes` abre Configuración en la misma instancia. Saca `1-ventana.png` y `2-configuracion.png` (artefacto `capturas`).
- Corrida con todo esto: `45671580861`, sin las últimas tandas.

### Web (en este entorno)

- `pnpm typecheck` y `eslint` sin errores.
- `vitest`: 140 archivos y 855 pruebas, todas pasan.
- El manual pasa la validación de la API (la misma de `scripts/build.mjs`).

### Sin probar

- **`+connect` en `Params=` con `CMLauncher.exe`.** Es lo más importante. Prueba a mano:
  1. agregar `+connect 190.104.34.3:27022` al final de `Params=`;
  2. abrir `CMLauncher.exe` y apretar PLAY;
  3. ver si entra directo al #1.
- **El título de la ventana del launcher de ClientMod** con el juego cerrado, para confirmar que no se confunde con `CS:S v34 ClientMod`.
- Avisos de Windows, Discord, actualización, el tema y `cmleague://`: en una PC real, después de desplegar la web y encender las claves.

## En qué se apartó del plan

- **El launcher es la web, no una interfaz propia** (pedido de Agus, 2026-11-25). El prototipo del plan tenía login, cola y aceptar propios en React; se reemplazó por la ventana que abre `cmleague.lat`.
  - Ya no hace falta tocar `CORS_ORIGINS`, ni `tauri-plugin-http`, ni guardar la sesión en el Administrador de credenciales, porque la sesión es la de la web.
- **Siempre `CMLauncher.exe`, sin `-hijack`** (Agus). No hay `hl2.exe` en la raíz de ClientMod. El juego se reconoce por la ventana `CS:S v34 ClientMod`.
- **Más de lo que tenía la versión 1 del plan:** Configuración propia, bandeja con estado y Aceptar, avisos de Windows, Discord, actualizaciones, tema de la tienda, una sola instancia, `--ajustes`, `cmleague://` y la página `/launcher`. Estaban en "Fuera de la versión 1" o los pidió Agus.
- **Descargas en `/descargas/launcher/`** y no en `/launcher/`, que es la página de la web y vive en `web/current`, que se reemplaza en cada despliegue.
- **"Conectar" en el navegador** copia el `connect` en lugar de `steam://connect`. El plan lo proponía como una preferencia "Tengo el launcher"; se hizo sin preferencia: dentro del launcher abre el juego y fuera copia.
- **La guía de la primera vez** no enlaza al launcher. Está en tres idiomas y no se tradujo. Lo enlazan Jugar y el manual.
- **Barra de título nativa con colores** (Windows 11) en lugar de una barra propia, para no tocar el diseño de la web.

## Incidentes durante las pruebas

- **2026-11-25: el launcher no abría.** `tauri-plugin-updater` exige `pubkey` en su configuración y, sin ella, la app se cerraba al arrancar sin mostrar nada. Se arregló con tres cambios:
  - `plugins.updater` vacío en `tauri.conf.json`;
  - el plugin se registra solo con la clave;
  - `error.log` en `%LOCALAPPDATA%\lat.cmleague.launcher\`.

  Además se sumó la prueba "Abre y no se cierra".
- **`ring` no compila** con el chequeo para Windows desde Linux, porque le falta el compilador de C. Se usa TLS nativo (`native-tls`) en el actualizador.
- **La red de este entorno bloquea `cmleague.lat`** y el almacenamiento de los artefactos de GitHub, así que las capturas de Windows no se pudieron ver desde acá.

## Cómo revertir

- **Web:** revertir los commits del launcher en `web/frontend`, o volver a desplegar la versión anterior con `desplegar.sh` (guarda 5). Fuera del launcher, lo único que cambia es el "Conectar" del navegador.
- **Caddy:** sacar el bloque `@descargas` y `@spa` del Caddyfile y recargar.
- **Launcher:** dejar de publicar `latest.json`. Los instalados siguen funcionando, sin actualizarse. Para sacarlo de una PC, se desinstala desde Windows.
- **GitHub:** borrar `.github/workflows/launcher.yml` y las claves.
