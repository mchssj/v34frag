# Launcher de escritorio: guía de implementación

## Estado

Compilado y probado en Windows por GitHub Actions: abre, sigue abierto y Configuración guarda lo que se cambia desde su página (corrida `45862228345`, `0364d6a`). **En `main` y en la web desde el 2026-11-26** (merge `42d600b4`, y los arreglos de Kyan hasta `84840288` en otro merge); el launcher, **sin publicar**. Llaves del actualizador generadas el 2026-11-26 (falta cargarlas en GitHub).

Está en la rama `feat/launcher` (worktree `v34frag-launcher`), que sale de `main`. Trae lo de Kyan (`claude/relaxed-einstein-sl0cme`, hasta `29a6600a`) sin su base vieja: tomar sus archivos de la web tal cual borraba cosas desplegadas después (el preveto VIP en `RoomOverview.tsx`), así que van como parche, y `MatchAlerts.tsx`, `alert.ts` y los legales se unieron a mano. La revisión del 2026-11-25 y el 2026-11-26 está en "Decisiones y revisión" de [`DOCUMENTACION.md`](DOCUMENTACION.md).

Faltan, en orden:

1. Daniel: probar el `+connect` a mano en su PC (ver "Pruebas").
2. Pasar `feat/launcher` a `main` y desplegar la web.
3. Instalar el `.exe` de prueba de GitHub Actions y probarlo con una sala real.
4. Daniel: el bucket de R2, su dominio, las claves en GitHub y publicar la primera versión.

## Archivos

| Archivo | Cambio |
|---|---|
| `launcher/` | Proyecto nuevo (Tauri 2, pnpm): `package.json`, `pnpm-workspace.yaml`, `README.md`, `local/` (Configuración e `index.html`) y `src-tauri/` (Rust, íconos, permisos) |
| `.github/workflows/launcher.yml` | Nuevo. En Windows: pruebas de Rust, instalador (firmado si están las claves), prueba de que abre, capturas, prueba de Configuración (build aparte con `--features autoprueba`), `latest.json`, artefactos y, solo a mano con **Publicar en R2**, la subida a R2. No corre por cambios de `.md` y cancela la corrida vieja de la misma rama |
| `web/frontend/src/lib/launcher.ts` | Nuevo: el puente con el launcher y el "Conectar" del navegador (copia el `connect`) |
| `web/frontend/src/features/launcher/` | Nuevo: `LauncherTheme`, `LauncherThemeCard`, `useLauncherPrefs`, `latest.ts` y la página `/launcher` |
| `web/frontend/src/routes/launcher.tsx` | Nuevo: ruta pública `/launcher` |
| `web/frontend/src/routes/_app.tsx` | `<LauncherTheme />` |
| `web/frontend/src/features/matchmaking/MatchAlerts.tsx` | Estado para el launcher (`launcherStatusOf`) y Aceptar desde la bandeja |
| `web/frontend/src/features/matchmaking/alert.ts` | Avisos al launcher en partida encontrada y servidor listo |
| `web/frontend/src/features/matchmaking/room/RoomOverview.tsx`, `ReconnectBanner.tsx`, `features/pcw/components/SeriesPanel.tsx`, `features/shell/components/NowBar.tsx`, `features/mixes/components/parts.tsx` | Los "Conectar" y "Ver en TV" usan `launchOnClick` |
| `web/frontend/src/features/matchmaking/PlayPage.tsx` | Link "Launcher para Windows" fuera del launcher, solo con `LAUNCHER.published` |
| `web/frontend/src/features/profile/pages/PreferencesSection.tsx` | Tarjeta **Tema del launcher**, solo en el launcher |
| `web/frontend/src/config/site.ts` | `LAUNCHER`: `published` (hoy `false`), dónde está `latest.json` (R2) y el link `cmleague://play` |
| `web/frontend/src/features/legal/pages/PrivacyPage.tsx`, `TermsPage.tsx`, `terms/privacidad.html`, `terms/terminos.html` | Párrafo del launcher, "En preparación" |
| Pruebas | `src/lib/launcher.test.ts`, `features/launcher/lib/latest.test.ts`, `features/matchmaking/launcherStatus.test.ts` y las de Rust en `game.rs`, `settings.rs`, `status.rs` y `lib.rs` |
| `docs/manual/jugador/launcher.md` | Nueva, con `oculta: true` hasta publicarlo |
| `docs/manual/jugador/buscar-partida.md` y `capitan/jugar-pcw.md` | **Conectar** y **Entrar** en el navegador copian el connect. El link al launcher se suma al publicarlo |

