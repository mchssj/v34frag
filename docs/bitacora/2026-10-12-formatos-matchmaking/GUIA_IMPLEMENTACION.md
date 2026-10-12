# Guía de implementación: formatos de matchmaking

## Archivos modificados
- `matchmaking.html`: selector de formato para jugadores y controles de administración.
- `js/matchmaking.js`: estado y capacidad dinámica de la cola, selector y llamadas RPC.
- `supabase/migrations/20261012220000_matchmaking_modos_configurables.sql`: configuración de modos y funciones de matchmaking.
- `docs/bitacora/2026-10-12-formatos-matchmaking/`: documentación del requerimiento.

## Aplicación
1. Publicar los archivos web de la rama `feat/matchmaking-5v5`.
2. En el SQL Editor del proyecto Supabase correcto, ejecutar el contenido completo de la migración `20261012200000_matchmaking_modos_configurables.sql`.
3. Recargar la web sin caché e ingresar con una cuenta administradora.
4. En **Control de queue**, habilitar 1v1, 2v2 o 3v3.
5. Abrir una sesión de jugador, seleccionar un formato habilitado y entrar a la cola con la cantidad exacta de cuentas/perfiles vinculados necesaria para completarlo.
6. Confirmar que la partida se crea con el formato y roster correctos, que se asigna el servidor y que el plugin recibe todos los SteamID del roster.
7. Deshabilitar el formato de prueba al terminar si no se quiere dejar abierto para los jugadores.

## Pruebas recomendadas
- Probar 1v1 con 2 usuarios, 2v2 con 4, 3v3 con 6 y 5v5 con 10.
- Confirmar que un modo deshabilitado no aparece en el selector ni acepta entradas directas por RPC.
- Confirmar que un usuario en cola no puede cambiar de modo sin cancelar.
- Confirmar que el cierre global de queue sigue impidiendo nuevas asignaciones.
- Confirmar que los usuarios sin perfil vinculado o SteamID64 válido siguen siendo rechazados.

## Estado real
- Código y migración: guardados en GitHub, rama `feat/matchmaking-5v5`.
- Migración aplicada en Supabase: sí, en el proyecto `wmzfwsizashpszxlvpeb` (2026-10-12).
- Migración aplicada en Supabase: sí, en el proyecto `wmzfwsizashpszxlvpeb` (2026-10-12).
- Publicación de la web: pendiente de confirmar.
- Pruebas end-to-end con varias cuentas y servidor real: pendientes. No se debe considerar funcional en producción hasta completar esas verificaciones.
