# Configurar el portátil como máquina de render de los clips

Guía para la sesión de Claude Code que corre **en el portátil de Daniel**. Léela entera antes de empezar.

## Contexto

El portátil queda prendido y graba solo los videos de las jugadas destacadas de cada mix. Una tarea programada de Windows corre `render/procesar.py` cada 10 minutos, y en cada corrida:

1. pide a Supabase las jugadas sin video;
2. baja la demo del Worker de demos;
3. graba cada jugada con una copia de ClientMod (abre el juego, escribe en su consola y usa `startmovie`) y la pasa a `.mp4` con FFmpeg;
4. sube cada video a R2 (cuenta de Cloudflare de Daniel) y a Google Drive, y lo ata a su jugada en la base.

Todo eso ya está hecho y probado en la PC de Daniel. Esta sesión solo **instala, configura, prueba e instala la tarea**.

**Documentación** (leerla solo si hace falta):
- `docs/bitacora/2026-10-23-clips-render-automatico/DOCUMENTACION.md` (cómo funciona);
- `GUIA_IMPLEMENTACION.md`, en la misma carpeta (pasos, incidentes y cómo revertir);
- `docs/bitacora/2026-10-23-clips-video/DOCUMENTACION.md` (cómo se maneja el juego).

## Reglas

- **No muestres nunca valores del `.env`.** Para comprobar una variable, imprime solo si está y cuántos caracteres tiene.
- **No instales nada por tu cuenta** (Python, FFmpeg, paquetes): pídeselo a Daniel con el comando exacto. Los scripts de `render/` usan solo la biblioteca estándar de Python.
- **El `.env` y `render/config.json` no se versionan.** No los agregues a git ni los copies a otra carpeta del repo.
- **No commitees ni hagas push** salvo que Daniel lo pida (Conventional Commits en español).
- **Lo que necesita administrador lo corre Daniel:**
  - `render_clip.py` y `procesar.py` se elevan solos con un aviso de UAC, que tiene que aceptar Daniel;
  - `instalar_tarea.ps1` se corre en una PowerShell abierta como administrador.
- **Mientras el juego graba, nadie usa el portátil:** el juego abre una ventana y el script le escribe en la consola.
- **Base de datos:** es la de **producción**. Desde esta máquina solo se usan las funciones del render (con el token) y lecturas públicas. No toques nada más.

## 1. Repo al día

Todo esto está en la rama `feat/backend-api-fase-1` (no en `main`):

```
git fetch
git checkout feat/backend-api-fase-1
git pull
```

Comprueba que existan:
- `render/procesar.py`, `render_clip.py`, `leer_demo.py`, `r2.py`, `drive.py`, `instalar_tarea.ps1` y `config.example.json`;
- en `render/leer_demo.py`, el arreglo del intervalo de tick (busca `playback_ticks` en `leer_demo.py`: tiene que aparecer en un `if not self.tick_interval`). Sin ese arreglo, la demo del primer mix (cbble) graba tramos mal calculados. Si falta, avísale a Daniel: está en la PC, sin commitear.

## 2. Python y FFmpeg

| Qué | Cómo comprobarlo | Si falta |
|---|---|---|
| Python 3.12 o más nuevo, de python.org | `python --version` y que exista `pythonw.exe` junto a `python.exe` (`(Get-Command python).Source`) | Daniel lo instala desde python.org. El de la Microsoft Store **no sirve**: la tarea necesita el `pythonw.exe` real (`instalar_tarea.ps1` lo rechaza) |
| FFmpeg | `ffmpeg -version`. Si la terminal no lo ve, búscalo en `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_*\*\bin\ffmpeg.exe` | Daniel corre `winget install Gyan.FFmpeg`. En `config.json` va la **ruta completa** a `ffmpeg.exe` (la tarea no ve el PATH de la terminal) |

## 3. ClientMod

Daniel instaló un ClientMod limpio en el portátil. Pregúntale dónde está.

Esa carpeta tiene que tener `CMLauncher.exe`, `clientmod.ini` y `cstrike/`.

