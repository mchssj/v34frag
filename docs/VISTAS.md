# Vistas y módulos del frontend

Inventario de lo que hay hoy en `index.html` (1669 líneas), vista por vista: qué muestra, de dónde saca los datos, qué acciones ofrece, quién puede usarlas y cuál parece ser su objetivo.

> El **objetivo** de cada vista es una interpretación a partir del código y de la documentación. No figura escrito en ningún lado.

Convenciones:
- **Función** es la función JS que dibuja la vista.
- **Permisos** describe lo que la interfaz muestra u oculta. La protección real está en RLS y en las funciones de Supabase (ver [SEGURIDAD.md](SEGURIDAD.md)).
- Las partidas "oficiales" son las que no son `pcw` ni `mix` (`isOfficial`). Las "huérfanas" son las que tienen `stage` pero cuyo torneo ya no existe (`isOrph`).

## Índice

| Hash | Vista | Función | Acceso |
|---|---|---|---|
| `#home` | [Inicio](#inicio-home) | `rHome` | Público |
| `#matches` | [Partidas](#partidas-matches) | `rViews` | Público |
| `#results` | [Resultados](#resultados-results) | `rViews` | Público |
| `#mixes` | [Mixes](#mixes-mixes) | `rViews` | Público |
| `#events` | [Torneos](#torneos-events) | `rEvents` / `rED` | Público (inscripción: dueño de equipo) |
| `#pcw` | [PCW](#pcw-pcw) | `rPcw` | Público (acciones: con sesión) |
| `#palmares` | [Palmarés](#palmarés-palmares) | `rPalmares` | Público |
| `#ranking` | [Ranking](#ranking-ranking) | `rViews` | Público |
| `#teams` | [Equipos](#equipos-teams) | `rPub` / `rCap` | Público (solicitud: con sesión) |
| `#players` | [Jugadores](#jugadores-players) | `rViews` | Público |
| `#jugador/<nick>` | [Perfil de jugador](#perfil-de-jugador-jugadornick) | `rProfile` / `ppDraw` | Según privacidad |
| `#match-detail` | [Detalle de partida](#detalle-de-partida-match-detail) | `rMatchDetail` | Público (acciones: capitán o admin) |
| `#profile` | [Mi perfil](#mi-perfil-profile) | `rProfileView` | Con sesión |
| `#cadm` | [Admin → Torneos](#admin--torneos-cadm) | `rC` / `rEM` / `rPend` | Admin |
| `#padm` | [Admin → Jugadores](#admin--jugadores-padm) | `rPA` / `rUnlinked` | Admin |
| `#tadm` | [Admin → Equipos](#admin--equipos-tadm) | `rTA` | Admin |
| `#vadm` | [Admin → Verificaciones](#admin--verificaciones-vadm) | `rPA` | Admin |
| `#sadm` | [Admin → Servidores](#admin--servidores-sadm) | `rSrv` | Admin |

---

## Estructura común

### Header y navegación

- **Menú lateral fijo** (244 px, definido en `csstv-theme.css`). En pantallas angostas se convierte en un menú hamburguesa (`#menu-btn`).
- **Logo "CSSTV":** vuelve a Inicio y limpia el torneo seleccionado (`selEv`).
- **Enlaces:** Inicio, Partidas, Resultados, Mixes, Torneos, PCW, Palmarés, Ranking, Equipos y Jugadores.
- **Mi Perfil:** solo aparece con sesión (`#nav-profile`).
- **Admin ▾:** menú desplegable que solo ven los admins (clase `.ad`), con Torneos, Jugadores, Equipos, Verificaciones y Servidores. Se cierra con un clic afuera o con Escape.
- **Zona de sesión (`#ses`):** muestra `tag - email` y agrega `(Admin)` si corresponde.
- **Botones del header:** **Tema** alterna claro/oscuro con `data-theme`, y **Ingresar/Salir** abre el diálogo de cuenta o cierra la sesión.

**Objetivo:** dar acceso directo a todas las secciones y dejar claro quién está logueado y con qué rol.

### Diálogo de cuenta (`#dlg`)

- **Campos:** email, contraseña y "Tu Tag (solo para registro)" (`maxlength` 20).
- **Ingresar:** `signInWithPassword`.
- **Registrarse:**
  - Valida que el tag tenga entre 2 y 24 caracteres y llama a `signUp` con el tag en los metadatos.
  - Si hay sesión inmediata, aplica el tag con `set_my_tag`.
  - Si hay que confirmar el email, guarda el tag en `localStorage.pendingTag` y muestra "Revisá tu email".
- **No hay** recuperación de contraseña ni login social.

**Objetivo:** que cualquier persona cree una cuenta e ingrese sin salir de la página.

### Ciclo de datos

1. `load()` trae todas las tablas en paralelo (`loadImpl`).
2. Llama a `handleRoute()`, que lleva a `show()` y de ahí a `render()`.
3. `render()` solo dibuja las vistas visibles. Casi cualquier escritura vuelve a llamar a `load()`.

---

## Inicio (`#home`)

**Función:** `rHome` · **Layout:** columna principal y lateral (`aside`).

| Sección | Contenido exacto |
|---|---|
| En vivo | Tabla de partidas oficiales `live` (`ms('live')`). Columnas: Fecha, Eq 1, Resultado, Eq 2, Mapa, Acción. |
| Próximas partidas | Las 4 partidas oficiales `upcoming` más cercanas por `starts_at`. |
| Resultados recientes | Las 4 últimas partidas oficiales `finished`. |
| Últimos mixes | Los 4 últimos mixes terminados (sin los cancelados). Columnas: Fecha, Mapa, Equipo 1, Resultado, Equipo 2, MVP y "Ver". |
| Torneos Activos (lateral) | Los **3 primeros torneos** de la lista (ordenada por `starts_on` descendente) con su etapa. No filtra por estado, así que también puede mostrar torneos finalizados. |
| Ranking (lateral) | Top 4 de `rank()`: posición, equipo y puntos. |

**Acciones:**
- **En las filas de partidas:** "Ver" abre el detalle de la partida, "[Conectar]" (`steam://connect/`) aparece si la partida está en vivo y tiene IP, y "[Demo]" y "[Video]" aparecen si existen.
- **En las filas de mixes:** "Ver" abre el detalle del mix.

**Objetivo:** ser la portada de la comunidad, con un resumen de lo que está pasando ahora (en vivo, lo próximo, lo último) para que el visitante entre a lo que le interesa en un clic.

---

## Partidas (`#matches`)

**Función:** `rViews`.

| Sección | Contenido |
|---|---|
| En vivo | Todas las partidas oficiales `live`. |
| Próximas partidas | Todas las partidas oficiales `upcoming`, por fecha ascendente. |

Excluye PCW, mixes, byes, partidas sin los dos equipos y huérfanas. Usa la misma tabla y las mismas acciones que Inicio.

**Objetivo:** ser la agenda completa de partidas oficiales, para saber qué se está jugando y qué viene.

---

## Resultados (`#results`)

**Función:** `rViews`.

Tabla de todas las partidas oficiales `finished`, de la más reciente a la más vieja (por `starts_at`). El equipo ganador se resalta (clase `w`).

**Objetivo:** ser el historial público de resultados oficiales.

---

## Mixes (`#mixes`)

**Función:** `rViews`, con un listado paginado (`pager`, clave `pub-mixes`).

- **Qué lista:** los mixes que reporta el servidor CS:S, `finished` y `cancelled`, del más reciente al más viejo (`played_at`, si no `starts_at`).
- **Columnas:** Fecha, Mapa, Equipo 1, Resultado (en **rondas**, no mapas), Equipo 2, MVP y "Ver".
  - Los cancelados llevan la etiqueta **Cancelada**, con el motivo en el tooltip: admin, cambio de mapa o abandono.
  - El MVP es el jugador con mayor rating del mix (`mvpOf`), con su rating.
- **Búsqueda:** por mapa, equipo o nick de cualquier jugador del mix.
- **Paginación:** 15 por página por defecto (se puede cambiar a 10 o 25).

**Objetivo:** ser la vitrina de la actividad diaria del servidor (los mixes son lo que más se juega), dar acceso al scoreboard y a la demo de cada partida, y alimentar el ELO.

---

## Torneos (`#events`)

**Funciones:** `rEvents` (listado) y `rED` (detalle). La vista alterna entre el listado y el detalle según `selEv`.

### Listado: "Torneos y Copas"

Tabla con Torneo, Formato, Estado, Equipos (cantidad de participantes), Premio, Campeón y "Ver".

### Detalle de un torneo

| Bloque | Contenido |
|---|---|
| Encabezado | "Torneo: \<nombre\>" y botón "← Volver". |
| Información | Formato (con grupos y clasificados, e "ida y vuelta" si aplica), BO de las partidas y de la final, Estado, Fechas, Premio, Cupo (`inscriptos / max_teams`), Campeón y Reglas (texto con saltos de línea). |
| Inscripción | Botón **Inscribir equipo** o **Cancelar inscripción**. |
| Posiciones | Solo si hay partidas de grupo. Por grupo: #, Equipo, PJ, G, E, P, Rondas (a favor:en contra), Pts. Marca "Clasifica" a los primeros `advance` en el formato grupos. |
| Bracket | Columnas por ronda ("Final", "Semifinal", "Cuartos de final", "Upper ronda N", "Lower final", "Gran final"…). Separa Playoffs, Upper, Lower y Gran final. Cada cruce se puede tocar para abrir el detalle. Si no hay fixture, muestra "El fixture todavía no fue generado." |
| Equipos | Lista numerada en orden de siembra. |
| Partidas | Tabla con la fase y las mismas columnas que Partidas, ordenada por etapa, grupo, ronda y posición. |

El botón de inscripción aparece solo si se cumple todo esto:
- hay sesión;
- el usuario es **dueño** (`owner_id`) de un equipo;
- el torneo está en *Inscripciones* y sin fixture;
- hay cupo, o el equipo ya está inscripto (en ese caso el botón sirve para cancelar).

**Objetivo:** ser la página de cada competencia. Sirve para informar el formato y las reglas, seguir el avance (posiciones y bracket) y permitir que los equipos se anoten solos.

---

## PCW (`#pcw`)

**Función:** `rPcw`.

| Sección | Contenido |
|---|---|
| Buscar PRACC (formulario) | Solo con sesión; sin sesión muestra "Iniciá sesión para publicar o aceptar prácticas.". Campos: nombre del equipo (opcional), BO1/3/5, fecha y hora (opcional), mapas (texto libre, 120), nota (200) y **roster** (selector `rosterPicker`). Botón **Publicar anuncio** → RPC `create_pcw_post`. |
| Anuncios abiertos | Anuncios `open` de menos de 7 días, cuya fecha no pasó hace más de 2 h. Cada uno muestra BO, equipo, autor, roster, fecha o "Fecha a convenir", mapas y nota. Con el anuncio propio aparece **Cancelar anuncio** (`cancel_pcw_post`); con el de otro, **Aceptar** (abre el diálogo de aceptación). |
| Mis prácticas | PCW donde el usuario es capitán, dueño o integrante de alguno de los dos lados (hasta 15, primero las no terminadas). Estado: "Sin resultado", "Falta confirmación", "En disputa", "Listo" o "Terminada X - Y". Botones **Abrir** y **Cancelar** (este último para un capitán o admin, si no terminó: `cancel_pcw_match`). |
| Prácticas recientes | Las últimas 20 PCW terminadas, en la tabla estándar de partidas. |

### Selector de roster (`rosterPicker`)

- Contador "Roster: N / 7 (recomendado 5)".
- Lista de elegidos con botón "Quitar".
- "Cargar plantel" de un equipo propio (donde el usuario es capitán o dueño), que también completa el nombre.
- Buscador paginado de jugadores registrados.
- "¿No está en la lista? Escribí su tag": invitados de 2 a 24 caracteres, sin `<` ni `>` y sin repetir.

### Diálogo "Aceptar práctica" (`#pcwdlg`)

- Muestra el rival, el BO y el roster rival.
- Pide el nombre del equipo propio y el roster.
- **Confirmar y aceptar** llama al RPC `accept_pcw`, que crea la partida, y abre directamente su detalle.

**Objetivo:** ser un tablón de búsqueda de prácticas abierto a cualquier usuario, aunque no tenga un equipo oficial, que termina en una partida con el mismo veto y reporte que las oficiales. No suma al ranking.

---

## Palmarés (`#palmares`)

**Función:** `rPalmares`. Se dibuja al entrar a la vista.

"Salón de la Fama": tabla con Torneo, Premio y 🏆 Clan Campeón de los torneos en *Finalizado*.
- Si `events.champion` está vacío, toma al ganador de la última partida terminada del torneo, según el orden del array (sin ordenar).
- Si no hay torneos finalizados, muestra un mensaje.

**Objetivo:** dar reconocimiento histórico a los equipos campeones.

---

## Ranking (`#ranking`)

**Función:** `rViews` → `rank()`.

- **Columnas:** #, Equipo, PJ, G, P, Pts.
- **Partidas que cuentan:** solo las oficiales terminadas, sin empate, sin bye, no huérfanas y con los dos equipos existentes.
- **Puntaje:** 3 puntos por victoria. Desempata por cantidad de victorias.
- Aparecen todos los equipos oficiales, también los que tienen 0 puntos.

**Objetivo:** ser la tabla competitiva de equipos a lo largo del tiempo, como incentivo para jugar partidas oficiales.

---

## Equipos (`#teams`)

**Funciones:** `rPub` (grilla y plantel) y `rCap` (capitanía). **Layout:** principal y lateral.

| Sección | Contenido |
|---|---|
| Equipos | Grilla de tarjetas: nombre, `[sigla]` y cantidad de jugadores. Al tocar una se selecciona el equipo. |
| Plantel | "Plantel: \<equipo\> · Capitán: \<tag\>". Tabla con Jugador (avatar, nick, "(C)" si es el capitán), Rating, K/D, HS %, ADR y Mapas. Al tocar un jugador se abre su perfil. |
| Solicitar Equipo (lateral) | Nombre (24) y sigla (5, en mayúsculas). **Enviar** hace `upsert` en `team_requests` con estado `pending`. Sin sesión, abre el diálogo de login. Debajo muestra el estado de la solicitud propia: "Pendiente.", "Aprobado." o "Rechazado.". |
| Mi capitanía (lateral) | Solo si el usuario es capitán de algún equipo. Por equipo, un selector con los miembros que tienen cuenta vinculada y el botón **Ceder capitanía** (RPC `set_team_captain`). Si ningún miembro tiene cuenta, lo avisa. |

**Objetivo:** ser el directorio de equipos oficiales y la puerta de entrada para que un usuario forme el suyo, que después aprueba un admin. También permite que el capitán delegue el rol.

---

## Jugadores (`#players`)

**Función:** `rViews`, con un listado paginado (`pub-players`, 15 por página).

- **Columnas:** Jugador (avatar y nick), Nivel (insignia 1–10 con color FACEIT), ELO, Equipo, Rating, K/D y "Ver".
- **Orden:** ELO descendente, después cantidad de mixes y después nick. Un jugador sin mixes muestra el `start_elo` configurado (1000).
- **Búsqueda:** por nick, nombre o sigla del equipo.

**Objetivo:** ser el ranking individual de la comunidad según el ELO de los mixes, y el punto de entrada a los perfiles.

---

## Perfil de jugador (`#jugador/<nick>`)

**Funciones:** `rProfile`, `ppHero`, `ppDraw` y `ppTabs`. La ruta busca por nick (sin distinguir mayúsculas) o por id. Botón "← Volver a Jugadores".

### Cabecera (`pp-hero`)

- Foto del jugador (o el avatar de la cuenta vinculada, o la inicial), bandera del país (flagcdn), nick y nombre real.
- Links a Steam y FACEIT, y Discord en texto.
- **Filas:**
  - Equipo actual (o "Libre"), Rol, País y Victorias / derrotas.
  - **ELO:** insignia de nivel, ELO y máximo.
  - **Logros:** hasta 3 medallas agrupadas ("2 x MVP").
- **Pie:** "Miembro desde …" y "Última conexión …".
- **Estado de reclamo:**
  - Perfil sin cuenta vinculada y usuario logueado: botón **Reclamar este perfil**, que inserta en `profile_requests` como `pending`. Si ya lo pidió, muestra "⏳ Solicitud pendiente".
  - Perfil vinculado: "✓ Este es tu perfil reclamado" o "🔒 Perfil reclamado y verificado".

### Privacidad (`privBlock`)

- `private`: solo lo ven el dueño y los admins. A los demás se les muestra "Este perfil es privado.".
- `members`: los visitantes sin sesión ven "Iniciá sesión para ver este perfil.".
- Con bloqueo, solo se muestra la cabecera mínima (foto, nick, equipo) y se oculta el cuerpo.

### Cuerpo

| Parte | Contenido |
|---|---|
| Tira de medallas | Una tarjeta por medalla, con ícono, título y contador si se repite. |
| Pestaña **Info** | Estadísticas con barras: progreso "Nivel N → N+1 · faltan X ELO", Rating, K/D, HS %, ADR, Win rate y Mapas jugados. Indica si las stats son "automáticas · N mixes" o "cargadas por el admin". Al lado, las 6 partidas más recientes (del equipo y mixes) con rival, competencia, K-D, rating y cambio de ELO; se pueden tocar. |
| Pestaña **Equipos** | Equipo actual e historial (una línea por equipo, texto que carga el admin). |
| Pestaña **Partidas** | Tabla completa: Fecha, Rival, Resultado, Mapas, Competencia, K-D y ELO. |
| Pestaña **Logros** | Medallas, palmarés (texto) y biografía. |
| Pestaña **Mapas** | "Mixes por mapa" calculado de las stats (Mixes, Victorias, K/D, ADR) y las stats por mapa cargadas por el admin. |

Los datos de la cuenta (país, redes, avatar) se piden aparte a `profile_details` y se guardan en `pdCache`.

**Objetivo:** ser la "ficha de jugador" estilo HLTV/FACEIT, con identidad, rendimiento, nivel e historial. Además permite que un usuario reclame su perfil.

---

## Detalle de partida (`#match-detail`)

**Función:** `rMatchDetail`. Se abre con `openMatchDetail(id)`. El id no va en la URL, así que no se puede compartir ni sobrevive a un recargo.

### Barra superior

- **"← Volver":** siempre va a Partidas.
- **Conectar a Servidor (Steam):** si la partida tiene `server_ip`.
- **Demo (solo mixes):**
  - **Descargar demo (X MB)** si `demo_status = uploaded`.
  - Si no, un aviso: "se está subiendo", "venció (90 días)" o "no se encontró".

### Bloques

| Bloque | Cuándo | Contenido |
|---|---|---|
| Hero | Siempre | "Encuentro: A vs B", marcador, mapa y estado. Para los no-mix el estado se muestra con el valor crudo en inglés (`upcoming`/`live`/`finished`). En una cancelada muestra el motivo y quién la canceló. En PCW, el roster de cada lado. |
| Estadísticas | Si hay `match_player_stats` (mixes) | Una tabla por equipo, ordenada por rating: insignia de nivel con que jugó, Jugador (link al perfil o "(sin perfil)"), K, D, A, +/-, HS %, ADR, Rating y ELO (cambio). Admin: **Borrar este mix**, que borra la partida y sus equipos temporales y recalcula las stats de los jugadores y el ELO de todos. |
| Veto de Mapas | No mix | Ver abajo. |
| Resultado | No mix | Ver abajo. |
| Chat en Vivo | Siempre | Últimos 50 mensajes (autor = tag). El input de 200 caracteres se ve siempre, pero sin sesión "Enviar" no hace nada y no avisa. |

### Veto (`rVeto`)

- **Pool:** dust2_ob, cbble, inferno, nuke, mirage, tuscan, season, train, cache.
- **Secuencia según el BO** (`vetoSeq`), alternando turnos desde el equipo 1.
- **Mensajes según quién mira:**
  - "Turno de X: banear/elegir".
  - "Es tu turno: tocá un mapa".
  - "Esperando al capitán de X".
  - "Solo los capitanes pueden vetar".
- **Grilla de mapas:**
  - Cada mapa aparece como banned o picked, con el equipo que lo eligió.
  - Cuando queda uno solo, se marca como "Decisivo".
  - Los mapas disponibles se pueden tocar si es el turno del capitán. Cada toque inserta una fila en `match_vetos`.
- **Al terminar:** muestra "Mapas a jugar: A → B → decisivo".
- **Admin:** **Reiniciar veto**.

### Resultado (`rResult`)

- **Estado del reporte:**
  - "Todavía no hay un resultado cargado".
  - "X cargó un resultado, falta que confirme Y".
  - "Coinciden, falta aprobación de un admin". En PCW se cierra solo.
  - "No coinciden, un admin va a definir".
  - "Resultado final".
- **Tarjetas de reporte:** serie, tabla de mapas y rondas, alineación, nota y miniaturas de las capturas.
- **Formulario de reporte (capitanes, partida no terminada):**
  - Si el usuario es capitán de los dos equipos, primero elige con cuál reporta.
  - Una fila por mapa del BO, precargada con los mapas del veto o con el reporte rival para confirmarlo. Muestra la serie en vivo.
  - Checkboxes del plantel para indicar quién jugó (en PCW se muestra el roster fijo).
  - Hasta 3 capturas, redimensionadas a 1280 px en JPEG, y una nota de 300 caracteres.
  - Botones: **Enviar mi reporte** o **Confirmar resultado**, y **Retirar mi reporte**.
  - Validaciones: rondas de 0 a 99, sin series empatadas, alineación de hasta 7 jugadores.
- **Admin:**
  - **Aprobar reporte de X** (por cada reporte).
  - **Cargar o forzar resultado** o **Corregir resultado**, que abren el diálogo `#rdl`.

### Actualización

`pollMatch` corre cada 5 s, solo con la pestaña visible. Redibuja solo lo que cambió: partida y reportes, veto, o chat.

**Objetivo:** ser la "sala" de cada partida, donde ocurre todo lo previo y lo posterior: conectarse, vetar mapas, acordar el resultado entre capitanes con pruebas y charlar. En los mixes funciona como scoreboard y para descargar la demo.

---

## Mi perfil (`#profile`)

**Función:** `rProfileView`. Requiere sesión.

| Sección | Contenido |
|---|---|
| Mi perfil (formulario) | Avatar (JPG, PNG, WebP o GIF de hasta 5 MB, recortado en el navegador a 256×256 JPEG), email (solo lectura), Nickname (2–24), Nombre real (letras, espacios, `.`, `'`, `-`), País (22 países de habla hispana y "Otro"), Rol (AWPer, Rifler, IGL, Support, Entry fragger, Lurker, Otro), Steam (SteamID64, link o nombre), FACEIT (nick o link) y Discord. **Guardar cambios**: `set_my_tag` si cambió el tag, sube el avatar al bucket `avatars` y hace `upsert` en `profile_details`. |
| Tu cuenta (automático) | Fecha de registro, Última conexión, Equipo actual, Partidas jugadas (partidas terminadas de su equipo) y Jugador vinculado (o "Ninguno (podés reclamar tu perfil desde la sección Jugadores)"). |
| Datos del jugador (los edita un administrador) | Si hay un jugador vinculado: Victorias / derrotas, Mapas jugados, Historial de equipos, Logros (medallas y texto), Biografía y Privacidad. Si no, un aviso. |

**Objetivo:** que cada usuario mantenga su identidad pública (nick, avatar, país, redes) y vea cómo está vinculado a su perfil de jugador y a su equipo.

---

## Admin → Torneos (`#cadm`)

**Funciones:** `rPend`, `rC` y `rEM`. **Layout:** principal y lateral.

| Sección | Contenido |
|---|---|
| Resultados pendientes de aprobación | Partidas no terminadas que tienen reportes. Etiqueta "[PCW]" si corresponde y el estado: "Falta que confirme el otro capitán", "Los capitanes coinciden: listo para aprobar" o "Disputa". Botón **Revisar** (abre el detalle) y **Aprobar** si los reportes coinciden. |
| Gestión de Torneos | Lista de torneos con su etapa. **Gestionar** carga el formulario y el panel de fixture. **X** elimina el torneo con sus partidas e inscripciones, previa confirmación. |
| Fixture del torneo (al gestionar) | Agregar un equipo (selector), lista de participantes en orden de siembra con Subir, Bajar y Quitar, y **Sortear el orden**. **Generar fixture** valida mínimos, borra las partidas previas, inserta el fixture y pasa el torneo a *En curso*. **Generar playoffs** solo aplica a grupos, con todos los partidos de grupo jugados. **Reiniciar fixture** borra todo y vuelve a *Inscripciones*. Después de generar, se bloquean los equipos y el formato. |
| Partidas del torneo | Cada partida con fase, equipos, marcador y botón **Resultado**, que abre `#rdl`. |
| Partidas Globales | Hasta 40 partidas sin `stage` (sueltas) o huérfanas, sin contar los mixes. Incluye las **PCW**, porque no tienen `stage`. Botones **Editar** y **X**. Si hay huérfanas, ofrece borrarlas todas juntas. |
| Nuevo / Editar Torneo (lateral) | Nombre, formato (Eliminación simple, Doble eliminación, Todos contra todos, Grupos + playoffs), BO de las partidas y de la final, cantidad de grupos y clasificados (solo en grupos), ida y vuelta (todos contra todos o grupos), mínimo y cupo máximo de equipos, premio, fechas y reglas. |
| Crear / Editar Partida (lateral) | Equipo 1 y 2 (solo oficiales), torneo, mapa, IP del servidor, fecha, estado, rondas de cada equipo, URL de demo y de video. |

### Diálogo "Resultado" (`#rdl`)

- Pide estado, fecha y una fila por mapa del BO (mapa con autocompletado del pool, rondas de cada equipo).
- Al guardar ejecuta `applyRes`:
  - calcula la serie;
  - impide empates en eliminación;
  - deshace el avance si se corrige un resultado que todavía se puede corregir;
  - avanza el bracket.
- Después hace `upsert` de las partidas afectadas y `finishE` recalcula el campeón y la etapa del torneo.

**Objetivo:** ser el centro de operaciones competitivo: crear y llevar torneos de punta a punta, administrar partidas sueltas y resolver los reportes de los capitanes.

---

## Admin → Jugadores (`#padm`)

**Funciones:** `rPA` y `rUnlinked`. **Layout:** principal y lateral.

| Sección | Contenido |
|---|---|
| Jugadores | Lista paginada (alfabética) con avatar, nick, rating, "🔗 tag" si tiene cuenta y "Steam ✓" si tiene SteamID. Botones **Ver**, **Editar** y **X** (borra sin confirmar). Búsqueda por nick, cuenta o equipo. |
| Medallas | Selector de jugador (con buscador), título y emoji. **Otorgar** inserta en `player_medals`. Debajo, la lista paginada de medallas con su **X**. |
| Map Pool Stats | Jugador, mapa, rating, K/D y mapas jugados. **Guardar** inserta en `player_map_stats`. Lista paginada con **X**. |
| SteamID sin vincular | SteamID64 que aparecieron en mixes y no tienen jugador asignado: último nick, SteamID, cantidad de mixes y fecha del último. Selector con los jugadores que no tienen SteamID (si hay uno con el mismo nick, viene preseleccionado). **Vincular** usa `link_steam_id`. **Crear jugador** inserta un jugador con ese nick y lo vincula. |
| Nuevo / Editar Jugador (lateral) | Nick, foto (bucket `photos`), Rating, K/D, HS %, ADR, Mapas jugados, Victorias, Derrotas, Historial de equipos, Logros, Biografía, SteamID (STEAM_0, SteamID64 o link), "Stats automáticas desde los mixes", privacidad (público, solo registrados, privado) y cuenta vinculada (selector con buscador). Impide vincular una cuenta a dos jugadores. Si cambió el SteamID, llama a `link_steam_id`. |

**Objetivo:** curar la base de jugadores: datos manuales, reconocimientos, y conexión entre jugadores, cuentas web y SteamID del servidor, para que stats y ELO lleguen al perfil correcto.

---

## Admin → Equipos (`#tadm`)

**Función:** `rTA`. **Layout:** principal y lateral.

| Sección | Contenido |
|---|---|
| Solicitudes | Solicitudes `pending` de `team_requests` con `[sigla] nombre`. **Aprobar** crea el equipo con el solicitante como dueño y capitán, con el plantel vacío, y marca la solicitud `approved`. **Rechazar** la marca `rejected`. |
| Equipos | Lista con nombre y cantidad de jugadores. **Editar** y **X** (borra sin confirmar). |
| Nuevo / Editar Equipo (lateral) | Nombre, sigla, capitán (selector con buscador de todas las cuentas conocidas), "Jugadores del equipo" (elegidos, con Quitar) y "Agregar jugadores" (buscador paginado que excluye a los que ya están en otro equipo). Al crear, el dueño (`owner_id`) es el admin que lo crea. |

**Objetivo:** aprobar los equipos que piden los usuarios y armar los planteles oficiales, que son la base de los torneos, los capitanes y el ranking.

---

## Admin → Verificaciones (`#vadm`)

**Función:** `rPA` (la misma que Jugadores; se dibuja con cualquiera de las dos vistas visible).

- **Filtros:** búsqueda por nick o usuario (con espera de 300 ms) y estado (Todas, **Pendientes** por defecto, Aprobadas, Rechazadas).
- **Cada solicitud muestra:** "\<nick\> | Usuario: \<tag\> | Estado: ⏳/✅/❌".
- **Acciones:**
  - Pendiente: **Aprobar** (`players.user_id = usuario` y la solicitud pasa a `approved`) o **Rechazar**.
  - Aprobada: **Revocar** (desvincula y pasa la solicitud a `rejected`).
  - Siempre: **Borrar** (desvincula y elimina la solicitud).

**Objetivo:** validar que quien reclama un perfil de jugador es realmente esa persona antes de darle el control del perfil y su identidad pública.

---

## Admin → Servidores (`#sadm`)

**Función:** `rSrv`. **Layout:** principal y lateral.

| Sección | Contenido |
|---|---|
| Servidores de juego | Por servidor: nombre, estado (Activo o Revocado) y última conexión. **Nuevo token** (`rotate_server_token`, invalida el anterior) y **Revocar** / **Reactivar** (`game_servers.active`). |
| Token del servidor | Aparece al crear o rotar un token. Muestra las tres líneas listas para pegar en `csstv_reporter.cfg` (`csstv_api_url`, `csstv_api_key`, `csstv_server_token`) y el botón **Copiar**. El token no se vuelve a mostrar. |
| Nuevo servidor (lateral) | Nombre y **Crear y generar token** (`create_server_token`). |
| ELO (lateral) | Base, ELO inicial, bonus máximo por rating, puntos por 1.00 de rating y ELO mínimo. Muestra un ejemplo en vivo ("gana +30 / pierde −30; con rating 1.40: +34; un jugador nuevo empieza en nivel 4"). Checkbox "Recalcular todos los mixes". **Guardar** (`elo_set_config`) y **Recalcular ELO** (`elo_recompute_all`), ambos con confirmación. |

**Objetivo:** conectar la web con el servidor de juego (dar de alta y gestionar quién puede reportar mixes) y ajustar el sistema de ELO sin tocar la base de datos.

---

## Componentes reutilizables

| Componente | Dónde se usa | Qué hace |
|---|---|---|
| `pager(box, key, items, rowFn, opciones)` | Mixes, Jugadores, listas de admin, rosters | Lista o tabla paginada con búsqueda (sin tildes ni mayúsculas), 10, 15 o 25 por página, contador "Mostrando X–Y de N" y paginador con elipsis. Recuerda página y búsqueda en `PG[key]`. |
| `enhanceSelect(id)` | Selectores de medallas, stats por mapa, cuenta vinculada, capitán | Agrega un campo de búsqueda que filtra las opciones de un `<select>`. |
| `rosterPicker` | PCW (publicar y aceptar) | Arma un roster de 1 a 7 con jugadores registrados y tags invitados, y puede cargar el plantel de un equipo propio. |
| `mtbl` / `mrow` | Inicio, Partidas, Resultados, Torneos, PCW | Tabla estándar de partidas con Conectar, Demo, Video y Ver. |
| `mixTbl` / `mixRow` | Inicio, Mixes | Tabla de mixes con MVP y etiqueta de cancelada. |
| `lvlBadge` / `eloDelta` | Jugadores, perfil, detalle de mix | Insignia del nivel FACEIT (color según la tabla `LV`) y cambio de ELO en verde o rojo. |
| `showToast` | Toda la app | Avisos de éxito o error que desaparecen solos. |

## Módulos de lógica (sin interfaz propia)

| Módulo | Funciones | Para qué |
|---|---|---|
| Motor de torneos | `genKO`, `genDE`, `genGroups`, `rrPairs`, `seedOrder`, `genPlayoffs`, `settle`, `applyRes`, `routeOne`, `unroute`, `blocked`, `standings`, `champOf`, `finishE` | Generar fixtures, avanzar brackets, calcular posiciones y definir al campeón. Todo corre en el navegador y se guarda con escrituras directas. |
| ELO y niveles | `LV`, `eloRow`, `eloOf`, `lvlOf`, `eloCfg` | Mostrar el nivel 1–10 a partir de `player_elo`. El cálculo del ELO lo hace Supabase. |
| Reportes | `repState`, `sendReport`, `adminApply`, `prepProof`, `vetoMaps` | Flujo de resultados entre capitanes y su aprobación. |
| Validación de datos de usuario | `cleanSteam`, `cleanFaceit`, `steamLink`, `faceitLink`, `prepAvatar` | Normalizar y validar redes y avatar antes de guardar. |
| Datos y sesión | `load`, `loadImpl`, `soft`, `setS`, `touchSeen` | Carga completa de las tablas, manejo de errores no críticos, sesión y rol. |
| Ruteo | `V`, `show`, `handleRoute`, `render`, `shown` | Navegación por hash y dibujo de las vistas visibles. |

## Detalles observados al revisar el código

Cosas que no rompen nada pero conviene tener presentes al diseñar el próximo frontend:

1. **Inicio → Torneos Activos** muestra los 3 primeros torneos sin filtrar por estado.
2. **Partidas Globales** (Admin → Torneos) lista también las PCW.
3. **El hero del detalle** muestra el estado crudo (`upcoming`, `live`, `finished`) en partidas que no son mixes.
4. **El chat** muestra el input a visitantes sin sesión, pero no envía ni avisa.
5. **"← Volver" en el detalle** siempre va a Partidas, aunque se haya llegado desde Mixes, PCW, un torneo o un perfil.
6. **Borrar sin confirmar:** la **X** de jugadores y equipos en admin no pide confirmación. La de torneos, el veto y los mixes sí la piden.
7. **Inscripción a torneos:** solo la ve el **dueño** del equipo, aunque la base también permite inscribir al capitán.
8. **Campo de tag del registro:** el diálogo limita a 20 caracteres, mientras que la validación y el perfil aceptan hasta 24.
9. **Mi perfil** dice "podés reclamar tu perfil desde la sección Jugadores", pero el botón está dentro de cada perfil de jugador, no en la lista.
