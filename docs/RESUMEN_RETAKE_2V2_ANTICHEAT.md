# Retake, 2v2 y CMLeague Anticheat: documentación

Actualizado el 2026-10-31.

## Resumen

Retake está en un servidor real y se jugó con gente; 2v2 está subido e inactivo, sin probar con jugadores; el anticheat funciona solo en local y no se puede repartir todavía.

| Proyecto | Estado | Dónde corre | Rama |
| --- | --- | --- | --- |
| Retake (`v34_retake`) | Jugado con gente; quedan cosas por confirmar | `aurav34`, como servidor solo de retake | `kyan/pruebas` |
| 2v2 (`v34_wingman`) | Probado con bots; la compra sigue sin probar | `aurav34` y RBK, apagado | `kyan/pruebas` |
| CMLeague Anticheat | Probado en local con la conexión de Kyan | En ningún servidor | `kyan/anticheat-backend` y `kyan/anticheat-web` |

Los dos plugins son independientes de `csstv_reporter`, no llevan licencia y no envían nada a Supabase. No se prenden a la vez en un mismo servidor.

## Plugin de retake

Cada ronda arranca con la bomba plantada en un sitio: los T defienden y los CT entran a desactivarla. Lo prende un admin con `sm_retake 1`, o solo en cada mapa con `sm_retake_autostart 1`.

**La bomba se planta de verdad.** v34 no permite crearla desde un plugin porque nunca explota. Un T al azar aparece en el punto de bomba, los demás quedan congelados y el plugin aprieta el ataque unos 3 segundos.

| Regla | Valor |
| --- | --- |
| Partida | 30 rondas, con votación de mapa en la 25 |
| Rondas 1 a 5 | Solo pistola, chaleco sin casco, kit para el 50 % de los CT |
| Desde la 6 | Primaria y pistola, chaleco con casco, flash y smoke, kit para el 85 % |
| AWP | Por equipo: 1 anotado la recibe con 30 %; con 2 o más se sortea |
| Equipos | 40 % de T y hasta 5 por lado; el resto, en cola |
| Si ganan los CT | Los de más daño pasan a T y los T a CT |
| Si los T ganan seguido | Pasado `sm_retake_t_streak`, se mezclan al azar |
| Desactivar | Sin T vivos, termina al instante si llegaba a tiempo: 5 s con kit, 10 s sin kit |
| VIP | Entra al terminar la ronda y saca a un no VIP, que queda primero en la cola |
| AFK | Pasa a espectador tras `sm_retake_afk_rounds` rondas |
| Ranking | Por servidor: empieza en 1000; baja +6, cabeza +2, muerte −3, desactivar +8 |

| Comando | Para qué |
| --- | --- |
| `!guns` | Elegir armas; se guarda |
| `!rank`, `!top` | Puesto y ranking |
| `sm_retake 1` o `0` | Prender o apagar el modo |
| `sm_retake_bomb <a\|b>` | Agregar un punto de bomba |
| `sm_retake_spawn <a\|b> <t\|ct>` | Agregar un spawn |
| `sm_retake_delspawn` | Borrar el punto más cercano |
| `sm_retake_spawns` | Ver cantidades y dibujar los puntos |

**Despliegue:** en `aurav34` (`45.235.98.57:27062`) con autostart, `sm_retake_t_streak 2` y spawns solo de `de_dust2_ob`. No está en `FLOW_SERVER`, por decisión de Kyan.

**Probado:** con bots, una partida de 24 rondas, mezcla, cola y VIP, límite de sitio, desactivación y ranking. Con jugadores en `aurav34`: desactivación al instante, autostart, mezcla y rotación.

**Sin confirmar:** `!guns` al reconectar, `!top` y `!rank` con páginas, votación con votos reales, VIP y AFK con personas, barra de progreso, menú de modelos y convivencia con los otros plugins `csstv_*`. El sorteo de AWP con un solo anotado dio 50 % en vez de 30 %, sobre 22 sorteos.

Después de esa bitácora hay un commit más, `82014b7`, que avisa si no se pudieron guardar los puntos. No se confirmó si ya está en `aurav34`.

## Plugin 2v2

Es un modo con las reglas de Wingman de CS2: un solo sitio, primero a 9 y máximo 16 rondas. Lo prende un admin con `sm_2v2 1` o desde `!admin`, o solo con `sm_2v2_autostart 1`.

La partida sigue este orden:

