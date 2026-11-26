# Launcher de escritorio de CMLeague

Es la web de CMLeague (`https://cmleague.lat`) en una ventana propia, como el cliente de FACEIT. No es un anticheat. Tiene la misma sesión, las mismas secciones y el mismo matchmaking, más lo que el navegador no puede hacer:

- **Abrir ClientMod conectado a la sala.** En la web, "Conectar" (sala del matchmaking), "Volver a la partida" y "Entrar" (PCW) abren el juego en lugar de `steam://connect`, que no funciona con ClientMod. Agrega `+connect` y `+password` a `Params=` de `clientmod.ini`, abre `CMLauncher.exe` (con el aviso de UAC, nunca `hl2.exe`) y restaura el `.ini` cuando aparece el juego. Con el juego ya abierto, solo copia el `connect`. El `connect` siempre queda copiado.
- **Avisos de Windows** cuando aparece la partida o el servidor está listo (si la ventana no está a la vista), y la ventana al frente.
- **Bandeja con el estado:** el ícono dice qué estás haciendo ("Buscando partida · 5v5"), tiene **Aceptar partida** cuando aparece una, Configuración, la actualización pendiente y Salir. Doble clic abre la ventana. La X manda a la bandeja.
- **Discord Rich Presence:** "Buscando partida", "Jugando 5v5 · de_dust2 · 9-7", con el tiempo.
- **Actualización automática:** busca al abrir y cada 6 horas, avisa, y se instala cuando el jugador lo elige (bandeja o Configuración), así nunca corta una partida.
- **Tema de la tienda:** si el jugador lo prende, el launcher (la web y la barra de título) usa uno de sus temas: el equipado en el perfil o el que elija en **Perfil › Preferencias › Tema del launcher** (esa tarjeta solo aparece en el launcher y lista solo los temas que tiene).
- **Una sola instancia:** abrirlo de nuevo trae la ventana que ya está. `--ajustes` abre Configuración.
- **Links `cmleague://`:** `cmleague://play` o `cmleague://match/<id>` abren esa página de la web en el launcher (el instalador registra el protocolo). La página `/launcher` de la web tiene "Ya lo tengo: abrirlo".
- **Configuración propia** (bandeja › Configuración), guardada en la PC (`%APPDATA%\lat.cmleague.launcher\ajustes.json`), sin tocar la web ni la cuenta:

  | Opción | De fábrica |
  |---|---|
  | Abrir con Windows | No |
  | Arrancar en la bandeja (al abrirse con Windows) | Sí |
  | Cerrar a la bandeja | Sí |
  | Avisos de Windows | Sí |
  | Traer la ventana al frente | Sí |
  | Mostrar en Discord | Sí |
  | Tema de la tienda | No |
  | Buscar actualizaciones solo | Sí |
  | Carpeta de ClientMod | Se busca sola |

Plan: [`docs/bitacora/2026-11-24-launcher-escritorio/PLAN.md`](../docs/bitacora/2026-11-24-launcher-escritorio/PLAN.md). Se cambió el enfoque después del plan: la interfaz aparte del plan se reemplazó por la web misma.

## Qué hay que encender en GitHub (Daniel)

Sin esto el launcher funciona igual, pero sin actualizaciones automáticas ni Discord. Va en el repo, **Settings › Secrets and variables › Actions**.

1. **Actualizaciones.** En una PC con el proyecto:
   ```bash
   pnpm tauri signer generate -w ~/.tauri/cmleague-launcher.key
   ```
   - El contenido de `cmleague-launcher.key` va al secreto `TAURI_SIGNING_PRIVATE_KEY` (y la contraseña, si se puso, a `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`). **No se commitea ni se comparte.** Si se pierde, los launchers instalados no aceptan más actualizaciones y hay que reinstalar.
   - El contenido de `cmleague-launcher.key.pub` va a la variable `CMLEAGUE_UPDATER_PUBKEY`.
   - Con eso, cada compilación deja en el artefacto el `.exe`, su `.sig` y `latest.json`.
