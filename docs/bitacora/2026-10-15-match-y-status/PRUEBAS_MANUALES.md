# `!match` y `!status`: pruebas manuales pendientes

Casos que **no se pudieron probar con bots** y que tiene que probar Daniel con jugadores reales. Conviene hacerlo **cuando la web nueva esté más avanzada**: que muestre el código de la partida (solo a los integrantes de los dos equipos), deje publicar y aceptar PCW, e inscribir equipos a torneos. Hasta entonces los datos de prueba se cargan a mano en la base (ver `pruebas/servidor_local.sql`).

**Dónde:** el servidor local apuntado a la Supabase local, o un servidor de pruebas con la base del corte. **Nunca** contra producción antes del corte.

Por qué no se pudieron probar con bots: los bots se conectan con el nombre de su perfil (el SteamID falso de la build de pruebas sale del nombre, así que hay que renombrarlos después), y cualquier `jointeam` de un bot tira el servidor de CS:S. Ver `GUIA_IMPLEMENTACION.md`, Incidentes.

## Preparación

- Dos equipos en la web con jugadores reales (cuentas con el SteamID vinculado). Uno con **suplentes**: 6 o 7 en el plantel.
- Una PCW BO3 aceptada y una partida de torneo BO1 entre esos equipos.
- Al menos un jugador sin cuenta, para hacer de stand-in, y un admin.

## Casos

| # | Caso | Qué tiene que pasar | Hecho |
|---|---|---|---|
| 1 | Proponer y confirmar con jugadores reales (SteamID `STEAM_1:…` del cliente) | Se reconocen como inscritos; se vincula y cada uno queda en el lado de su equipo | ☐ |
| 2 | Un stand-in entra solo al lado de su equipo desde el menú de equipos | Entra si hay cupo (2 por lado en PCW). El 3.º y el 6.º jugador del lado son rechazados con mensaje | ☐ |
| 3 | Un stand-in intenta entrar en la partida de torneo | Rechazado: "Es una partida de torneo: solo juegan los inscritos de cada equipo" | ☐ |
| 4 | Selección automática de equipo (opción "auto") con el vínculo activo | Un inscrito va a su lado; a un no inscrito el plugin le dice que elija el lado de su equipo | ☐ |
| 5 | Equipo con 7 en el plantel juega con 5 (suplentes fuera) | Nada bloquea; el resultado se vincula a la partida | ☐ |
| 6 | Un inscrito se conecta con el vínculo ya activo | Queda en el lado de su equipo y le llega "Partida vinculada: … Jugás con …" | ☐ |
| 7 | Un inscrito se desconecta y vuelve durante la partida | Vuelve a su lado (`csstv_lock_teams`) | ☐ |
| 8 | `!ready` con un lado que no cumple | Mensaje "Simbations necesita al menos 3 jugadores de su plantel en su lado (hay 2)" (en torneo: "necesita 5") | ☐ |
| 9 | Inicio por `!ready` **con faka**, y el ganador elige `!switch` | El resultado se vincula con los equipos bien orientados (la serie suma el mapa al equipo correcto) | ☐ |
| 10 | Serie BO3 con **cambio de mapa real** | En el mapa 2 el vínculo sigue, el marcador de la serie está al día, cada equipo queda en un lado (el que tenía al terminar) y los stand-ins no van a espectador | ☐ |
| 11 | Serie que termina | El plugin avisa que la partida ya no está abierta y desvincula | ☐ |
| 12 | `!status` en calentamiento, faka, en vivo, **en pausa**, medio tiempo y terminada | Cada línea correcta para el momento | ☐ |
| 13 | Desvincular a mitad de partida | El juego queda como mix común y la serie no cambia | ☐ |
| 14 | Admin vincula solo (con su SteamID en `admins_simple.ini`) | Vinculado sin confirmación | ☐ |
| 15 | Nombres con tildes o caracteres raros en los equipos | Se ven bien en el chat y en `!status` | ☐ |
| 16 | La web nueva muestra la partida | El código lo ven solo los integrantes de los dos equipos y los admins; aparecen los mapas jugados, cada uno con su demo | ☐ |
| 17 | RBK (SourceMod 1.10, build licenciado) | `!match` y `!status` responden igual que en nuestro servidor | ☐ |

Cuando se prueben, marcar la casilla y anotar la fecha y cualquier diferencia en `GUIA_IMPLEMENTACION.md`.