1. **Calentamiento:** hasta 2 por lado, con plata de sobra y reaparición. Con los 4 en `!ready` empieza el cuchillo.
2. **Cuchillo:** el ganador elige con `!stay` o `!switch` en 20 segundos; si nadie elige, se queda.
3. **Primera mitad:** 8 rondas, y después cambio de lado.
4. **Segunda mitad:** hasta que alguien llegue a 9. Con 8-8 hay empate, sin prórroga.
5. **Fin:** a los 8 segundos vuelve al calentamiento.

| Regla | Valor |
| --- | --- |
| Ronda y bomba | 1:30 y 40 s |
| Freezetime y compra | 10 s y 20 s, contando el freezetime |
| Plata | $800 al inicio y al cambiar de lado; máximo $8000 |
| Bonificación por derrota | Apagada; se configura con `sm_2v2_loss_bonus` |
| Abandono | Si falta un jugador 2 minutos, se cancela |
| Al morir | Solo se mira al propio equipo, en primera persona |
| Voz | Por equipo durante la partida |
| Zonas prohibidas | Cajas que funcionan como paredes y siempre se ven |
| Ranking | `!rank` y `!top`, propio de cada servidor |

| Comando | Para qué |
| --- | --- |
| `!ready`, `!stay`, `!switch` | Empezar y elegir lado |
| `!pause`, `!unpause` | Pausa de equipo: 2 por partida, 60 s |
| `!forcepause`, `!forceunpause` | Pausa de admin |
| `sm_2v2_start` | Empezar como admin |
| `sm_2v2_site` | Marcar el sitio que se juega |
| `sm_2v2_spawn <t\|ct>`, `sm_2v2_delspawn` | Guardar o borrar spawns |
| `sm_2v2_zone1`, `sm_2v2_zone2`, `sm_2v2_delzone` | Marcar o borrar una zona |
| `sm_2v2_show` | Ver y dibujar lo cargado |

**Despliegue:** subido apagado a `aurav34` y a RBK. **RBK no tiene `de_dust2_ob`**, así que ahí no se puede prender, y tiene una versión anterior a la de `aurav34`. En `aurav34` hay que apagar el retake antes, y su autostart vuelve en cada cambio de mapa.

**Probado con bots:** cuchillo, cambio de lado, empate, victoria, sitio bloqueado, pausas, plata máxima y apagar el modo.

**Sin probar con jugadores:** **la compra fuera de la zona, que es lo más importante**, porque los bots no compran por comando. Tampoco el bloqueo de zonas, la cámara, la voz, `!admin`, `!ready`, el reemplazo y el abandono.

## CMLeague Anticheat

Es una aplicación de Windows, obligatoria en mixes, que junta evidencia para que la revise el staff, con la cuenta de `cmleague.lat`. Es independiente del EAC de ClientMod y no sanciona sola.

| Parte | Qué hace | Dónde |
| --- | --- | --- |
| Aplicación `CMLeagueAC.exe` | Consentimiento, vinculación por la web, latido, procesos, capturas, cola sin conexión, firma; instalador por usuario | `agent/` |
| API | Vincula, verifica token, firma, hash y JPEG; panel de evidencia | `web/backend/src/routes/anticheat*.ts` |
| Base | Sesiones, procesos, capturas, cadena y registro de accesos | `supabase/replanteo/39`, `40` y `41` |
| Bridge | Pregunta por cada jugador y aplica `allow` o `kick` en mixes | `server/.../cml_anticheat_bridge.sp` |
| Web | Vinculación y panel de admin | Rama `kyan/anticheat-web` |
| Cron | Borra a los 30 días, salvo lo conservado | `pnpm anticheat:tick` |

**Decisiones de Kyan:** independiente de EAC, inicio de sesión por la web, SteamID más IP, obligatorio en mixes, 30 días, perfil público solo con el estado, y RBK afuera por ahora.

**Qué recopila, solo durante una sesión:** capturas de la ventana del juego con el juego al frente, y programas abiertos con nombre, ruta, hash y firma. No lee memoria, no inyecta, no registra teclas y no se abre con Windows.

**Captura:** usa Desktop Duplication y, si falla, `BitBlt` de la pantalla. `BitBlt` de la ventana está prohibido porque devolvía imágenes congeladas.

**Expulsión:** el Bridge comprueba al entrar, al empezar un mix y cada minuto. Avisa, y a los 20 segundos expulsa si sigue sin sesión. No crea ban ni antecedente. Un admin puede abrir los mixes con `sm_ac_open <minutos>` o desde el panel.

