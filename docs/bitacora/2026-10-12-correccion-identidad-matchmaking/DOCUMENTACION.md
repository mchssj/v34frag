# Documentación: corrección de identidad en matchmaking

## Cambios
- `js/matchmaking.js`: al iniciar sesión, la tarjeta intenta cargar `players.nick` del jugador asociado por `players.user_id` y `profiles.tag`. Prioridad: nickname del jugador, tag del perfil, metadata de registro y, por último, parte local del email.
- `supabase/migrations/20261012180000_matchmaking_steamid64_nickname.sql`: reemplaza `matchmaking_join()` para aceptar tanto `7656119` + 10 dígitos como `765612` + 11 dígitos, en línea con los formatos admitidos por las funciones de SteamID64 y ELO.
- El mensaje de error distingue que el perfil debe estar asociado a la cuenta, además de tener un SteamID64 válido.

## Importante
El sistema sigue requiriendo una fila de `public.players` con `user_id = auth.uid()` y un `steam_id` válido. Tener un SteamID en el campo informativo del perfil no garantiza por sí solo que esa relación exista. No se crea esa relación automáticamente por motivos de seguridad.

## Estado
Cambios guardados en la rama `feat/matchmaking-5v5`. La migración debe aplicarse en el proyecto Supabase correspondiente. No se han ejecutado pruebas de producción ni se ha confirmado el arreglo con la cuenta afectada.
