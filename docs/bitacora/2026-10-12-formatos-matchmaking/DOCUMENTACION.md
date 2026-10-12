# Documentación: formatos configurables de matchmaking

## Formatos
La tabla `public.matchmaking_modes` guarda el tamaño por equipo y si el formato está habilitado. Los formatos válidos son `1v1`, `2v2`, `3v3` y `5v5`. La migración deja 5v5 habilitado y los otros tres deshabilitados por defecto.

La columna `public.matchmaking_queue.mode` identifica la cola de cada jugador. `public.matches.matchmaking_mode` registra el formato de la partida creada.

## Panel de administración
En `matchmaking.html`, el bloque **Control de queue** incluye interruptores para habilitar o deshabilitar cada formato. El cambio se guarda mediante `matchmaking_set_mode(p_mode, p_enabled)`, que comprueba el rol de administrador.

## Experiencia del jugador
El selector **Formato de cola** lista los modos habilitados. La interfaz adapta el encabezado, el indicador de jugadores y los espacios del lobby al tamaño seleccionado. Al entrar, llama a `matchmaking_join(p_mode)`.

Un usuario no puede anotarse en dos formatos a la vez. Si ya está esperando, debe cancelar la búsqueda antes de cambiar de formato. Si está en una partida activa, no puede entrar a otra cola.

## Creación de partidas
`matchmaking_try_match_unchecked()` selecciona una cola habilitada con suficientes jugadores y crea una partida de `2 × jugadores_por_equipo`. Los jugadores se seleccionan por antigüedad y se distribuyen entre equipos mediante un patrón serpenteante basado en ELO descendente. La asignación sigue requiriendo un servidor activo, libre y habilitado para matchmaking.

`matchmaking_queue_state()` devuelve el estado global de la cola, los formatos habilitados y la cantidad de jugadores esperando en cada uno. El cierre global de queue sigue bloqueando nuevas entradas y asignaciones.

## Seguridad
La configuración de formatos no se expone directamente para escritura desde el cliente. Los cambios pasan por una función RPC con validación del rol `admin`. La entrada a la cola valida sesión, SteamID64 asociado al perfil, estado global y habilitación del formato.
