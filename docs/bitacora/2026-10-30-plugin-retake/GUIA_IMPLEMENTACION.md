# Plugin de retake: guía de implementación

## Estado

Subido a `aurav34` (`45.235.98.57:27062`) como servidor solo de retake el 2026-10-30 y jugado con gente real. Probado con bots en `cssds`. **No está en RBK ni en `FLOW_SERVER`.** Sin commit.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/v34_retake.sp` | Nuevo: modo, rondas, equipos, cola y VIP, C4, avisos |
| `server/addons/sourcemod/scripting/retake/spawns.inc` | Nuevo: puntos por mapa y comandos |
| `server/addons/sourcemod/scripting/retake/guns.inc` | Nuevo: `!guns` y AWP |
| `server/addons/sourcemod/scripting/retake/vote.inc` | Nuevo: votación de mapa |
| `server/addons/sourcemod/scripting/retake/rank.inc` | Nuevo: ranking, `!rank` y `!top` |
| `server/addons/sourcemod/scripting/retake/chat.inc` | Nuevo: colores del chat |
| `server/addons/sourcemod/configs/retake/de_dust2_ob.cfg` | Nuevo: spawns reales cargados en el juego |
| `docs/bitacora/2026-10-30-plugin-retake/pruebas/retake_spike.sp` | Prueba de la bomba plantada |
| `docs/bitacora/2026-10-30-plugin-retake/pruebas/analizar_log.py` | Verifica las reglas en el log de la build de depuración |
| `docs/PENDIENTES.md`, `docs/bitacora/README.md` | Estado y fila del índice |

## Despliegue (hecho el 2026-10-30)

Solo a `aurav34`, porque así lo pidió Kyan. Es una excepción a la regla de `CLAUDE.md` de desplegar a todos los servidores en la misma tanda, y a la de no llevar `.smx` genérico a terceros si llegara a RBK: este plugin no lleva licencia.

1. Compilar sin depuración, con `spcomp` y los includes de SourceMod:

```bash
spcomp v34_retake.sp -i<includes> -ov34_retake.smx
```

2. Subir por la API del panel, comprobando que el archivo quedó idéntico:

| Archivo | Destino |
|---|---|
| `v34_retake.smx` (md5 `d7b012bfe832b3aeb91055d6994bdb73`) | `cstrike/addons/sourcemod/plugins/` |
| `de_dust2_ob.cfg` | `cstrike/addons/sourcemod/configs/retake/` |

3. En `cstrike/cfg/sourcemod/v34_retake.cfg`: `sm_retake_autostart "1"` y `sm_retake_t_streak "2"`.
4. Reiniciar o cambiar de mapa. El panel tiene `MAP = de_dust2_ob`, y ese mapa tiene que tener spawns para que el modo se prenda.

**Otros cambios en servidores el mismo día, pedidos por Kyan:**

| Servidor | Cambio | Respaldo |
|---|---|---|
| `aurav34` | `sv_password ""` en `server.cfg`, y comando enviado en vivo | `cfg/server.cfg.bak_pw` (tiene la contraseña vieja) |
| `aurav34` y RBK | `decalfrequency` de `0.1` a `60`, por el spam de grafitis | `cfg/server.cfg.bak_decal` |
| `FLOW_SERVER` | **Sin cambios:** no hay clave de panel y el SFTP cerró la conexión | — |

## Pruebas

### Con bots, en `C:\Users\Agus\Downloads\cssds`

Build de depuración, `analizar_log.py` y puntos de prueba generados con `retake_debug_gen`. Los resultados son de las corridas de cada función.

| Qué | Resultado |
|---|---|
| Bomba plantada desde un plugin | La entidad no explota: se descartó |
| Plantado automático | Funciona, también con un jugador real |
| Partida de 24 rondas | Sin errores de tipo de ronda, spawns repetidos ni AWP de más. Kits: 40 % en pistola y 85 % en full buy |
| Mezcla | En las rondas esperadas, y los equipos cambian de verdad. Con 2 bots, 3 de 3 con cambio |
| Mezcla con `sm_retake_t_streak 2` y 6 bots | En las rondas 3 y 6 |
| Cola y VIP | Entra el VIP, sale un no VIP, que queda primero en la cola. Sin VIP nadie entra hasta que haya lugar |
| Votación sin votos | Sigue en el mapa con una partida nueva |
| Cambio de mapa con el modo prendido | Sigue prendido |
| Límite de sitio | `AABBAABAAB`, nunca 3 seguidas |
| Desactivación al instante con kit | Termina la ronda en el mismo segundo, 4 de 4 |
| Sin kit y con menos de 10 s | Avisa "no llega" y explota |
| Soltar la C4 mientras se planta | Bloqueado, en 6 rondas sin fallas |
| Rechazo con un mix en vivo (reporter 1.7.0) | Rechazado |
| `sm_retake_autostart` desde el cfg | Prende el modo |
| `mp_timelimit` | 0 con el modo prendido, y vuelve al valor anterior |
| Ranking | Los puntos cuadran con las bajas y quedan en el archivo |

### Con jugadores reales

| Qué | Dónde | Resultado |
|---|---|---|
| Entrar a un equipo desde la cola | `cssds` | No tira el servidor |
| Plantado automático | `cssds` | Funciona |
| Desactivación al instante, +8 puntos y resumen de daño | `aurav34` | Funciona. Visto en una captura |
| Autostart, mezcla y rotación | `aurav34` | Funcionan, según el log |

### Sin probar o sin confirmar

- Sin kit y con tiempo suficiente: los bots nunca llegaron a tiempo. Es la misma cuenta que con kit.
- El aviso de rotación al ganar los CT: en la prueba no ganó ningún CT.
- El arreglo de la barra de progreso, el bloqueo del menú de modelos, el resumen corto y la plata en 0: hacen falta jugadores reales y no recibí confirmación.
- Sorteo de AWP con un solo anotado: salió 11 de 22 (50 %, objetivo 30 %). El código es una sola comparación y esa desviación pasa alrededor de 2 de cada 100 veces por azar, pero la muestra es chica.
- `!guns` guardado al reconectar, `!top` y `!rank` con páginas, y la votación con votos reales: no recibí confirmación.
- VIP y cola con personas, AFK con personas.
- Convivencia con el reporter 1.8.0 y con `csstv_sell`, `csstv_perf`, `csstv_calladmin` y `csstv_allchat`.

### Agregado el 2026-10-31

Probado con 8 bots en 14 rondas (`de_dust2_ob`, force al 50 %). `csstv_reporter` se movió a `plugins/disabled/` en `aurav34`.

| Qué | Resultado |
|---|---|
| Rondas force | Salen, con arma, sin casco y solo flash |
| AWP y Scout solo CT | Ninguna en T. Máximo una por ronda en CT |
| Sorteo de Scout en force | 4 de 4, con varios anotados |
| Aviso de clutch | Registrado 3 veces, con el lado T |
| Server vacío | Se destraba solo y vuelve a la ronda 1 |

**Sin probar:** las opciones MP5 y Solo Deagle, y la categoría de `!admin` con un jugador, el mensaje de bienvenida y el aviso al entrar solo. Sin SteamID real tampoco se probó `retake_scout`.

## En qué se apartó del plan

- **Bomba:** se usó la opción B. No hay `sm_retake_freeze`: el congelamiento dura lo que tarda en plantarse.
- **Punto de bomba:** cada sitio admite varios y se usa uno al azar.
- **Sitio:** no es del todo al azar: máximo 2 veces seguidas.
- **Votación:** se agregó la opción "Seguir en este mapa".
- **Agregado después del plan:**
  - Máximo de 5 por equipo, con cola y entrada directa para VIP.
  - Kit por probabilidad.
  - Ranking con `!rank` y `!top`.
  - Resumen de daño y avisos en pantalla.
  - Desactivación al instante.
  - `sm_retake_autostart`.
  - Bloqueo del menú de modelos y de soltar armas mientras se planta.
- **Mapas:** se cargó `de_dust2_ob` en lugar de `de_dust2` y `de_inferno`. Es el mismo mapa con otro cielo. Faltan los demás.
- **Despliegue:** solo a `aurav34`, no al real y RBK. Se subió antes de terminar las pruebas con admin, por decisión de Kyan, y el cambio de la AWP se subió sin probar por pedido suyo.

## Incidentes durante las pruebas

- **`joinclass 0` en un bot tiró `cssds`:** lo mismo con cualquier modelo. Se dejó solo para jugadores reales.
- **`sm_retake 1` se prendía con un mix en vivo:** `ServerCommandEx` devuelve vacío dentro de otro comando, y vacío se tomaba como "no hay mix". Ahora corre en un timer y, si no puede leer, asume que hay mix.
- **Primera desactivación al instante:** falló tres veces por propiedades que en v34 no existen o no funcionan.
- **`m_bInBombZone`:** rechazaba puntos válidos a un admin sin C4. Ahora se compara con `func_bomb_target`.
- **Soltar la C4:** provocaba un empate en `aurav34`. Se bloqueó.
- **Crash del cliente de Kyan al entrar a `cssds`:** no se encontró la causa. No se repitió en `aurav34`, hasta donde se informó.

`cssds` tiene `csstv_reporter.smx` en `plugins/disabled/`, porque ahí su cfg tiene `csstv_send 1`.

## Cómo revertir

En `aurav34`:

1. Poner `sm_retake_autostart "0"` en `cfg/sourcemod/v34_retake.cfg` o ejecutar `sm_retake 0`.
2. Mover `plugins/v34_retake.smx` a `plugins/disabled/` y cambiar de mapa.
3. Datos, si se quieren borrar: `configs/retake/`, `data/sqlite/v34_retake.sq3` y `cfg/sourcemod/v34_retake.cfg`.

Contraseña y grafitis: restaurar `server.cfg` desde `server.cfg.bak_pw` o `server.cfg.bak_decal`, teniendo en cuenta que `bak_pw` es posterior a `bak_decal`.
