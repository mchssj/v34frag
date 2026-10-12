# Guía de implementación: identidad y SteamID64 en matchmaking

## Archivos relevantes
- `js/matchmaking.js`
- `supabase/migrations/20261012220000_matchmaking_modos_configurables.sql` (incluye la validación SQL de SteamID64 y ya está aplicada)

## Despliegue web
1. Publicar los archivos actualizados de la rama `feat/matchmaking-5v5`.
2. Recargar la web sin caché, cerrar sesión y volver a iniciar sesión si hace falta.
3. Probar el botón de matchmaking con la cuenta afectada y verificar el nickname.

## Comprobaciones si aún falla
Revisar sin modificar datos:
```sql
select id, nick, user_id, steam_id
from public.players
where user_id = auth.uid();
```
Si no devuelve la fila correcta, el perfil del jugador no está asociado a esa cuenta. No pegar datos privados ni tokens en reportes públicos.

## Estado de verificación
- Código actualizado en GitHub: sí.
- Validación SQL equivalente aplicada como parte de la migración de formatos: sí.
- Publicación del JavaScript: pendiente de confirmar.
- Prueba con la cuenta afectada: pendiente.
