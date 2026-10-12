# Guía de implementación: identidad y SteamID64 en matchmaking

## Archivos modificados
- `js/matchmaking.js`
- `supabase/migrations/20261012180000_matchmaking_steamid64_nickname.sql`

## Despliegue
1. Publicar la versión actualizada de `js/matchmaking.js` junto con el resto de archivos de la rama `feat/matchmaking-5v5`.
2. Abrir Supabase SQL Editor del proyecto correcto.
3. Ejecutar el contenido completo de `supabase/migrations/20261012180000_matchmaking_steamid64_nickname.sql`.
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
- Migración aplicada en Supabase: pendiente.
- Publicación del JavaScript: pendiente de confirmar.
- Prueba con la cuenta afectada: pendiente.
