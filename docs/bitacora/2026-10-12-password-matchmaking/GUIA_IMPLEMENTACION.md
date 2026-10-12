# Guía de implementación: contraseña dinámica del servidor

## Archivo modificado
- `server/addons/sourcemod/scripting/csstv_matchmaking_dispatcher.sp` (versión 1.1.0).

## Despliegue
1. Compilar el archivo con el compilador de SourceMod compatible con el servidor CS:S v34 y las extensiones/includes que ya usa el proyecto, incluido System2.
2. Hacer una copia de seguridad del plugin dispatcher `.smx` actualmente instalado.
3. Subir el `.smx` compilado a `addons/sourcemod/plugins/`, con el nombre que realmente use el servidor.
4. Recargar ese plugin desde la consola de servidor o reiniciar el servidor si corresponde.
5. Consultar `sm_csstv_mm_status` y revisar el log de SourceMod. No publicar ni compartir tokens secretos del servidor.
6. Con una partida de prueba 1v1, comprobar que desaparece el error de roster de 10 SteamID y que la contraseña del servidor coincide con la que muestra el panel. Repetir con 2v2, 3v3 y 5v5.
7. Verificar que un roster con tamaño inesperado se rechace y no cambie la contraseña.

## Estado real
- Corrección en fuente GitHub: integrada en `feat/matchmaking-5v5`.
- Compilación del `.smx`: pendiente.
- Instalación/recarga en el servidor real: pendiente de confirmar.
- Prueba end-to-end de cambio de contraseña: pendiente.

No modificar manualmente la contraseña de una partida activa en la base de datos como sustituto de actualizar el plugin: el dispatcher debe aplicar el valor recibido y el servidor debe confirmarlo.