1. **Abrir el juego una vez a mano (Daniel):** con el launcher, botón PLAY, entrar al menú y salir. Eso crea su configuración y la clave del registro `HKCU\Software\CSSv34_ClientMod`, que el script respalda y restaura en cada corrida. Compruébalo con `reg query "HKCU\Software\CSSv34_ClientMod\Settings"`.
2. **`clientmod.ini`** tiene que tener una línea `Params=…`. El script la reemplaza durante la grabación y la restaura al final.
3. **Mapas:** una demo solo se reproduce si su mapa está en el cliente, en alguno de estos tres lugares:
   - los del juego (`de_dust2`, `de_cbble`…), dentro de `cstrike/cstrike_*.vpk`;
   - los que baja ClientMod de los servidores, en `cstrike_downloads/maps/` (con sus `materials`, `models` y `sound` en la misma carpeta);
   - otros sueltos, en `cstrike/maps/`.

   Una instalación limpia no trae los de la liga (`de_tuscan`, `de_season`, `de_cache`, `de_mirage_rc1`, `de_nuke_old_blue_ep`…). El script del final de esta guía compara los mapas de las últimas partidas con los del cliente. Si faltan, Daniel tiene dos opciones:
   - copiar desde su PC las carpetas `D:\CMLeague_Render\ClientMod\cstrike_downloads` y `D:\CMLeague_Render\ClientMod\cstrike\maps` encima de las del portátil;
   - o entrar una vez al servidor de la liga con este cliente y pasar por esos mapas.

   Sin el mapa, la sesión espera la carga 10 minutos y la jugada falla.
4. **La consola** la activa el propio script (`con_enable 1` y la tecla de al lado del 1, en `cmleague_render.cfg`). No hace falta tocar nada.

## 4. `.env` reducido

Daniel copia a mano, desde la PC, un `.env` en la **raíz del repo del portátil** con solo estas 12 variables (no el `.env` entero: el de la PC tiene accesos a los servidores, al FTP y al panel):

```
RENDER_SUPABASE_URL  RENDER_SUPABASE_KEY  RENDER_WORKER_TOKEN
CF_ACCOUNT_ID_CLIPS  CF_API_TOKEN_CLIPS  CF_R2_BUCKET_CLIPS  CF_R2_ACCESS_KEY_ID_CLIPS  CF_R2_SECRET_ACCESS_CLIPS
GOOGLE_CLIENT_ID  GOOGLE_CLIENT_SECRET  GOOGLE_REFRESH_TOKEN
DISCORD_CLIPS_WEBHOOK
```

`DISCORD_CLIPS_WEBHOOK` es el webhook del canal de Discord donde se publican las 5 mejores jugadas de cada mix (bitácora `2026-10-24-clips-discord`).

El token de Drive sirve en cualquier máquina: no hace falta volver a correr `drive_login.py`. Comprueba que estén **sin mostrar los valores**:

```
python -I -c "import re;v=dict(l.strip().split('=',1) for l in open('.env',encoding='utf-8') if '=' in l and not l.startswith('#'));[print(k, 'ok' if v.get(k,'').strip() else 'FALTA') for k in 'RENDER_SUPABASE_URL RENDER_SUPABASE_KEY RENDER_WORKER_TOKEN CF_ACCOUNT_ID_CLIPS CF_API_TOKEN_CLIPS CF_R2_BUCKET_CLIPS CF_R2_ACCESS_KEY_ID_CLIPS CF_R2_SECRET_ACCESS_CLIPS GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REFRESH_TOKEN DISCORD_CLIPS_WEBHOOK'.split()]"
```

## 5. `render/config.json`

Copia `render/config.example.json` a `render/config.json` y cambia solo las rutas:

| Clave | Valor |
|---|---|
| `client_dir` | La carpeta de ClientMod del paso 3 |
| `work_dir` | Una carpeta de trabajo, por ejemplo `C:\CMLeague_Render\trabajo`: demos, registro y candado |
| `out_dir` | Por ejemplo `C:\CMLeague_Render\videos`. Los `.mp4` pasan por acá y se borran al subirse |
| `ffmpeg` | La ruta completa a `ffmpeg.exe` |

