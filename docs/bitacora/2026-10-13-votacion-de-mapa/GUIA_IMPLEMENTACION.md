# Votación de mapa para jugadores: guía de implementación

## Estado

Desplegado el 2026-10-13: 1.7.0 probada con bots y por Daniel con su cliente en el servidor local, y subida al servidor real (se carga en el próximo cambio de mapa). **Pendiente:** confirmar con `sm_csstv_status` en el servidor real que dice `v1.7.0`.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv/maps.inc` | Nuevo: `!rtv`, `!unrtv`, `!vote`/`!nominate`, `!mapas`/`!maps`, `rtv` en el chat, conteo, menú de mapas, votación y cambio de mapa. |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | Versión 1.7.0. `#include`, `Maps_Init()`, `Maps_OnMapStart()`, `Maps_OnClientDisconnect()`, `Maps_OnMatchStart()` en `StartMatch()`, y `!live`/`!ready` no arrancan si el mapa está por cambiar. |
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | Compilado 1.7.0 (83946 bytes, md5 `5ca8c752f715e17dae2169d1c307243c`). |
| `server/cfg/sourcemod/csstv_reporter.cfg` | Sección nueva con las cvars `csstv_rtv*`. |
| `docs/GUIA_SERVIDOR.md` | Comandos nuevos y sección "Votación de mapa". |
| `docs/bitacora/2026-10-13-votacion-de-mapa/pruebas/escenarios.sh` | Escenarios de prueba con bots. |

No hay cambios en Supabase ni en la web.

## Despliegue (hecho el 2026-10-13)

Hecho: por SFTP (`paramiko`, entorno virtual aparte) se verificó que el `csstv_reporter.smx` del servidor era la 1.6.0 (76521 bytes, md5 `3848f0edde3d945e4432be2f8229fb61`), se movió a `plugins/disabled/csstv_reporter_1.6.0.smx` y se subió la 1.7.0 (83946 bytes, md5 `5ca8c752f715e17dae2169d1c307243c`, verificado descargándola de nuevo). El cfg y el `mapcycle.txt` del servidor no se tocaron. No se recargó el plugin.

Pasos de referencia:

1. Por SFTP, como en las versiones anteriores: respaldar `plugins/csstv_reporter.smx` del servidor real como `plugins/disabled/csstv_reporter_1.6.0.smx` y subir el nuevo. Si el servidor usa un `.smx` licenciado, compilarlo con `server/build_licenciado.sh <uuid> <nombre>`.
2. Opcional: agregar al `cfg/sourcemod/csstv_reporter.cfg` del servidor la sección de las cvars `csstv_rtv*`. Sin ella se usan los valores por defecto, que son los mismos.
3. Opcional: si se quiere que `de_dust2` se pueda votar, agregarlo al `mapcycle.txt` del servidor (o armar una sección `csstv` en `maplists.cfg`).
4. Se carga en el próximo cambio de mapa (`sm plugins reload csstv_reporter` cancela la partida en curso). Verificar con `sm_csstv_status` que diga `v1.7.0`.

## Pruebas

### Servidor local con bots (`$2000$`, `csstv_send 0`, compilado con `CSSTV_DEBUG=`)

Con `CSSTV_DEBUG` los bots cuentan como votantes. Cada comando se manda como si lo escribiera un bot con `csstv_debug_fakecmd`, y se verifica en el log del chat. Escenarios en [`pruebas/escenarios.sh`](pruebas/escenarios.sh), con 5 bots (hacen falta 3 votos).