## Despliegue (no hecho)

1. **Probar el `connect`** en la PC de Daniel, que tiene ClientMod en `C:\CSSv34_ClientMod` (ver "Pruebas"). Si no funciona, hay que cambiar cómo se abre el juego antes de seguir.
2. **Web.** Pasar `feat/launcher` a `main` y, desde la PC de Daniel:
   ```bash
   deploy/vps/desplegar.sh web
   ```
   Fuera del launcher solo cambia que **Conectar**, **Entrar** (PCW) y **Ver en TV** copian el connect en vez de abrir `steam://`. Después, los mismos commits de la web en `feat/frontend-fase-1`.
3. **R2** (Daniel, en su cuenta de Cloudflare):
   - Un bucket para el launcher (o una carpeta `launcher/` en uno suyo) con el dominio propio `descargas.cmleague.lat`.
   - CORS del bucket: `GET` desde `https://cmleague.lat` (la página `/launcher` lee `latest.json`).
   - Un token de R2 de **escritura solo para ese bucket**.
4. **Datos en GitHub** (Daniel), en Settings › Secrets and variables › Actions. Los pasos de las llaves están en `launcher/README.md`:
   - secretos `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, y variable `CMLEAGUE_UPDATER_PUBKEY` (actualizaciones). **La llave privada se guarda también fuera de GitHub**: si se pierde, los launcher instalados no aceptan más actualizaciones;
   - variable `CMLEAGUE_DISCORD_APP_ID` (Discord), con la imagen `cmleague` en Rich Presence › Art Assets;
   - variables `R2_ACCOUNT_ID` y `R2_BUCKET`, y secretos `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`.
5. **Publicar la versión.** En GitHub › Actions › Launcher › **Run workflow**, con **Publicar en R2** marcado. Sube primero el instalador y después `latest.json`.
6. **Después de publicar:**
   - `LAUNCHER.published = true` en `web/frontend/src/config/site.ts` y desplegar la web;
   - sacar `oculta: true` de `docs/manual/jugador/launcher.md` y sumar el link al launcher en `jugador/buscar-partida.md` (sección 4) y `capitan/jugar-pcw.md`, con el despliegue de la API (el manual lo sirve la API);
   - quitar "En preparación" del párrafo del launcher en `/privacidad` y `/terminos` (web y `.html`);
   - publicar el `CHANGELOG_DISCORD.txt`.

No toca la base, la API (salvo el manual), el VPS ni los servidores de juego.

### Hecho el 2026-11-26

- **Mezcla:** `feat/launcher` en `main` con el commit `42d600b4`, hecho en un worktree aparte. Solo chocó `docs/PENDIENTES.md`; se conservaron las dos secciones. Antes, la mezcla de prueba pasó typecheck, lint y 892 pruebas de la web, y 685 de la API con el manual validado (76 páginas).
- **Despliegue:** web y API `42d600b4da3d` con `desplegar.sh`, desde ese worktree limpio. `/launcher` responde 200.
- **`feat/frontend-fase-1`, sin copiar:** está 158 commits atrás de `main` y su worktree tiene cambios sin commit (Workers de Cloudflare).
- **Arreglos de Kyan** (`origin/claude/relaxed-einstein-sl0cme`, de `16aee34c` a `84840288`): merge `3ecf9f9e`. Configuración se ejecuta (un `const ipc` chocaba con el de Tauri), se abre fuera del evento de la bandeja y guarda aunque falle "Abrir con Windows"; el selector de carpetas pasa a `tauri-plugin-dialog` (sin permisos para la web en `capabilities/`, y sigue `is_local_dir`); la página `/launcher` completa (sigue sin publicar); el workflow, sin capturas. Revisado: no toca el VPS, la base, la API ni el manual, y no deshace la revisión del 2026-11-25. Pruebas de la mezcla: web 892, API 685 y manual validado. Web `3ecf9f9eae51` desplegada; la API no cambió (sigue `42d600b4da3d`). El instalador más nuevo es el de la corrida `45862228345` (`0364d6a1`; lo que viene después es solo documentación).
- **Llaves del actualizador:** `pnpm tauri signer generate` con contraseña al azar. La privada quedó en `~/.tauri/cmleague-launcher.key` de la PC de Daniel y la contraseña en `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` del `.env`. Se probó firmar un archivo con las dos. La pública va en `CMLEAGUE_UPDATER_PUBKEY`.

### Publicación (2026-11-26)

- **Build firmado:** el paso Instalador fallaba con "Missing comment in public key" (la configuración tenía `pubkey` vacía); desde `1c364bf6` el workflow arma `tauri.updater.ci.json` con `CMLEAGUE_UPDATER_PUBKEY`. Corrida `45872709951`: Instalador, Abre y no se cierra y `latest.json`, bien.
- **Prueba de Daniel:** instaló ese build y anduvo todo.
- **Publicado:** Run workflow con **Publicar en R2** (corrida `45874714707`). `latest.json` y `CMLeague_0.1.0_x64-setup.exe` responden 200 en `descargas.cmleague.lat`, con CORS para `https://cmleague.lat`. El DNS del subdominio tardó un rato en llegarle a la PC de Daniel.
- **Paso 8:** `LAUNCHER.published = true`, `jugador/launcher.md` visible con su link en `buscar-partida.md` y `capitan/jugar-pcw.md`, legales sin "En preparación", changelog 2.9.76. Web y API `0ae84c2803a1`. En producción, `/launcher` muestra **Descargar para Windows** con la versión 0.1.0.
- **0.1.1 (2026-11-27):** los arreglos del tema de la tienda de Kyan (`c6affc2c`, `b38802ec`, `f132188c`; web `f132188c3fe9` desplegada a las 05:14 UTC) y las demos a `<ClientMod>\cstrike` (`8d3bc3a3` de `origin/claude/relaxed-einstein-sl0cme`, traído como `6cacc6b3`; sin `12c078c4`, que es solo de la prueba). Versión 0.1.1 en `c23e71b6`, changelog 2.9.76 al día. Web: typecheck, lint y 906 de 906. Web `c23e71b6226d` desplegada (`/privacidad`). Corrida con **Publicar en R2**: `45950710840`, bien; `latest.json` dice 0.1.1 (06:21 UTC) y `CMLeague_0.1.1_x64-setup.exe` responde 200. API `1609bf8d51db` (el manual `jugador/launcher.md`) a las 06:21 UTC, decidido por Daniel con una sala en vivo: la sala terminó bien.
- **Accesos en la web** (Daniel): **Launcher** en el menú lateral y la búsqueda, y **Descargar el launcher** en el menú de la cuenta, solo fuera del launcher (`showLauncherLinks`, commit `4751f05f`).

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