El resto se deja como está en el ejemplo:
- 1920x1080 a 60 cuadros;
- `"drive": true`, `"discord": true`, `"discord_top": 5`, `demo_worker_url`, `r2_days` 15, `gap_seconds` 15 y `lead_seconds` 0,5;
- `"crf": 23` y `"preset": "veryfast"`. Con otros valores, los videos pesan mucho más: el primer inferno salió con 40 MB para 14 s.

Necesita unos 5 GB libres en el disco de `client_dir` durante cada grabación: los cuadros TGA se escriben ahí y se borran enseguida.

## 6. Pruebas sin el juego

Desde `render/`:

```
python -I r2.py prueba
python -I drive.py prueba
python -I -c "import sys; sys.path.insert(0, '.'); import procesar; print(procesar.Api(procesar.load_env(procesar.DEFAULT_ENV)).rpc('clip_trash_list'))"
```

| Prueba | Resultado esperado |
|---|---|
| `r2.py prueba` | Subida 200, HEAD con el mismo tamaño, lectura igual, borrado 204 y después 404 |
| `drive.py prueba` | Un id de Drive, permiso `anyone`/`reader`, reproductor embebido 200 y borrado 204 |
| La tercera | `[]` (la papelera vacía). Un 401 es un problema del token |

**No llames a `clip_render_claim`** para probar: marcaría como "grabándose" las jugadas reales que esperan video.

## 7. Prueba con el juego (una jugada, a 1080p)

Usa la demo del primer mix con la 2.5.0. Es de `de_cbble`, que viene con el juego, así que no depende de los mapas de la liga:

```
mkdir C:\CMLeague_Render\demos_prueba
curl.exe -L -o C:\CMLeague_Render\demos_prueba\cbble.dem https://v34frag-demos.agusb06-ab.workers.dev/demo/srv1-20261023T234218-c364
python -I render_clip.py C:\CMLeague_Render\demos_prueba\cbble.dem --player "Old x roman" --ticks 230843,232390,233375,233649 --height 1080
```

- La demo pesa 32.551.718 bytes.
- Es el 4k de roman en la ronda 26: dos tramos, unos 12 s de video.
- El script se eleva (aviso de UAC: **lo acepta Daniel**), abre el juego, graba y lo cierra.
- La salida queda en `render/ultimo_render.log`. El `.mp4` y un `.json` con los tiempos quedan en `out_dir`.

**Verificar:**
- Que el video arranque con el arma en la mano, siga a "Old x roman" en primera persona y muestre las 4 kills en el feed.
- `tiempos.total_s` del `.json`. En la PC de Daniel (Ryzen 7 5700X, RTX 5070) una jugada parecida tardó 119 s a 1080p.
  - Si en el portátil pasa de unos 6 minutos, proponle a Daniel bajar a 720p (`"width": 1280, "height": 720`).
  - Cada partida tiene hasta 10 jugadas.

Borra el `.mp4`, el `.json` y la demo de prueba **solo después de que Daniel haya visto el video**.

## 8. Instalar la tarea

En una PowerShell **como administrador** (Daniel), en una sola línea (pegar dos líneas juntas en PowerShell falla). `-Python` hace falta si `python` en el PATH es otra versión (en el portátil quedó la 3.9 primero):

```
powershell -ExecutionPolicy Bypass -File <ruta del repo>\render\instalar_tarea.ps1 -Python "<ruta de python.exe 3.12 o más nuevo>"
```

- Crea la tarea "CMLeague clips": cada 10 minutos, con privilegios más altos, solo con la sesión iniciada, y sin arrancar otra corrida si la anterior sigue.
- Si avisa que el portátil se suspende, Daniel pone "Suspender" en **Nunca** con el cargador conectado (Configuración → Sistema → Energía). Bloquear la pantalla está bien; cerrar la sesión no.
- Comprobar: `Get-ScheduledTask -TaskName "CMLeague clips" | Get-ScheduledTaskInfo`.

