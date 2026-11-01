# Contrato para el frontend: Modelo de datos nuevo

> Parte del contrato para el frontend. Índice, estado y novedades: [`README.md`](README.md). Las decisiones de todos los módulos están en [`decisiones.md`](decisiones.md).

## 3. Modelo de datos nuevo (lo que cambia respecto de la web vieja)

| Tema | Antes | Después |
|---|---|---|
| **Stats de jugadores** | El admin las cargaba a mano, o salían de los mixes | **Solo salen de partidas jugadas en el servidor**: mixes, y PCW y torneos jugados con `!match`. No hay carga manual. Las stats por mapa también se calculan. Siempre están al día |
| **Mixes** | Cada mix creaba dos equipos `mix` mezclados con los equipos reales | Los bandos van **dentro de la partida**: nombre, jugadores y ganador (bando 1, 2 o empate) de cada lado. Los listados de equipos solo tienen equipos reales (oficiales y PCW) |
| **Jugadores sin cuenta en un mix** | | Quien juega sin estar vinculado aparece en el mix con el nombre que usaba en el juego, sus stats y su cambio de ELO (por SteamID), y tiene un **perfil sin reclamar** (sección [5b](jugadores.md)). Cuando ese SteamID se vincula a una ficha, todos sus mixes pasan a mostrarla con su alias y la ficha muestra su ELO y stats completos |
| **Miembros de un equipo** | Arreglo de ids | Lista con rol (`player`, `sub`, `coach`) y fechas de alta y baja. El **historial de equipos** sale de ahí |
| **Video y link de demo** | Campos cargados a mano | **Se eliminan.** La demo se descarga desde el botón que usa R2 (estado: `none`, `pending`, `uploaded`, `missing` o `expired`) |
| **IP del servidor de la partida** | Se mostraba para conectarse | Se mantiene |
| **Formato suizo de torneo** | Aparecía como opción sin generar llave | **Vuelve como plantilla nueva**, "suizo + playoffs" al estilo del Major de CS2, con su motor (sección [8b](torneos.md)) |
| **Resultados de torneos y PCW** | Cada capitán cargaba mapas, rondas y capturas; un admin aprobaba | **Llegan solos del servidor con `!match`.** A mano los cargan el organizador o el admin. No hay pantalla de reportes ni capturas |
| **Email en el chat de partida** | Se guardaba y se podía leer | La API **no lo devuelve**: el autor se muestra con su alias |
| **Avatar** | Hasta 5 MB y GIF | **1 MB, solo JPEG, PNG o WebP** |
| **Matchmaking** | Cola 1v1 a 5v5 sin terminar | **Se elimina.** No hay pantallas de matchmaking |
| **SteamID de una cuenta** | Uno solo, lo vinculaba un admin | **Varios por cuenta.** El primero se vincula con `!claim` desde el juego; los adicionales (otra PC u otro servidor) se piden también con `!claim` y los aprueba un admin. Tope configurable (de 1 a 4, 3 por defecto). Un SteamID es de una sola cuenta y hay **un solo ELO por cuenta**, sumando todos sus SteamID (sección [5b](jugadores.md)) |
| **Reclamar un perfil** | Botón "Reclamar este perfil" → aprobación de un admin | **`!claim <código>` desde el juego** (sección [5b](jugadores.md)). Los reclamos viejos se borraron: no hay pantalla de reclamos |