### `+connect` en `Params=` (Daniel, 2026-11-26)

- Con `+connect 190.104.34.3:27065` al final de `Params=` y PLAY en `CMLauncher.exe`, el juego **se conectó solo** (`Connecting to 190.104.34.3:27065... Connected`). Funciona.
- La ventana de CMLauncher con el juego cerrado se llama **"ClientMod Launcher"**: no se confunde con `CS:S v34 ClientMod`.
- El SourceTV del #1 lo echó con **"Bad spectator password"**: pide contraseña. Ningún `.cfg` del repo ni `server.cfg`, `autoexec.cfg`, `warmup.cfg`, `live.cfg`, `live_mm.cfg` y `csstv_reporter.cfg` del #1 ponen `tv_password`. **Ver en TV** se arma sin contraseña, en la web y en el launcher, así que hoy falla en los dos. **Resuelto el 2026-11-26:** Daniel eligió SourceTV público. Por consola, solo el #1 tenía `tv_password` (puesta a mano, ningún archivo la tenía); se borró en vivo y se sumó `tv_password ""` después de `tv_port` en el `server.cfg` de #1, #2 y #3 (copia de antes guardada, verificado byte a byte), así se borra en cada cambio de mapa aunque alguien la vuelva a poner.

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
- **Descargas en el R2 de Daniel** (`descargas.cmleague.lat/launcher/`), no en el VPS: decidido por Daniel el 2026-11-25. La rama de Kyan las servía desde `/srv/cmleague/descargas` con un cambio al `Caddyfile`, que no se trae.
- **"Conectar" en el navegador** copia el `connect` en lugar de `steam://connect`. El plan lo proponía como una preferencia "Tengo el launcher"; se hizo sin preferencia: dentro del launcher abre el juego y fuera copia.
- **La guía de la primera vez** no enlaza al launcher. Está en tres idiomas y no se tradujo. Lo enlazan Jugar y el manual.
- **Barra de título nativa con colores** (Windows 11) en lugar de una barra propia, para no tocar el diseño de la web.