**La primera corrida trabaja de verdad:** el mix de cbble (`srv1-20261023T234218-c364`) tiene 10 jugadas visibles esperando video.

- Seguir `work_dir\procesar.log`. Tiene que mostrar:
  - "Desfase de ticks del plugin a la demo: 0" (o un número chico);
  - las pasadas;
  - una línea por jugada con su duración, su peso y "y en Drive".
- Comprobar en la base con una lectura pública (la clave pública es `RENDER_SUPABASE_KEY`):
  ```
  GET <RENDER_SUPABASE_URL>/rest/v1/match_clip_list?select=position,type,player_name,video_status,video_key&match_id=eq.54456386-8d11-48cd-abf3-1572d4961861&order=position
  ```
  Las 10 tienen que quedar `done`.
- Abrir un video por el Worker: `https://cmleague-clips.cmleague.workers.dev/clip/<lo que va después de "clips/" en video_key>`.

## 9. Si algo falla

| Síntoma | Qué mirar |
|---|---|
| No aparece la ventana del launcher, o el juego no abre | Que `client_dir` apunte a la carpeta con `CMLauncher.exe`. El clic en PLAY se hace en la posición (785, 450) de una ventana de 890x500: si el launcher del portátil es de otra versión, puede caer fuera del botón |
| "no apareció 'Redownloading all lightmaps'" | Falta el mapa de la demo en `cstrike/maps/` (paso 3) |
| "la demo pasó de largo" o "se reinició dos veces" | Ver los incidentes de `GUIA_IMPLEMENTACION.md`. `gap_seconds` más grande separa más los tramos |
| "endmovie no cortó la grabación" | Ídem. El script ya reintenta. Mandarle a Daniel `procesar.log` y `ClientMod\cstrike\cmleague\render.log` |
| La resolución o la ventana de ClientMod quedó cambiada | El script restaura el registro desde `work_dir\registro.reg`. Si una corrida se cortó a mitad: `reg import <work_dir>\registro.reg` |
| Una jugada queda `failed` o `skipped` | El motivo está en `video_error` de `match_clips`. `skipped`: la demo ya no está, el jugador no aparece o su nombre tiene comillas o `;` |

### Mapas que faltan

Desde `render/`, con `config.json` ya armado. Busca cada mapa de las últimas 60 partidas en `cstrike/maps`, `cstrike_downloads/maps` y el índice de los `.vpk`:

```
python -I -c "import sys;sys.path.insert(0,'.');import json,os,urllib.request,procesar;e=procesar.load_env(procesar.DEFAULT_ENV);h={'apikey':e['RENDER_SUPABASE_KEY'],'Authorization':'Bearer '+e['RENDER_SUPABASE_KEY']};ms={m['map'] if m['map'].startswith(('de_','cs_','aim_','awp_')) else 'de_'+m['map'] for m in json.loads(urllib.request.urlopen(urllib.request.Request(e['RENDER_SUPABASE_URL']+'/rest/v1/matches?select=map&order=played_at.desc&limit=60',headers=h)).read())};c=json.load(open('config.json'))['client_dir'];vpk=open(os.path.join(c,'cstrike','cstrike_dir.vpk'),'rb').read();print('faltan:',sorted(m for m in ms if not any(os.path.exists(os.path.join(c,x,'maps',m+'.bsp')) for x in ('cstrike','cstrike_downloads')) and m.encode() not in vpk) or 'ninguno')"
```

(La base guarda algunos mapas sin el `de_`, como `cbble`, y el script se lo agrega. Si la base tiene un mapa con otro prefijo y el script lo marca como faltante por error, revisa a mano.)

## Al terminar

Resume para Daniel:
- qué quedó instalado y dónde (rutas de `config.json`);
- el tiempo de la prueba de 1080p;
- el resultado de la primera corrida de la tarea.

Si cambiaste algo del repo, avísale; no commitees sin que lo pida.
