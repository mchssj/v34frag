# Plan: aplicar la contraseña al asignar partidas de cualquier formato

## Problema
El dispatcher de SourceMod valida que el roster tenga exactamente 10 SteamID. Esa validación corta el procesamiento de partidas 1v1, 2v2 y 3v3 antes de ejecutar `sv_password`.

## Objetivos
- Aceptar rosters completos de 2, 4, 6 o 10 jugadores.
- Mantener la validación estricta para no abrir el servidor ante un roster incompleto o inesperado.
- Aplicar contraseña, mapa y roster únicamente cuando la respuesta del dispatcher sea válida.
- Registrar el cambio en la bitácora y verificar qué falta desplegar.

## Alcance
Se corrige el código fuente de `csstv_matchmaking_dispatcher.sp`. La publicación requiere compilar el plugin y reemplazar el `.smx` que esté ejecutándose en el servidor. No se modifica la contraseña de ninguna partida activa desde SQL.
