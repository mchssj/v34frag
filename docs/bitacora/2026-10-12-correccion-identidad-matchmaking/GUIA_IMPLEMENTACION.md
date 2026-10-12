# Guía de implementación: identidad y SteamID64 en matchmaking

## Archivos modificados
- `js/matchmaking.js`
- `supabase/migrations/20261012220000_matchmaking_modos_configurables.sql` (incluye la validación SteamID64 aplicada)

## Despliegue
1. Publicar la versión actualizada de `js/matchmaking.js` junto con el resto de archivos de la rama `feat/matchmaking-5v5`.
2. La validación SQL de SteamID64 ya está incluida en `20261012220000_matchmaking_modos_configurables.sql`, aplicada al proyecto `wmzfwsizashpszxlvpeb`; no ejecutar la migración anterior de identidad por separado.
3. Publicar los archivos web de la rama `feat/matchmaking-5v5`.
4. Cerrar sesión y volver a iniciar sesión en la web, o recargar sin caché.
5. Probar el botón de matchmaking con la cuenta afectada.

## Comprobaciones si aún falla
Revisar sin modificar datos:
```sql
select id, nick, user_id, steam_id
from public.players
where user_id = auth.uid();
```
Si no devuelve la fila correcta, el perfil del jugador no está asociado a esa cuenta. Si devuelve una fila, verificar que `steam_id` sea un SteamID64 válido de 17 dígitos y que corresponda al perfil correcto. No pegar datos privados ni tokens en reportes públicos.

## Estado de verificación
- Código actualizado en GitHub: sí.
- Validación SQL equivalente aplicada como parte de la migración de formatos: sí.
- Publicación del JavaScript: pendiente de confirmar.
- Prueba con la cuenta afectada: pendiente.
