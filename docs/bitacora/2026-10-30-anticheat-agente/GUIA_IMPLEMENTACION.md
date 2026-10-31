# CMLeague Anticheat, la aplicación: guía de implementación

## Estado

Aplicación mínima compilada y probada contra la API local (2026-10-30). Sin distribuir ni firmar. No captura pantalla ni lista procesos.

## Archivos

| Archivo | Cambio |
|---|---|
| `agent/` | Nuevo: la aplicación |
| `supabase/replanteo/39_anticheat.sql`, su inversa, `web/backend/src/routes/anticheat.ts`, `src/db/types.ts` | `ac_agent_unlink` y `POST /api/v1/anticheat/unlink` |
| `web/backend/test/integration/anticheat.test.ts` | Prueba con el ejecutable real |

## Despliegue

Compilar con `agent\build.bat`. Sale `agent\build\CMLeagueAC.exe`, de 64 bits y sin DLL externas. Antes de repartirlo hace falta un certificado de firma: sin él, SmartScreen y los antivirus lo van a advertir.

## Pruebas

| Qué | Resultado |
|---|---|
| Compilación con `/W4 /WX` | Sin advertencias |
| Imagen de cada pantalla | Revisadas |
| Ejecutable real contra la API local: vincular, abrir y cerrar sesión, sin conexión y reconexión | Pasa |
| Tokens cifrados en disco y fuera del registro | Pasa |
| Instalar y desinstalar | Ver abajo |

**Sin probar:** la API de producción (`api.cmleague.lat`), los clics de la ventana, la bandeja, Windows 11 y antivirus. La prueba usa `--auto-link` en vez del botón.

## En qué se apartó del plan

- Se agregó desvincular en el servidor: antes el botón solo borraba los tokens locales.

## Cómo revertir

Desinstalar desde Configuración de Windows, o con `CMLeagueAC.exe --uninstall`. Borra programa, acceso directo, registro y datos locales. En el código, `git revert`.
