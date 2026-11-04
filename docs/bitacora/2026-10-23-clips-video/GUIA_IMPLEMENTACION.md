# Video de los clips (fase C), prueba de concepto: guía de implementación

## Estado

Probado en la PC de Daniel el 2026-10-23: el 4k de Lukas en tuscan sale a 720p y a 1080p sin intervención (un aviso de UAC) y sube a R2. **Falta:** la prueba en el portátil, revisar los primeros cuadros de cada tramo y los nombres con comillas. Sin commit. Nada desplegado (no toca la base, el plugin, el backend ni los servidores).

## Archivos

| Archivo | Cambio |
|---|---|
| `render/leer_demo.py` | Nuevo. Lector de demos v34 |
| `render/render_clip.py` | Nuevo. Render de una jugada |
| `render/r2.py` | Nuevo. Cliente de R2 |
| `render/config.example.json` | Nuevo. Rutas y calidad |
| `render/.gitignore` | Nuevo. `config.json`, `__pycache__/`, `ultimo_render.log` |
| `docs/bitacora/2026-10-23-clips-video/` | Plan, documentación y esta guía |
| `docs/bitacora/README.md` | Fila del requerimiento |

## Preparar una máquina de render

1. **Copiar el cliente** a una carpeta aparte (en esta PC, `robocopy C:\CSSv34_ClientMod D:\CMLeague_Render\ClientMod /E /XD .idea docs`). El launcher no guarda la ruta en el registro: la copia arranca desde su carpeta.
2. **FFmpeg:** `winget install Gyan.FFmpeg` (lo instala el dueño de la máquina). En esta PC quedó en `C:\Users\danis\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_…\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe`; como la terminal no lo veía hasta reiniciarse, `config.json` usa la ruta completa.
3. **Python 3** (en esta PC, 3.14). Sin paquetes.
4. **`render/config.json`:** copiar `config.example.json` y ajustar `client_dir`, `work_dir`, `out_dir` y `ffmpeg`.
5. **Demo:** cualquier `.dem` de R2 (`https://v34frag-demos.agusb06-ab.workers.dev/demo/<external_id>`). El script la copia a `cstrike/cmleague/demos/`. El mapa tiene que estar en el cliente.
6. **`.env` de la raíz** (solo para subir a R2): las variables `CF_*_CLIPS`.

## Correr una prueba

```
cd render
python leer_demo.py "<demo.dem>" --clips
python render_clip.py "<demo.dem>" --player "Lukas" --ticks 234981,235042,235201,237919
python render_clip.py "<demo.dem>" --player "Lukas" --ticks 234981,235042,235201,237919 --height 1080
python r2.py prueba
```

Durante el render no hay que tocar la PC: el juego abre una ventana, el script escribe en su consola y lo cierra al terminar. La salida del proceso elevado queda en `render/ultimo_render.log`.

## Pruebas

### Lector de demos

- Demo de tuscan del 2026-10-22 (partida `6e0d4581-4e75-4603-8f88-a05fa2c92d2c`): kills por jugador contra `match_player_stats` de producción (lectura pública): **los 10 coinciden** (instt 44, musul 42, Lukas 32, boucher 27, yue 25, daniloev 25, JESHO 20, Xaby 17, mew 16, esenthial 15), y los 3k y 4k también.
- Errores: 2 paquetes de `instancebaseline`, sin kills perdidas.

### Render

| Corrida | Resultado |
|---|---|
| 1 (16:31) | El launcher pide clic en PLAY; los `wait` se cumplen antes de cargar la demo; `startmovie` no graba con la consola abierta. Se descubrió que existen todos los comandos y que la demo entera corre en unos 5 min |
| 2 a 4 | El launcher pide administrador (`WinError 740`); ClientMod bloquea alias recursivos; el bucle con `wait` traba la carga; el rescate con `playdemo` repetido colgó el juego |
| 5 a 7 | Elevado: el clic en PLAY funciona. Los cfg por paso no se ejecutan durante la demo (`sv_pure`); los atajos F9 y F10 no llegan (tampoco a mano) |
| Prueba manual de Daniel | La consola se abre; `cml_next` en la consola funciona; con `hidepanel specmenu`, F9 funciona. Conclusión: la barra del espectador se queda con el teclado |
| 8 (17:38) | Control por la consola: corre solo de punta a punta. El menú de ClientMod tapa el video y la cámara es de persecución |
| 9 (17:40) | Con `gameui_hide` y `spec_mode 3`: primera persona limpia, pero el primer tramo arranca antes de llegar al salto |
| 10 (17:42) | Espera del salto por el log: el primer tramo bien; el segundo se trabó buscando una kill que ya se había escrito |
| 11 (17:46) | La búsqueda desde el tramo anterior: **los dos tramos bien, 720p**. Primera kill a los 3,17 s |
| 12 (18:12) | **1080p**, con `overview_mode 0`: imagen limpia (solo la primera persona y el feed) |

### R2

`python r2.py prueba`: subida 200, lectura idéntica, borrado 204 y 404 después. El clip de 1080p (8,7 MB) subió en 2,4 s y se borró.

## En qué se apartó del plan

- **El código va en `render/`** y no en `pruebas/` (Daniel, al aprobar: para llevarlo fácil al portátil). Se anotó en el plan antes de empezar.
- **El script corre como administrador** y **maneja el juego por la consola**: el plan suponía `+exec` y esperas con `wait`, que no funcionan (ver la documentación).
- **No hizo falta medir el desfase de ticks a mano**: el lector da los ticks exactos del `.dem`, y C2 los toma de ahí.
- **Se sumó la subida a R2** (`r2.py`), que el plan dejaba para C2, para probar las credenciales de la cuenta de Daniel.
- **La prueba en el portátil y la del mix real con clips quedan pendientes**: no hubo ningún mix con la 2.5.0 al cierre.

## Incidentes durante las pruebas

- **Juego colgado (17:02):** para rescatar una corrida se escribió `playdemo` en el archivo de paso que el juego ejecutaba en bucle; corrió 46 veces antes de vaciarlo y el juego dejó de responder. Daniel lo cerró. No quedó nada roto.
- **El juego no se puede cerrar desde afuera** (acceso denegado): cuando una corrida falla con el juego abierto, Daniel lo cierra o el script lo cierra con `quit` por la consola.
- **El registro de ClientMod** quedó varias veces con 1280x720 en ventana al cerrarse el juego después de que el script restauró; se restauró a mano desde el respaldo de la sesión. Al cierre: 1280x1024, pantalla completa (el original de Daniel).

## Pendiente de C1

1. **Primeros cuadros de cada tramo:** el primer cuarto de segundo se ve sin el arma (la cámara todavía no está en primera persona). Probar a dar la cámara antes del salto o grabar unos cuadros de más y recortarlos.
2. **Nombres con comillas** (`"`): no entran en `spec_player "<nombre>"`. En C2 se sigue al jugador por el nombre de la demo; si tiene comillas, la jugada queda `skipped`.
3. **El portátil:** copiar el cliente, `render/`, Python y FFmpeg; medir 1080p.

## Cómo revertir

No hay nada desplegado. Para limpiar la PC: borrar `D:\CMLeague_Render\` (copia del cliente, videos y cuadros). La instalación normal de ClientMod (`C:\CSSv34_ClientMod`) no se tocó, salvo el registro compartido, que quedó como estaba.
