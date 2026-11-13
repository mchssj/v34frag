# sv_pure con skins de armas: guía de implementación

## Estado

Desplegado en #1, #2 y #3 el 2026-11-13. Entra en el próximo cambio de mapa de cada servidor. **No probado** con un jugador: falta entrar con una skin de arma (tiene que verse) y con una textura de pared modificada (no tiene que verse).

## Archivos

| Archivo | Cambio |
|---|---|
| `server/pure_server_whitelist.txt` | Nuevo: la whitelist |
| `CLAUDE.md` | Configuración obligatoria: `sv_pure 1` con la whitelist |
| `docs/manual/jugador/skins-de-armas.md` | Nueva página |
| `docs/manual/servidor-externo/configuracion-obligatoria.md` | `sv_pure 1` con la whitelist |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `terms/terminos.html` | Excepción de las skins de armas en "Juego limpio" |
| `docs/bitacora/2026-11-13-sv-pure-skins-armas/` | Esta carpeta |

## Despliegue (hecho el 2026-11-13)

Por la API del panel de MVZG, en los tres servidores, sin reiniciar ni cambiar de mapa. Cada archivo se volvió a bajar para comparar.

1. `cstrike/pure_server_whitelist.txt` (copia de `server/pure_server_whitelist.txt`).
2. `sv_pure 2` → `sv_pure 1` (y `"2"` → `"1"`) en `cfg/server.cfg` (dos líneas), `cfg/autoexec.cfg` y, solo en el #1, `cfg/game.cfg`. Respaldo de cada uno en `cfg/<archivo>.bak_pure`.

## Pruebas

No se probó en el servidor local: Kyan decidió que no hacía falta por ser solo configuración. Para comprobarlo en un servidor, después del cambio de mapa:

1. Con una skin de AK en `cstrike/`: tiene que verse la skin.
2. Con una textura de pared modificada: tiene que verse la original.
3. `sv_pure` en la consola del servidor tiene que decir `1`.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

En cada servidor, copiar `cfg/server.cfg.bak_pure`, `cfg/autoexec.cfg.bak_pure` (y en el #1 `cfg/game.cfg.bak_pure`) sobre sus originales y borrar `cstrike/pure_server_whitelist.txt`. Revertir el commit en el repo.
