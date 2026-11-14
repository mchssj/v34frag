# Grabar los clips con el CS:S v34 normal: guía de implementación

## Estado

Implementado y commiteado el 2026-11-04 en `feat/frontend-fase-1`. **Probado con el juego en la PC de Daniel el 2026-11-13**, con los arreglos de la K y Ctrl (ver "Incidentes"), sin commit. El modo `"clientmod"` se comprobó sin abrir el juego (arma los mismos parámetros que antes). **El modo `"v34"` falta probarlo con el juego en el portátil**: en la PC no hay un v34 normal.

## Archivos

| Archivo | Cambio |
|---|---|
| `render/render_clip.py` | `Game` elige el cliente por `client`: `params()`, `find()`, `launch_v34()`, `running()` por `CMLauncher.exe` o `hl2.exe`, `taskkill` en `quit()` para `"v34"`, el respaldo del registro tolerante en `"v34"`. `find_window` acepta la clase de ventana |
| `render/config.example.json` | `"client": "clientmod"` |
| `render/probar_jugada.py` | Nuevo: graba una jugada por su id igual que `procesar.py`, pero solo en local (sin escribir en la base ni subir a R2, Drive o Discord). Para probar el v34 con el `clutch_3` de Matía en cache (`8c6db893-dd0c-4417-8e4d-517c69d490e0`), que había salido mal |
| `render/CONFIGURAR_PORTATIL.md` | Paso 3b (el v34 normal), `client` en la tabla del paso 5, dos filas en "Si algo falla" y el script de mapas que faltan sin exigir `cstrike_dir.vpk` |
| `docs/PENDIENTES.md` | Una línea en el punto 1.17 |

## Despliegue

No hay nada que desplegar en los servidores, la base ni la web. En el portátil (Daniel):

1. Llevar `render/` al portátil (con la tarea desactivada, si está instalada).
2. Abrir el v34 normal una vez a mano y buscar la clave del registro (`reg query HKCU\Software /s /f ScreenWidth`).
3. Copiar los mapas de la liga dentro de `C:\Program Files (x86)\CSS v34 eXpandedCS\cstrike\` (el contenido de `cstrike_downloads` de la PC también va ahí).
4. En `render/config.json`: `"client": "v34"`, `client_dir`, `launch_params` y `registry_key` (paso 3b de la guía).
5. Grabar una jugada con `render_clip.py` (paso 7 de la guía) y, si sale bien, volver a activar la tarea.

## Pruebas

### En la PC, sin el juego

- `python -I -m py_compile render_clip.py procesar.py`: OK.
- Con el `config.json` de la PC (`"client"` ausente): `clientmod`, `CMLauncher.exe` y `-novid -windowed -noborder -w 1920 -h 1080 +exec cmleague_render`, la misma línea `Params=` que antes.
- Con `"client": "v34"` y la ruta del portátil: `"C:\Program Files (x86)\CSS v34 eXpandedCS\hl2.exe" -game cstrike -novid -windowed -noborder -w 1920 -h 1080 -steam -appid 240 -32bpp -noipx -nojoy +exec cmleague_render`.
- `"client": "x"`: falla con el mensaje esperado.

### En el portátil, con el juego

Pendiente.

## En qué se apartó del plan

Ninguno.

## Incidentes durante las pruebas

- **2026-11-04, primera prueba en el portátil** (`probar_jugada.py` con el `clutch_3` de Matía en cache): el juego abrió y cargó la demo (cache quieto en el primer cuadro, por el `demo_pause` del cfg), pero el script se quedó esperando `Redownloading all lightmaps`. No se creó ningún log de la consola: ni `cstrike\cmleague\render.log` ni su copia en `VirtualStore`. El motor de la v34 normal no tiene `con_logfile`, que es de ClientMod. Arreglo: con `"v34"`, `-condebug` en la línea de comandos y el log en `cstrike\console.log`. Además, `wait_loaded` ya no depende solo de esa línea: espera `Playing demo from`, la línea de ClientMod hasta 30 s y, si no aparece, un paso de prueba por la consola, y copia al log del script las últimas líneas de la consola para ver qué escribe la v34.
- **2026-11-04, segunda prueba:** con `-condebug` el log ya aparece y la demo carga (`Playing demo from` y muchas líneas `hit surface has no samples`), pero la v34 no escribe `Redownloading all lightmaps` y el paso de prueba por la consola no respondía: la tecla no abría la consola. Arreglo: `-console` en la línea de comandos. El juego abre con la consola abierta; el primer paso la cierra con su tecla y se reenvía a los 5 s.

- **2026-11-13, primera prueba en la PC de Daniel** (el v34 de `E:\CSS v34 eXpandedCS`, `probar_jugada.py` con el 4k de spr en cbble, `35ce97f9`): el juego abría y cargaba la demo, pero no ejecutaba ningún paso, y la demo quedaba en pausa en el primer cuadro. Daniel encontró las dos causas probando a mano:
  1. al cargar la demo se abre el control del espectador, que se queda con el teclado y se cierra con Ctrl. Mientras está abierto no llega ni la tecla de la consola;
  2. el v34 no trae un bind para abrir la consola (se llega desde el menú, con Esc), y la tecla de al lado del 1 le llega como `\` con el teclado latinoamericano (escribe `|`). Con `bind "k" "toggleconsole"` la K la abre, pero no la cierra.

  En las pruebas previas (el juego abierto por un script, sin el script del render) no ejecutaba nada por ningún medio: la tecla con su código o como `` ` ``, F10, INS, el juego en primer plano, `WM_COPYDATA` y `SendInput`.

  Arreglo en `render_clip.py`, solo con `"client": "v34"`:
  - `bind "k" "toggleconsole"` en `cmleague_render.cfg`, y los pasos abren la consola con la K (`KEY_CONSOLE_V34`). Las cierran `hideconsole` y `gameui_hide`, que ya van en cada línea;
  - `wait_loaded` espera `Initializing renderer` (el v34 no escribe `Redownloading all lightmaps`; antes se esperaban 30 s de más), aprieta Ctrl y manda un paso de prueba que también oculta `specmenu` y `specgui`. Como Ctrl abre y cierra el control, cada reenvío del paso va con otro Ctrl (`step(before_retry=…)`).

  Resultado: 2 pasadas, 3 tramos (300, 778 y 300 cuadros en 9,4, 19,1 y 9,2 s, contra unos 26 s por tramo de 300 con ClientMod), 112 s de sesión, 17,1 MB (`D:\CMLeague_Render\videos\prueba_v34_cbble_spr.mp4`). La cámara sigue a spr, sin consola, menú ni control del espectador. Dos diferencias con ClientMod: en los primeros 0,3 s del primer tramo cruza una barra negra (seguramente el panel del espectador cerrándose; no se confirmó), y salen los íconos del chat de voz de la demo abajo a la derecha. Falta probarlo en el portátil, que es donde se deforman los polígonos.

## Cómo revertir

Poner `"client": "clientmod"` (o quitar la clave) en `config.json` y las claves de ClientMod. Para sacar el código, revertir el commit en `render/`.