| Escenario | Resultado |
|---|---|
| `!rtv`, repetido, `say rtv`, `!unrtv` | "quiere cambiar de mapa (1/3)", "Ya pediste cambiar de mapa (1/3)", "(2/3)", "ya no quiere… (1/3)" y "(0/3)" |
| `!vote zzz` | "No hay ningún mapa que coincida con "zzz"" |
| `!vote de_dust2` | Vota `de_dust2_ob` (`de_dust2` no está en la lista; es la única coincidencia) |
| `say !vote cache` y después `!nominate cache` | "vota por de_cache (1/3). Para cambiar de mapa: 1/3" y "Ya votaste por de_cache" |
| `!rtv` + `!vote mirage` + `!vote cache` | Llega a 3/3 y abre la votación. Sin humanos, SourceMod la cierra en el momento: "El mapa no cambia (nadie votó). Se puede volver a votar en 120 s." Después, `!rtv`: "Hubo una votación hace poco…" |
| Voto, `!live`, `!rtv`, `!cancelmatch`, voto | "El mapa solo se puede votar en el calentamiento"; después de cancelar, el voto nuevo cuenta "1/3" (el de antes de la partida se borró) |
| 3 × `!vote nuke` y `!live` enseguida | "de_nuke_old_blue_ep juntó los votos (3/3)", "Cambiando a… en 5 s", `!live` responde "El mapa está por cambiar"; el servidor cambia a `de_nuke_old_blue_ep` |
| `csstv_rtv_wait 30` en el mapa nuevo | "Se puede votar el mapa en 29 s." |

Sin errores del plugin en `errors_*.log`. Los que aparecen ese día son de `extremehost.smx`, el plugin del hosting.

### Con un cliente (Daniel, servidor local)

Daniel lo probó con su cliente el 2026-10-13 antes de pedir el despliegue. Lo que había que cubrir:

- El menú de votación de verdad: elegir un mapa, "No cambiar" y el empate. Con un solo humano conectado hace falta 1 voto, así que `!rtv` abre la votación enseguida.
- El menú de `!mapas` y el filtrado de `!vote inferno`.
- `!vote <pregunta>` de un admin con permiso de voto, que tiene que seguir yendo a `basevotes`.

## Mapas del servidor real en el servidor local

Para probar con los mismos mapas, se bajaron por SFTP (credenciales `SFTP_CSS_*` del `.env`, script con `paramiko` en un entorno virtual aparte) al servidor local `E:\CSS DEDICATED SERVER\server\cstrike`:

- `maps/`: `.bsp` y `.nav` de `de_cache`, `de_dust2_ob`, `de_inferno_classic`, `de_mirage_rc1`, `de_nuke_old_blue_ep`, `de_season` y `de_tuscan`. `$2000$`, `de_cbble`, `de_dust2` y `de_inferno` ya estaban, con el mismo tamaño.
- Contenido custom que no estaba: `materials/rxg`, `models/rxg` y `sound/replaced_sounds` (5 MB).
- `mapcycle.txt` del servidor real. El original del local quedó en `mapcycle_original.txt`.

Durante la descarga el servidor real cortó la conexión y no respondió por unos minutos (timeout al conectar). Se reanudó después sin problemas, y cada archivo se verificó por tamaño.

## En qué se apartó del plan

- Si el menú de votación no se puede mostrar (no hay humanos), se cuenta como "No cambiar" en lugar de reintentar: reintentar cada 5 s quedaba en un ciclo infinito.
- `!vote` ya era un comando de `basevotes.smx` (`sm_vote`, votación de admin). Se intercepta con un listener y se deja pasar a `basevotes` solo cuando lo usa un admin para algo que no es un mapa.
- En el menú de `!mapas`, el voto propio se marca con "- tu voto" (la fuente de v34 puede no tener el símbolo ✓).

## Cómo revertir

- **Servidor real:** volver a poner `plugins/disabled/csstv_reporter_1.6.0.smx` como `plugins/csstv_reporter.smx` y cambiar de mapa. Las cvars `csstv_rtv*` del cfg se pueden dejar.
- **Código:** revertir el commit (o borrar `csstv/maps.inc` y las llamadas `Maps_*` del `.sp`).
- **Servidor local:** `mapcycle_original.txt` → `mapcycle.txt`, y volver a instalar el `.smx` 1.6.0 compilado desde git.
