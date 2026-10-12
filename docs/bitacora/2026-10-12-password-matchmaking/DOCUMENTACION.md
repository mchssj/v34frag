# Documentación: contraseña al asignar partidas

## Causa raíz
`server/addons/sourcemod/scripting/csstv_matchmaking_dispatcher.sp` recibía el roster desde `matchmaking_server_poll`, pero exigía `count == MM_MAX_STEAMIDS` (10). En modos 1v1, 2v2 y 3v3 devolvía antes de copiar la asignación o ejecutar `ServerCommand("sv_password ...")`.

## Corrección
El dispatcher acepta exclusivamente los tamaños válidos de los modos configurados:
- 1v1: 2 SteamID.
- 2v2: 4 SteamID.
- 3v3: 6 SteamID.
- 5v5: 10 SteamID.

Cualquier otra cantidad se rechaza y se registra en el log. Con un roster válido, el flujo existente almacena la contraseña de la partida, activa el roster permitido, ejecuta `sv_password` y, si corresponde, cambia al mapa asignado.

La versión de origen del dispatcher sube a 1.1.0.

## Importante
La corrección del archivo `.sp` no actualiza por sí sola un plugin `.smx` ya instalado. Para que el servidor real lo ejecute, hay que compilar el fuente corregido, instalar el `.smx` generado y recargar el plugin. No se considera desplegado hasta comprobarlo en el servidor.
