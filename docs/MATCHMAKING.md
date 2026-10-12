# Matchmaking CS:S v34 (5v5)

Esta rama agrega una cola individual para 10 jugadores, balance por ELO y selección automática de un servidor libre.

## Requisitos
- Supabase existente con las migraciones de CSSTV y `elo_config` aplicadas.
- Cada usuario necesita un perfil en `players` vinculado con `players.user_id` y un SteamID64 válido en `players.steam_id`.
- Debe existir al menos un servidor en Admin → Servidores.

## Activación
1. Aplicá `supabase/migrations/20261012020000_matchmaking_5v5.sql` y `supabase/migrations/20261012060000_matchmaking_queue_admin_control.sql` (la segunda ya está aplicada en el proyecto Supabase conectado).
2. Publicá `matchmaking.html` junto a `index.html`, `config.js` y `csstv-theme.css`.
3. En la web, un admin abre Matchmaking → Administración de servidores, selecciona un servidor, configura la dirección pública `IP:PUERTO` y habilita el matchmaking.
4. Un admin puede abrir/cerrar la queue desde el panel **Control de queue**. Cerrarla impide nuevas entradas y asignaciones; las partidas ya asignadas no se cancelan. Los jugadores inician sesión y pulsan **Buscar partida**. Al llegar a 10, se crea un mix, se balancean las cinco posiciones por lado minimizando la diferencia total de ELO y se reserva el servidor libre.

## Importante
Esta versión asigna el servidor y muestra `connect IP:PUERTO` / enlace de Steam. No ejecuta RCON ni cambia automáticamente el mapa o mueve jugadores dentro del servidor. Para esa automatización hace falta un plugin SourceMod de despacho autenticado; la asignación y la cola sí quedan guardadas en Supabase.