2. **Publicar una versión:** subir la versión en `src-tauri/tauri.conf.json` y `src-tauri/Cargo.toml`, hacer push y, en GitHub › Actions › Launcher, **Run workflow** con **Publicar en R2** marcado. Sube el `.exe` y después `latest.json` al R2 de Daniel, que se ve en `https://descargas.cmleague.lat/launcher/` (decidido por Daniel el 2026-11-25). De ahí leen la actualización automática y la página `/launcher` de la web. Hace falta, una vez:
   - en Cloudflare, el bucket con el dominio `descargas.cmleague.lat`, CORS con `GET` desde `https://cmleague.lat` y un token de R2 que solo escribe en ese bucket;
   - en GitHub, las variables `R2_ACCOUNT_ID` y `R2_BUCKET`, y los secretos `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`.
   Después de la primera, `LAUNCHER.published = true` en `web/frontend/src/config/site.ts`.
3. **Discord.** En <https://discord.com/developers/applications>, crear la aplicación "CMLeague", subir en Rich Presence › Art Assets el isotipo con el nombre `cmleague`, y poner su Application ID en la variable `CMLEAGUE_DISCORD_APP_ID`.

## Cómo se conecta con la web

- La ventana abre `https://cmleague.lat/play` (`src-tauri/src/lib.rs`, `WEB_URL`). `local/` tiene las páginas propias: `ajustes.html` (Configuración) e `index.html`.
- La web detecta el launcher (`web/frontend/src/lib/launcher.ts`) y llama a los comandos nativos por el IPC de Tauri. Fuera del launcher no cambia nada.
- Solo `https://cmleague.lat` y `www` pueden usar los comandos del launcher, y solo los de `src-tauri/capabilities/web.json`: abrir el juego, contar el estado, traer la ventana, pintar la barra con el tema y abrir Configuración. La web **no** puede leer ni cambiar la Configuración: eso solo lo hace la ventana local (`capabilities/ajustes.json`). La dirección y la contraseña se validan en Rust: no pueden meter otro comando en la línea del juego.
- La carpeta de ClientMod se busca en las rutas comunes (`C:\CSSv34_ClientMod`, `C:\ClientMod`, …). Si no aparece, se abre una vez el selector de carpetas de Windows (`game_pick_dir`) y queda guardada. Nadie le manda una ruta, ni la web ni Configuración, y solo valen carpetas de un disco de la PC: `CMLauncher.exe` se abre como administrador.
- No hace falta tocar la API ni `CORS_ORIGINS`: la web carga desde su propio dominio, como en el navegador.

## Pendiente de confirmar

- **Cómo se reconoce el juego abierto.** Con ClientMod no hay `hl2.exe`: el juego y cinco procesos de ayuda corren como `CMLauncher.exe`. El juego es el que tiene la ventana `CS:S v34 ClientMod` (visto en la PC de Agus el 2026-11-24, dentro de un servidor). Falta ver el título de la ventana del launcher con el juego cerrado.
- **Si `CMLauncher.exe` toma `+connect` desde `Params=`.** Falta probarlo a mano.
- Los cambios de la web (`web/frontend/src/lib/launcher.ts`, `features/launcher/` y los botones) tienen que estar desplegados en `cmleague.lat` para que "Conectar" abra el juego, para el estado de la bandeja y para el tema.

## Compilar

El instalador lo arma GitHub Actions en Windows (`.github/workflows/launcher.yml`) y queda como artefacto `cmleague-launcher-windows`. En una PC con Windows, Rust y las Build Tools de Visual Studio (C++):

```bash
pnpm install --frozen-lockfile
```

```bash
pnpm build
```

Para probar contra una web local, cambia `WEB_URL` en `src-tauri/src/lib.rs` (por ejemplo `http://localhost:5173/play`) y suma ese origen en `capabilities/web.json`.

## Pruebas

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```
