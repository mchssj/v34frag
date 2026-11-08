# La rama del frontend igual a producción: guía de implementación

## Estado

**Desplegado el 2026-11-04 (13:30 UTC):** API `15a357169528`, desde esta rama. Merge en `main` hecho el 2026-11-04. A los servidores de juego no se les subió nada. **Falta:** abrir `/help` con una sesión iniciada.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/backend/src/lib/manual.ts`, `lib/manual-node.ts`, `routes/manual.ts` y `test/unit/manual.test.ts` | Nuevos, de `deploy/api-produccion` |
| `web/backend/src/app.ts` | Monta el manual; sin las líneas del anticheat |
| `web/backend/src/node.ts`, `lib/auth.ts`, `lib/types.ts`, `scripts/build.mjs` y `tsconfig.json` | De `deploy/api-produccion`; solo traen lo del manual |
| `server/addons/sourcemod/scripting/` | Reporter 2.9.3 y plugins nuevos, de `origin/kyan/pruebas` |
| `server/addons/sourcemod/plugins/*.smx` | Copiados de los servidores (reporter, `qol`, `coach`, `pedir` y `v34_dm` del #1; `password` del #2; `v34_retake` y `v34_wingman` del #3) |
| `server/addons/sourcemod/configs/retake/` y `2v2/de_dust2_ob.cfg` | Nuevos, de `origin/kyan/pruebas` |
| `server/cfg/csstv/live.cfg` y `server/cfg/sourcemod/csstv_qol.cfg` | Copiados del #1 |
| `server/cfg/sourcemod/csstv_reporter.cfg` | Valores nuevos de `kyan/pruebas`, `csstv_claim "1"`, y lo que el #1 tiene y el repo no |
| `docs/bitacora/` | Bitácoras de `plugin-2v2`, `plugin-retake`, `plugin-deathmatch`, `aviso-y-pausa-automatica` y `qol-tanda-2` a `4` |
| `CLAUDE.md` y `docs/PENDIENTES.md` | Estado nuevo |

## Despliegue

Antes de reiniciar la API, comprobar que no haya partidas ni salas en curso. El 2026-11-04, cerca de las 13:20 UTC, `live_matches`, `mm_queue` y las salas activas estaban en 0.

1. **API** (hecho por Daniel), desde esta rama, en la carpeta principal. Corre pruebas y build, reinicia `cmleague-api`, chequea `/api/health` y vuelve sola a la versión anterior si falla:

   ```bash
   deploy/vps/desplegar.sh api
   ```

2. **Comprobar:**
   - `/api/health` muestra `15a357169528`, sin `-local`: hecho.
   - El log de `cmleague-api` dice `manual: 37 páginas y 0 capturas`: hecho.
   - `/api/v1/manual` sin sesión da 401, y las rutas del anticheat dan 404: hecho. Sin errores en el log en el primer minuto.
   - `/help` abre con una sesión iniciada: **falta**.
   - `cmleague-mm` no se reinició y sigue en su release anterior. No importa: su script solo importa `supabase-js` y no cambió.
3. **Merge en `main`** (hecho): en `v34frag-main`. Sus cambios sin commit quedaron copiados en `pruebas/cambios_sin_commit_v34frag-main.patch`, y las reglas de reinicio pasaron a `CLAUDE.md` (Daniel, 2026-11-04). Los 9 conflictos (`PENDIENTES.md`, `bitacora/README.md`, `CHANGELOG_DISCORD.txt`, `csstv_allchat.smx` y `.sp`, `match.inc`, `csstv_reporter.sp`, `live.cfg` y `csstv_reporter.cfg`) se resuelven con la versión de la rama. Lo de `main` ya está en la rama o quedó viejo.

**Servidores:** #1, #2 y #3 sin cambios. Es el repo el que se igualó a ellos, así que no hay tanda de plugin.

## Pruebas

### API

Typecheck bien, 516 pruebas unitarias bien y build bien (`Manual de usuario: 37 páginas y 0 capturas`, las mismas que producción). Las pruebas de integración no se corrieron.

### Plugins

Los 8 plugins compilan desde la rama y dan el mismo `.code` que los binarios del repo. El método está en `DOCUMENTACION.md`. Los md5 del repo son los de los servidores: reporter `ccb41710`, `csstv_qol` `72379c2b`, `csstv_coach` `9b7e75af`, `csstv_pedir` `34694def` y `v34_dm` `78a34cb3`.

## En qué se apartó del plan

- **El despliegue de la API se separó:** el permiso de la sesión no dejó correrlo a Claude (auto mode, "Production Deploy"), así que queda para Daniel. Por eso el push va antes del despliegue, no después.
- **Conflictos del merge:** son 9, no 8, porque ahora también choca `live.cfg`.

## Cómo revertir

- **API:** apuntar `/srv/cmleague/api/current` a `releases/0d5732881cbe-local11040226` y reiniciar `cmleague-api` y `cmleague-mm`. `desplegar.sh` guarda las últimas 5 versiones. Esa es la versión con las rutas del anticheat, y `deploy/api-produccion` conserva su código, solo en local.
- **Repo:** `git revert 427f51c3 30e236d5`. A los servidores no los afecta.