## Incidentes durante las pruebas

- **2026-11-25: el launcher no abría.** `tauri-plugin-updater` exige `pubkey` en su configuración y, sin ella, la app se cerraba al arrancar sin mostrar nada. Se arregló con tres cambios:
  - `plugins.updater` vacío en `tauri.conf.json`;
  - el plugin se registra solo con la clave;
  - `error.log` en `%LOCALAPPDATA%\lat.cmleague.launcher\`.

  Además se sumó la prueba "Abre y no se cierra".
- **2026-11-26: Configuración no guardaba ni abría el selector de carpeta, sin ningún error** (Kyan, en su PC). La causa: Tauri define `window.ipc` en todas sus ventanas y `ajustes.html` declaraba `const ipc` global, lo que da "Identifier 'ipc' has already been declared" y hace que el navegador descarte **todo** el script. La ventana se veía, pero no leía, no guardaba, no abría el selector y no podía mostrar errores. No se veía antes porque la prueba en el navegador no tiene `window.ipc` y la autoprueba de GitHub guardaba con su propio código. Se arregló con el script en su propio bloque y la variable como `tauri`, reproducido y probado con un `window.ipc` como el de Tauri. En el camino:
  - **Elegir carpeta** usa el selector nativo (`tauri-plugin-dialog`, encima de Configuración) en lugar del de PowerShell con un dueño invisible, que podía no aparecer.
  - `settings_set` guarda todo aunque falle **Abrir con Windows** (registro); esa opción queda como estaba y se avisa solo de eso.
  - Configuración se abre fuera del evento de la bandeja (`open_settings_later`) y `settings_open` es async.
  - La página dice "Conectado al launcher", avisa si un pedido no tiene respuesta en 8 s y muestra sus errores arriba. Guarda en `window.__traza` cada pedido al launcher.
  - La autoprueba de GitHub ahora hace clic en los interruptores de la página (espera a que cargue) y anota lo que muestra (`autoprueba.txt`).
  - GitHub Actions ya no saca capturas: solo cuando Kyan las pida.
- **`ring` no compila** con el chequeo para Windows desde Linux, porque le falta el compilador de C. Se usa TLS nativo (`native-tls`) en el actualizador.
- **La red de este entorno bloquea `cmleague.lat`** y el almacenamiento de los artefactos de GitHub, así que las capturas de Windows no se pudieron ver desde acá.

## Cómo revertir

- **Web:** revertir los commits del launcher en `web/frontend`, o volver a desplegar la versión anterior con `desplegar.sh` (guarda 5). Fuera del launcher, lo único que cambia es el "Conectar" del navegador.
- **R2:** borrar `launcher/latest.json` del bucket: los instalados dejan de ver versiones nuevas.
- **Launcher:** dejar de publicar `latest.json`. Los instalados siguen funcionando, sin actualizarse. Para sacarlo de una PC, se desinstala desde Windows.
- **GitHub:** borrar `.github/workflows/launcher.yml` y las claves.
