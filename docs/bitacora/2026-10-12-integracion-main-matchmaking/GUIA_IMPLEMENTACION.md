# Guía de implementación: integración de main en matchmaking 5v5

## Estado

| Elemento | Estado al integrar |
|---|---|
| PR #7 hacia `feat/matchmaking-5v5` | Fusionado el 2026-10-12 |
| Worker de Cloudflare | Archivos integrados; despliegue no validado en esta tarea |
| Migraciones de Supabase | Archivos integrados; no se ejecutaron como parte del merge |
| Fuentes SourceMod | Integrados desde `main` |
| Binario `csstv_reporter.smx` | Pendiente comprobar/compilar contra el fuente actualizado |
| Interfaz de matchmaking (`index.html`) | Conservada desde `feat/matchmaking-5v5` |
| Pruebas end-to-end | Pendientes después de la integración |

## Archivos principales

- `cloudflare/demo-worker/`: Worker de descarga y subida de demos a R2.
- `supabase/migrations/20261012120000_demos_y_canceladas.sql`: cambios para demos y partidas canceladas.
- `supabase/migrations/20261012140000_motivo_abandono.sql`: motivo de abandono.
- `docs/bitacora/2026-10-12-demos-r2-worker/pruebas/`: scripts SQL y escenarios de prueba.
- `server/addons/sourcemod/scripting/csstv_reporter.sp` y `csstv/*.inc`: fuentes actualizados del plugin.
- `index.html`: se mantuvo la versión de la rama de matchmaking.

## Validación recomendada

1. Revisar el diff final de la rama y confirmar que la interfaz de matchmaking sigue presente.
2. Aplicar las migraciones solo si aún no están aplicadas en el proyecto Supabase de destino; evitar ejecutarlas a ciegas en producción.
3. Instalar dependencias del Worker con `npm install` dentro de `cloudflare/demo-worker/` y comprobar configuración/secretos antes de desplegar.
4. Compilar `csstv_reporter.sp` con la versión de SourceMod compatible con el servidor y verificar el plugin resultante antes de copiar el `.smx`.
5. Probar subida y descarga de una demo, partidas canceladas y el flujo de matchmaking.
6. Revisar los logs del Worker, Supabase y SourceMod después de las pruebas.

## Reversión

El PR #7 y su commit de merge permiten localizar exactamente esta integración. Para revertirla, revisar primero los cambios posteriores que dependan de ella y preparar un revert del commit de merge en GitHub; no sobrescribir manualmente la rama ni borrar migraciones que ya hayan sido aplicadas sin un plan de reversión de base de datos.
