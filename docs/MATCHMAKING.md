# Matchmaking CS:S v34 (formatos configurables)

Esta rama agrega colas individuales configurables de 1v1, 2v2, 3v3 y 5v5, balance por ELO y selección automática de un servidor libre. 5v5 está habilitado por defecto; los demás formatos se activan desde el panel de administración.

## Requisitos
- Supabase existente con las migraciones de CSSTV y `elo_config` aplicadas.
- Cada usuario necesita un perfil en `players` vinculado con `players.user_id` y un SteamID64 válido en `players.steam_id`.
- Debe existir al menos un servidor en Admin → Servidores.
- SourceMod y la extensión System2 en el servidor CS:S v34.

## Activación web y Supabase
1. Las migraciones de matchmaking están en `supabase/migrations/`: `20261012020000_matchmaking_5v5.sql`, `20261012060000_matchmaking_queue_admin_control.sql`, `20261012061000_matchmaking_queue_state_access_hardening.sql`, `20261012062000_matchmaking_server_dispatch.sql` y `20261012063000_matchmaking_dispatch_recovery_and_password.sql` y `20261012220000_matchmaking_modos_configurables.sql`. Las migraciones base y la de formatos configurables ya se aplicaron directamente al proyecto Supabase conectado.
2. Publicá `matchmaking.html`, `js/matchmaking.js` y `js/matchmaking-data.js` junto a los archivos existentes de la web.
3. En Matchmaking → Administración de servidores, configurá la dirección pública `IP:PUERTO` y habilitá el servidor.
4. Un admin puede abrir/cerrar la queue y habilitar/deshabilitar cada formato desde **Control de queue**. Cerrarla impide nuevas entradas y asignaciones, sin cancelar partidas ya asignadas.

## Dispatcher de servidor (independiente del Reporter)
El nuevo código está en `server/addons/sourcemod/scripting/csstv_matchmaking_dispatcher.sp`. No reemplaza ni modifica `csstv_reporter.sp`.

1. Compilá el archivo con el `spcomp` de tu instalación de SourceMod y el include de System2 usado por el Reporter. El resultado es `csstv_matchmaking_dispatcher.smx`.
2. Subí el `.smx` a `addons/sourcemod/plugins/` y cargalo con `sm plugins load csstv_matchmaking_dispatcher` o reiniciá el servidor.
3. En `cfg/sourcemod/csstv_matchmaking_dispatcher.cfg`, configurá estos valores:
   - `csstv_mm_api_url "https://wmzfwsizashpszxlvpeb.supabase.co/rest/v1/rpc"`
   - `csstv_mm_api_key`: la clave pública anon/publishable de la web.
   - `csstv_mm_server_token`: el token secreto de este servidor, el mismo que usa `csstv_server_token` en el Reporter.
   - `csstv_mm_idle_password`: una contraseña privada fuerte para cuando no haya mix.
4. No publiques el token del servidor ni la contraseña idle. No uses una service-role key en el plugin.
5. El dispatcher consulta la asignación autenticada, cambia `sv_password` a una contraseña `fragNNNN`, cambia al mapa indicado por la partida (o `de_dust2` si no hay mapa configurado) y expulsa a los que no pertenecen al roster. La web muestra la contraseña solo a usuarios con una asignación activa en esa partida.
6. Para liberar la asignación desde la web, un administrador usa **Liberar servidor** una vez confirmado que terminó el mix. En la siguiente consulta, el dispatcher restaura la contraseña idle.

## Límites de verificación
El código fuente del dispatcher está agregado, pero no pude compilarlo ni instalarlo en el hosting desde esta sesión. No se debe considerar activado hasta generar el `.smx`, configurarlo y probar con diez cuentas reales. El cierre automático por marcador no está conectado al Reporter para respetar el pedido de mantenerlo intacto; la liberación se realiza desde el panel de admin.