**Integridad:** cada evidencia va en una cadena firmada por una clave propia del equipo. Prueba que nada cambió desde el envío, no que el equipo del jugador dijera la verdad.

## Pruebas del anticheat

El flujo completo se vio con la cuenta y el juego de Kyan, con la API y la base en local; la suite del backend pasó en su última corrida completa.

| Qué | Resultado |
| --- | --- |
| Vinculación por la web con una cuenta real local | Funciona |
| Sesión con el juego de Kyan | 362 procesos de inventario; captura pedida y automáticas por Desktop Duplication, a 1440x1080 |
| Captura sin hooks en pantalla completa exclusiva | Funciona en una PC |
| Sin aplicación al empezar un mix, en `cssds` | Expulsa unos 15 segundos después |
| Sin SteamID válido, en un mix | Expulsa unos 19 segundos después |
| Con la aplicación abierta, en un mix | Sigue jugando |
| Aplicación cerrada en plena partida | Expulsa unos 2 min 15 s después del último latido |
| Alterar filas, archivos o entradas | Se detecta y queda registrado |
| Firma falsa o clave cambiada | Rechazadas |
| Borrado a 30 días | Respeta lo abierto y lo conservado |
| Instalar y desinstalar la 0.3.0 | Sin dejar rastro |
| Backend | `typecheck`, 392 unitarias y 184 de integración |
| Frontend | `typecheck` y 378 pruebas |

**Con esa salvedad:** en `cssds` el SteamID se simuló con una compilación de prueba, porque ese servidor no da uno. La prueba con la aplicación real falló una vez y después pasó 5 seguidas; no se identificó la causa.

**Lo que encontraron las pruebas:**

- `BitBlt` de la ventana devolvía imágenes viejas que parecían buenas.
- Una captura de prueba mostró otra cosa de la pantalla, porque la versión de pruebas no exige el juego al frente. Se borró, y esa opción no está en la versión real.
- Con un token vencido, la cola borraba lo pendiente. Corregido.
- El Bridge nunca expulsaba a quien no tenía SteamID válido. Corregido.
- El panel no mostraba las capturas nuevas. Corregido.

## Pendientes y detalle

Lo urgente de cada uno es lo que puede romper una partida real: la compra en 2v2 y el Bridge con SteamID reales en el anticheat.

- [ ] Retake: cargar spawns de otros mapas, porque sin eso la votación de la ronda 25 no tiene opciones
- [ ] Retake: confirmar con jugadores lo pendiente y revisar el sorteo de AWP
- [ ] Retake: decidir si `csstv_reporter` sale de `aurav34`, y borrar `cfg/server.cfg.bak_pw`, que tiene la contraseña vieja
- [ ] Retake: sincronizar el VIP con la web cuando exista
- [ ] 2v2: probar la compra con jugadores
- [ ] 2v2: subir `de_dust2_ob` a RBK o cargar otro mapa, y actualizar su versión
- [ ] 2v2: cargar sitio, spawns y zonas de `de_inferno`
- [ ] Anticheat: revisión legal antes de usarlo con jugadores
- [ ] Anticheat: probar el Bridge con SteamID reales, con `enforce_mixes` apagado al principio
- [ ] Anticheat: medir tirones, Alt+Tab y superposiciones, y probar otros modos y Windows 11
- [ ] Anticheat: conseguir el certificado de firma
- [ ] Anticheat: revisar con Daniel y Esteban cómo entra a sus ramas, y mostrar el estado en el perfil
- [ ] Anticheat: instalar el cron y elegir almacenamiento inmutable
- [ ] Anticheat: decidir el intervalo; se recomendó 1 a 2 minutos al azar

| Tema | Detalle en el repo | Rama |
| --- | --- | --- |
| Retake | `docs/bitacora/2026-10-30-plugin-retake/` | `kyan/pruebas` |
| 2v2 | `docs/bitacora/2026-10-30-plugin-2v2/` | `kyan/pruebas` |
| Auditoría y prueba de captura | `docs/bitacora/2026-10-30-anticheat-etapa-0-auditoria/`, `2026-10-30-anticheat-captura/` | `kyan/pruebas` |
| Backend, aplicación, evidencia e integridad | `docs/bitacora/2026-10-30-anticheat-backend/`, `-agente/`, `-evidencia/`, `-integridad/` | `kyan/anticheat-backend` |
| Vinculación y panel | `docs/bitacora/2026-10-30-anticheat-web/` | `kyan/anticheat-web` |
