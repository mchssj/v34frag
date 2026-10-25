# Contrato para el frontend: Registro de decisiones

> Parte del contrato para el frontend. Índice, estado y novedades: [`README.md`](README.md). Las decisiones de todos los módulos están en [`decisiones.md`](decisiones.md).

## 11. Registro de decisiones

Todas las decisiones de diseño que afectan al frontend, en orden. "Daniel" son las que tomó Daniel; "Propuesta aceptada" son propuestas técnicas que quedaron en un plan aprobado; "Frontend" son aclaraciones que reportó el equipo de frontend y se verificaron.

| Fecha | Tema | Decisión | Origen |
|---|---|---|---|
| 2026-10-14 | Arquitectura | El frontend habla solo con la API (OpenAPI en `/api/openapi.json`); no usa Supabase directo | Daniel |
| 2026-10-14 | Sesión | Tokens Bearer (sin cookies), renovación con `/auth/refresh` de un solo uso | Propuesta aceptada |
| 2026-10-14 | Hosting | VPS de Hostinger con dominio propio; la URL de la API es configurable | Daniel |
| 2026-10-14 | Avatar | 1 MB, JPEG, PNG o WebP (sin GIF), recortado a 256×256 | Propuesta aceptada |
| 2026-10-14 | Privacidad | Solo público o privado; privado oculta datos personales, no la ficha ni las stats | Daniel |
| 2026-10-14 | Stats | Solo desde partidas jugadas en el servidor; sin carga manual | Daniel |
| 2026-10-14 | Mixes | Sin equipos `mix`: los bandos van dentro de la partida | Daniel |
| 2026-10-14 | Demos | Se quitan los campos manuales de video y demo; la demo sale de R2 | Daniel |
| 2026-10-14 | Matchmaking | Se elimina; no hay pantallas | Daniel |
| 2026-10-14 | Torneo suizo | Se quita de las opciones | Daniel |
| 2026-10-14 | Reclamo de perfil | Va a pasar al juego con `!claim`; los endpoints actuales quedan deprecados | Daniel |
| 2026-10-15 | `!match` | Código de 5 caracteres por partida de torneo y PCW, visible solo para los dos equipos y los admins | Daniel |
| 2026-10-15 | Reglas para jugar | Torneo: 5 en el plantel y sin stand-ins. PCW: 4 con cuenta para publicar o aceptar, hasta 2 stand-ins por lado | Daniel |
| 2026-10-15 | Formatos de PCW | Los decide el admin (BO1, BO3, BO5) | Daniel |
| 2026-10-15 | Plantel | Estilo FACEIT: el capitán invita y el jugador pide entrar | Daniel |
| 2026-10-15 | Tamaño del plantel | Hasta 10 jugadores | Daniel |
| 2026-10-15 | Varios equipos | Un jugador puede estar en varios equipos, pero no en dos del mismo torneo | Daniel |
| 2026-10-15 | PCW con un jugador compartido | No se puede jugar | Daniel |
| 2026-10-15 | SteamID | Obligatorio para entrar a un equipo (y para pedir uno nuevo) | Daniel |
| 2026-10-15 | Alias | Un solo nombre en la web, único; el usuario lo cambia cada 15 días y el admin siempre | Daniel |
| 2026-10-15 | Palabras bloqueadas | Lista del admin; se aplica a alias, equipos y bandos de PCW, con "Guardar igual" para el admin | Daniel (lista); propuesta aceptada (alcance) |
| 2026-10-15 | Jugadores con nick distinto del alias | Pasan a mostrar el alias | Daniel |
| 2026-10-15 | Ranking de equipos | Puntos por partida ganada: 30 de torneo y 5 de PCW, configurables; por defecto solo torneos, con opción de sumar PCW | Daniel |
| 2026-10-15 | PCW en el ranking | Suma solo si el bando juega como uno de sus equipos oficiales | Daniel |
| 2026-10-15 | Torneos | El creador define cuántos inscribe cada equipo (máximo 10) y el formato de las partidas | Daniel |
| 2026-10-15 | URLs | Por id de jugador y de equipo (el alias puede cambiar) | Propuesta aceptada |
| 2026-10-15 | Nivel | Lo calcula la API (1 a 10) con los tramos de la web vieja | Propuesta aceptada |
| 2026-10-15 | Listados | Paginados en el servidor, búsqueda sin tildes ni mayúsculas | Propuesta aceptada |
| 2026-10-15 | Creador de torneos | El admin y los **organizadores** que nombra el admin; el organizador gestiona solo sus torneos | Daniel |
| 2026-10-15 | Resultados | Llegan del servidor con `!match`; a mano solo el organizador o el admin; se quitan los reportes y capturas de los capitanes | Daniel |
| 2026-10-15 | PCW sin `!match` | No tiene resultado (solo el admin puede cargarle uno) | Daniel |
| 2026-10-15 | Plantillas | Eliminación directa, doble eliminación, grupos + playoffs y suizo + playoffs (como el Major de CS2, hasta 3 fases) | Daniel |
| 2026-10-15 | BO | El organizador elige BO1, BO3 o BO5 en cada fase; valores por defecto en la sección 8b | Daniel |
| 2026-10-15 | Gran final | Sin reset; "mapa de ventaja" opcional | Daniel |
| 2026-10-15 | Empates | Overtime obligatorio; en grupos, desempate por diferencia de rondas y después el resto de criterios | Daniel |
| 2026-10-15 | Pool de mapas | dust2_ob, cache, cbble, inferno (normal o classic), mirage_rc1, nuke_old_blue, season, tuscan; el admin lo puede cambiar | Daniel |
| 2026-10-15 | Mapa decisivo con versiones | Lo fija el organizador | Daniel |
| 2026-10-15 | Chat de torneos y PCW | Escriben los dos equipos, el organizador y los admins | Daniel |
| 2026-10-15 | Puntos del ranking | Valor único por partida ganada (no cambia según la fase) | Daniel |
| 2026-10-15 | Motor de torneos | En la base: el torneo avanza solo con cada resultado | Propuesta aceptada |
| 2026-10-15 | W.O. | Avanza el que se presentó; no suma puntos en el ranking | Propuesta aceptada |
| 2026-10-15 | Código de `!match` | Oculto en la base; solo los dos equipos, el organizador y los admins | Propuesta aceptada |
| 2026-10-15 | Partidas sueltas | Se quita "crear partida suelta" | Propuesta aceptada |
| 2026-10-15 | Borrar un torneo | Solo sin partidas jugadas; si no, se cancela | Propuesta aceptada |
| 2026-10-15 | PCW vencidas | Se cancelan solas a las 48 h de su hora | Propuesta aceptada |
| 2026-10-15 | En vivo | `ETag` y `304` en los detalles | Propuesta aceptada |
| 2026-10-15 | Demo | La API arma `demo_url` | Propuesta aceptada |
| 2026-10-15 | Listados | **Todo GET de lista pagina, filtra y ordena en el servidor** (`page`, `per`, `sort`, `order` y filtros); los detalles no traen listas que crecen; el chat pagina por cursor | Daniel |
| 2026-10-16 | Servidores | Nombre único; borrar solo sin partidas (con partidas se revoca); para asignar partidas, solo servidores activos con licencia vigente | Propuesta aceptada |
| 2026-10-16 | Servidores | Sin estado en vivo desde el panel de Pterodactyl por ahora: alcanza con `online` | Propuesta aceptada |
| 2026-10-16 | ELO | La vista previa de la configuración la calcula la API (la fórmula no se copia en el frontend) | Propuesta aceptada |
| 2026-10-16 | ELO | Simulación del recálculo antes de aplicarlo (`POST /api/v1/admin/elo/simulate`) | Daniel |
| 2026-10-16 | ELO | **Recalcular pide doble confirmación**: preguntar si está seguro y escribir "estoy seguro" para habilitar el envío; la API exige el texto en `confirm` | Daniel |
| 2026-10-16 | Demos | Panel de demos del admin: resumen, listado con vencimiento y descarga, reintentar una demo perdida y tokens del Worker de demos | Propuesta aceptada |
| 2026-10-16 | Demos | **El token nuevo del Worker pide doble confirmación** ("estoy seguro"), como el recálculo del ELO | Propuesta aceptada |
| 2026-10-16 | Demos | Fuera por ahora: borrar una demo antes de que venza y correr el Worker a mano desde la web | Propuesta aceptada |
| 2026-10-16 | Sesión | Aclaración: el `refresh_token` **rota** en cada renovación, pero Supabase acepta reusar el anterior (`refresh_token_reuse_interval`, 10 s). No es estrictamente de un solo uso; el frontend guarda siempre el último y no depende del rechazo del anterior. Lo reportó el equipo de frontend y se midió en local | Frontend |
| 2026-10-16 | Perfil sin reclamar | Un SteamID que jugó sin ficha tiene una página pública armada con sus partidas; no se crea ninguna ficha hasta reclamarlo, y **no va al ranking** | Daniel |
| 2026-10-16 | `!claim` | Código de 6 caracteres generado en Mi perfil y `!claim <código>` en el servidor. El primer SteamID se vincula al instante (crea la ficha si no hay); los reclamos viejos con aprobación se borran | Daniel |
| 2026-10-16 | Varios SteamID | Una ficha puede tener varios SteamID (tope configurable, de 1 a 4, por defecto 3). Los adicionales los pide el usuario con `!claim` y los aprueba un admin. Un SteamID es de una sola ficha. **Un solo ELO por ficha** | Daniel |
| 2026-10-16 | Sesión | Se deja el reuso del refresh token como lo maneja Supabase por defecto; el frontend guarda siempre el último. Cerrar sesión revoca la sesión entera | Daniel |
| 2026-10-17 | Mixes en vivo | La lista de mixes muestra los que se están jugando, actualizados al final de cada ronda | Daniel |
| 2026-10-17 | Mix interrumpido | Un mix cortado por una caída o un reinicio del servidor se guarda con la última ronda. Cuenta para el ELO solo si un admin lo aprueba: mínimo 35 % de las rondas del mix y sin empate; gana el que iba adelante | Daniel |
| 2026-10-17 | Aprobar el ELO de un interrumpido | Doble confirmación ("estoy seguro"), como el recálculo | Daniel |
| 2026-10-17 | Interrumpido con `!match` | Al aprobarlo, también se vincula a su partida de torneo o PCW. Si no se aprueba, el organizador carga el resultado a mano | Daniel |
| 2026-10-17 | Mapa en juego de una serie | El detalle de una partida de torneo o PCW muestra el mapa que se está jugando | Daniel |
| 2026-10-18 | Preferencias de la cuenta | `preferences.theme_fx` (`full`, `silent`, `off` o `null`) en `GET`/`PATCH /me/profile`, dentro de un objeto para sumar otras; solo del propio usuario y sin pisar otras claves | Frontend (aprobado por Daniel) |
| 2026-10-18 | Plantilla `groups_double` | "Grupos de doble eliminación + playoffs": doble eliminación por grupo sin final del grupo (1.º gana la final del upper, 2.º y 3.º salen de la final del lower), libres para los primeros lugares, playoffs con los 1.º esperando en semifinales. Por defecto 2 grupos, clasifican 3, grupos BO3, playoffs BO3 y final BO5 | Daniel |
| 2026-10-18 | Sorteo | Se sortea todo (grupos y lugar dentro del grupo) con `POST /events/{id}/draw`, para todas las plantillas; queda registrado quién y cuándo sorteó | Daniel |
| 2026-10-18 | Tamaños de `groups_double` | De 1 a 8 grupos, de 4 a 8 equipos por grupo, clasifican 2 o 3; siempre hay playoffs. Los perdedores de la ronda 2 del upper bajan cruzados | Propuesta aceptada |
| 2026-10-19 | Estado de los servidores | Público; el backend consulta cada servidor con A2S (sin tocar el plugin), cuenta solo humanos y guarda la respuesta 20 s | Daniel (pedido); propuesta aceptada (cómo) |
| 2026-10-19 | Cambiar la contraseña | Pide la actual; cierra todas las demás sesiones y devuelve una sesión nueva; 5 intentos por minuto por cuenta | Daniel |
| 2026-10-19 | Olvidé mi contraseña | Queda para cuando haya envío de correos (despliegue en el VPS) | Propuesta aceptada |
| 2026-10-19 | Mis partidas | `GET /api/v1/me/matches`; sin ficha, lista vacía (no un error) | Daniel (pedido); propuesta aceptada (forma) |
| 2026-10-19 | Partidas por servidor | Filtro `server` en `GET /api/v1/matches` | Propuesta aceptada |
| 2026-10-19 | Contrato por módulos | Un archivo por módulo en `docs/frontend/contrato/`, con índice y registro de decisiones aparte | Daniel |
| 2026-10-19 | Modo de un servidor | Lista fija: `mix`, `competitive`, `public`, `deathmatch`, `retakes`, `practice`; la carga el admin | Daniel |
| 2026-10-19 | Región de un servidor | Texto libre de 2 a 30 caracteres; la carga el admin | Daniel |
| 2026-10-19 | Ping de un servidor | `ping_ms` es la latencia desde el backend: el ping del jugador no se puede medir desde el navegador | Propuesta (limitación técnica) |
| 2026-10-19 | Partidas en vivo en el estado | `live_matches` por servidor y en los totales: mixes con foto en los últimos 10 minutos | Daniel (pedido); propuesta aceptada (forma) |
| 2026-10-19 | Desvincular un SteamID | Lo pide el jugador desde Mi perfil y lo aprueba un admin (misma bandeja que los adicionales). No se puede pedir para el único SteamID de la ficha | Daniel (pedido); propuesta aceptada (el único SteamID) |
| 2026-10-19 | SteamID principal | Lo elige el jugador sin aprobación, una vez cada 24 horas; el admin, sin límite. Cambiarlo no recalcula el ELO | Daniel (pedido); propuesta (límite) |
| 2026-10-19 | Fecha de cada SteamID | Mi perfil muestra cuándo se vinculó cada SteamID (`added_at`); la fecha es del SteamID y no cambia al hacerlo principal. `null` si se vinculó antes de que se guardara | Daniel |
| 2026-10-19 | Cancelar el pedido de desvincular | El jugador lo cancela mientras está pendiente (`DELETE /api/v1/me/steam/{steamid}/unlink`); el pedido queda `cancelled`, no se borra. Solo los de desvincular | Daniel (pedido); propuesta (forma) |
| 2026-10-19 | Fecha del último cambio de contraseña | `password_changed_at` en el usuario. La guarda la base con cualquier cambio de contraseña; `null` si no la cambió desde ese día | Daniel (pedido); propuesta (forma) |
| 2026-10-21 | Temporadas: cierre | Automático al llegar la fecha (cron del VPS cada 10 minutos) y botón "Terminar temporada" con doble confirmación. Con un mix en vivo el cron espera, hasta 6 horas | Daniel (cierre y botón); propuesta aceptada (mix en vivo) |
| 2026-10-21 | Temporadas: duración y hora | 30 días por defecto, configurable; cierra a las 06:00 de Argentina (de donde son la mayoría de los jugadores) del día de fin | Daniel |
| 2026-10-21 | Temporadas: top y mínimo | Top 20 y 20 mixes en la temporada, configurables. Cuentan los mixes que le movieron el ELO. Desempate: más mixes, después quien llegó antes a ese ELO | Daniel (valores); propuesta aceptada (qué cuenta y desempate) |
| 2026-10-21 | Temporadas: medallas | Por tramos: 🏆 Campeón, 🥈 Subcampeón, 🥉 Tercer puesto, 🎖️ Top 10 y 🏅 Top N; editables. Título "Temporada 1 · #3". Quedan aunque después se recalcule el ELO | Daniel |
| 2026-10-21 | Temporadas: reinicio | Solo nivel 10: conserva el porcentaje configurado (10 % al principio) de lo que tenía sobre 2001. 2540 → 2055 | Daniel |
| 2026-10-21 | Temporadas: ELO pico | `peak_elo` es el de la temporada: al empezar cada una arranca en el ELO actual | Propuesta aceptada |
| 2026-10-21 | Sin "Recalcular ELO" | Se quita de la web recalcular el ELO de todos (y la simulación). La configuración vale para los mixes nuevos. Los recálculos automáticos de la base (SteamID adicionales, mix que llega tarde a una temporada cerrada) se quedan y tienen en cuenta los ajustes | Daniel |
| 2026-10-21 | Ajustes manuales de ELO | El admin suma o resta (−500 a +500) o fija el ELO de hasta 10 jugadores, con motivo obligatorio; cuenta desde ese momento. Un "fijar" se vuelve a fijar en un recálculo | Daniel (sumar, restar y fijar; hasta 10); propuesta aceptada (rangos y recálculo) |
| 2026-10-21 | Ajustes visibles | El jugador ve en su ficha sus ajustes: cambio, motivo y fecha | Daniel |
| 2026-10-21 | Deshacer un ajuste | Con doble confirmación. Resta el cambio, o recalcula si restar no daría lo mismo (un "fijar", una temporada o un "fijar" posterior) | Propuesta aceptada |
| 2026-10-23 | Clips: qué se guarda | Por jugador y por ronda en vivo (con prórroga): 3+ kills o un clutch ganado. No first kills, plants ni 2k | Daniel (tipos); propuesta aceptada (filtro) |
| 2026-10-23 | Clips: escala | Ace, 1v5 y 1v4, 4k, 1v3, 3k, 1v2, 1v1. Empate: la ronda ganada y después la más tardía. Un registro por jugador y ronda, con su tipo más valioso | Daniel |
| 2026-10-23 | Clips: topes | 2 por jugador (por ficha) y 10 por partida, aplicados en la web y configurables por el admin | Daniel (valores y dónde); propuesta aceptada (por ficha) |
| 2026-10-23 | Clutch | Empieza cuando queda último vivo de su equipo; el tipo es la cantidad de rivales vivos en ese momento. Cuenta si su equipo gana la ronda, aunque no los mate a todos o muera después de plantar. Un 1v3 que llega al 1v1 sigue siendo 1v3 | Daniel |
| 2026-10-23 | Clips de partidas canceladas | Se guardan y se muestran | Daniel |
| 2026-10-23 | Clips sin video | Por ahora la ronda y el segundo de la demo; el video es una fase aparte (render en una máquina propia). La web vieja no los muestra | Daniel |
| 2026-10-23 | Video de los clips: cuáles | Se graban solas las jugadas visibles (las que dejan los topes, hoy 10 por partida y 2 por jugador), apenas termina la partida y su demo está en R2 | Daniel |
| 2026-10-23 | Video de los clips: dónde | Los primeros 15 días en R2 (el `.mp4` con el reproductor de la web, servido por un Worker de la cuenta de Daniel) y para siempre en Google Drive (reproductor embebido). YouTube descartado: la API deja privados los videos de proyectos sin auditar y tiene cupo diario | Daniel |
| 2026-10-23 | Video de los clips: calidad | 1080p a 60 cuadros, primera persona del jugador, con el feed de kills y sin el HUD del espectador | Daniel (1080p); propuesta aceptada (cámara) |
| 2026-10-24 | Mixes en un solo listado | `GET /api/v1/mixes` junta en vivo, terminados y cancelados; los en vivo primero. Atajos "Solo donde jugué" y "Ocultar canceladas" | Daniel |
| 2026-10-24 | KPIs de mixes | En vivo ahora y, de los últimos 30 días, jugadores, mapa más jugado y promedio de rondas | Daniel (30 días) |
| 2026-10-24 | SourceTV | Cada servidor guarda su puerto de SourceTV (`tv_port`); los mixes en vivo traen `tv` para "Ver en TV" | Daniel |
| 2026-10-24 | Demos públicas | El link de la demo sigue siendo directo, sin firmar | Daniel |
| 2026-10-24 | Mixes en vivo sin SSE | Por ahora se refresca consultando; SSE o WebSocket quedan para más adelante | Daniel |
| 2026-10-24 | Borrar un mix | El admin elige mantener o revertir el ELO que dio; nunca se recalcula la historia. "Mantener" guarda un ajuste interno (con la fecha del mix) que lo sostiene si la base recalcula sola, y no se muestra en el perfil del jugador | Daniel (mantener o revertir, sin recalcular); propuesta aceptada (ajuste interno oculto) |
| 2026-10-24 | Perfil por nick | Las rutas públicas de un jugador aceptan el id o el nick; el nick es único en todas las fichas (también las que no tienen cuenta) | Daniel |
| 2026-10-24 | SteamID en el perfil | Nunca en el perfil público: solo para el dueño y los admins | Daniel |
| 2026-10-24 | Historial de ELO | Endpoint dedicado y liviano para el gráfico, la tendencia del ranking y el comparador | Daniel |
| 2026-10-24 | Palmarés | Torneos ganados y finales perdidas, con el equipo con el que estaba inscrito y la fecha | Daniel (torneos con fecha y equipo); propuesta aceptada (subcampeón) |
| 2026-10-24 | Medallas | Dos endpoints: el detalle y uno agrupado con la cantidad | Daniel |
| 2026-10-24 | Título y subtítulo de las partidas | Los arma el front; la API manda el torneo y la fase | Daniel |
| 2026-10-24 | Ranking de jugadores | Posición global por ELO (no cambia al filtrar), filtro por nivel y tendencia de los últimos 30 mixes | Daniel |
| 2026-10-24 | Ranking de equipos | `win_rate`, tendencia contra hace 30 días y últimos 5 resultados | Daniel (30 días) |
| 2026-10-24 | Comparador | Dos jugadores cualesquiera (no solo el logueado), con los mixes jugados juntos y como rivales | Daniel |
| 2026-10-24 | Notificaciones: alcance | Primera etapa sin tareas programadas (partida en 1 hora, PCW vencida, temporada por terminar, partida sin resultado: segunda etapa) | Daniel |
| 2026-10-24 | Notificaciones: canal | Solo en la web | Daniel |
| 2026-10-25 | Notificaciones: tiempo real | Contador liviano con ETag cada 30 s (y al enfocar y tras acciones) y la lista al abrir el menú | Daniel (opción B) |
| 2026-10-24 | Notificaciones: preferencias | Se apaga por categoría; invitación, pedido para entrar y cambio de contraseña no se apagan | Daniel |
| 2026-10-25 | Notificaciones: Novedades | Torneo nuevo y temporada nueva en una categoría propia, apagada por defecto | Daniel |
| 2026-10-24 | Notificaciones: retención | Las últimas 100 por cuenta | Daniel |
| 2026-10-24 | Notificaciones: pendientes | Una invitación o un pedido resuelto queda marcado (aceptada, rechazada, cancelada o vencida), sin borrarse | Daniel |
