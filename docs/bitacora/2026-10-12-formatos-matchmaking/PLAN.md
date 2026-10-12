# Plan: formatos de cola configurables

## Necesidad
Poder probar distintos tamaños de partida sin cambiar manualmente el código: 1v1, 2v2, 3v3 y 5v5.

## Objetivos
1. Permitir al administrador habilitar o deshabilitar cada formato desde el panel de matchmaking.
2. Mostrar a los jugadores únicamente los formatos habilitados y permitir seleccionar uno antes de entrar a la cola.
3. Hacer que la base de datos agrupe jugadores por formato y cree partidas con el tamaño correcto.
4. Mantener la administración global de la cola, la validación de SteamID64, el asignador de servidores y los datos de roster.

## Comportamiento inicial
- 5v5 habilitado.
- 1v1, 2v2 y 3v3 deshabilitados hasta que el administrador los active.
- Cada usuario puede estar en una sola cola a la vez; debe cancelar su búsqueda antes de elegir otro formato.
- Los formatos deshabilitados no aceptan nuevas entradas ni se consideran para crear nuevas partidas.

## Alcance
No se cambia el plugin del servidor ni se alteran partidas que ya fueron asignadas. La configuración se guarda en Supabase y la interfaz web la consulta mediante RPC.
