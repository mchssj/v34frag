# El matchmaking de staging en la rama del frontend: guía de implementación

## Estado

Hecho el 2026-11-02: commit en `merge/mm-en-frontend` y fast-forward de `feat/frontend-fase-1`. Sin push. No hay nada que desplegar: staging ya corre esto.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/45_*.sql` a `62_*.sql`, `README.md` | Traídos de `feat/mm-claim-en-sala`. |
| `web/backend/src/routes/mm.ts`, `routes/bookings.ts`, `mm/socket.ts`, `scripts/mm-worker.mts` | Nuevos, de `feat/mm-claim-en-sala`. |
| `web/backend/test/unit/mm-*.test.ts`, `bookings-routes.test.ts` | Nuevos, de `feat/mm-claim-en-sala`. |
| `web/backend/src/app.ts` | Rutas `mm` y `bookings`, sin las del anticheat. |
| `web/backend/src/env.ts` | `DISCORD_QUEUE_WEBHOOK_URL` y `DISCORD_QUEUE_ROLE_ID`, sin `AC_API_SECRET`. |
| `web/backend/package.json`, `pnpm-lock.yaml` | `@hono/node-ws`, `postgres` y el script `mm:worker`, sin `anticheat:tick` ni `ac:demo`. |
| `web/backend/src/routes/matches.ts`, `schemas/matches.ts` | Mezcla a tres bandas: el chat solo para tu equipo (matchmaking) más las stats por mapa que ya tenía esta rama. |
| `web/backend/src/node.ts`, `db/types.ts`, `lib/errors.ts`, `lib/uploads.ts`, `routes/clips.ts`, `routes/admin-servers.ts`, `schemas/profile.ts`, `schemas/servers.ts`, `scripts/build.mjs` | De `feat/mm-claim-en-sala` (esta rama no los había cambiado). |
| `deploy/vps/*` | De `feat/mm-claim-en-sala`: worker `cmleague-mm`, `MM_LISTEN_URL`, sockets en Caddy. |
| `server/addons/sourcemod/scripting/csstv_reporter.sp`, `csstv/*.inc` | Reporter 2.9.1 tal cual (ver la documentación). |
| `server/addons/sourcemod/scripting/csstv_password.sp` | 1.1.0. |
| `server/cfg/sourcemod/csstv_reporter.cfg`, `server/cfg/csstv/live_*.cfg` | De `feat/mm-claim-en-sala`. `warmup.cfg`, `live.cfg` y `end.cfg` quedan como estaban (sin `cml_ac_mix`). |

## Cómo se hizo

1. Worktree `E:\Css V34 Web\v34frag-mmfront`, rama `merge/mm-en-frontend` desde `feat/frontend-fase-1` (`b607d9ac`).
2. Lista de archivos: `git diff --name-status 714ec78a feat/mm-claim-en-sala` en `web/backend`, `supabase/replanteo`, `deploy`, el reporter, `csstv_password.sp` y `server/cfg`, sin lo del anticheat ni `csstv_qol.cfg`.
3. Los que solo cambió `feat/mm-claim-en-sala`: `git checkout feat/mm-claim-en-sala -- <archivo>`.
4. Los que cambiaron las dos (6): `git merge-file` con las tres versiones sacadas con `git show` (no del árbol de trabajo).
   - `knife.inc`, `qol.inc`, `csstv_reporter.sp` y `csstv_reporter.cfg`: se tomó el 2.9.1 tal cual, porque ya trae lo del 2.7.3.
   - `routes/matches.ts` y `schemas/matches.ts`: mezcla sin conflictos.
5. Se sacó a mano lo del anticheat de `app.ts`, `env.ts` y `package.json`.

## Pruebas

### API (`web/backend`, en el worktree)

- `pnpm install --frozen-lockfile`: bien.
- `pnpm typecheck`: sin errores.
- `pnpm test`: 33 archivos y 437 pruebas, todas bien.
- `pnpm build` y `pnpm build:check`: bien, con `mm-worker.mjs` en `dist/`.

### Plugin

`spcomp` del servidor local (`E:\CSS DEDICATED SERVER\server\cstrike\addons\sourcemod\scripting`): `csstv_reporter.sp` y `csstv_password.sp` compilan sin errores ni avisos. Los `.smx` quedaron en una carpeta temporal; no se versionaron.

### Comparación con `feat/mm-claim-en-sala`

`git diff --stat feat/mm-claim-en-sala` en las mismas carpetas: solo difieren lo del anticheat, `csstv_qol.cfg`, `cml_ac_mix` en tres cfg, y lo que esta rama ya tenía de antes (`routes/matches.ts`, `schemas/matches.ts`, `services/matches.ts` y dos pruebas de las stats por mapa).

### Lo que no se probó

- La base no se aplicó en ningún lado: los replanteos son los mismos archivos que ya están en staging.
- No se desplegó la API construida desde esta rama. La de staging sigue siendo la de `feat/mm-claim-en-sala`, que además trae las rutas del anticheat.

## En qué se apartó del plan

- Los 6 archivos que cambiaron las dos ramas: en el plugin no se mezcló, se tomó el 2.9.1 tal cual. La mezcla duplicaba las funciones del 2.7.3 (`AutoPause_OnLeave`, `Qol_StartAlert`, `HalfTalk_*`), que el 2.9.1 ya tiene reescritas.
- `CLAUDE.md`, `docs/PENDIENTES.md` y `docs/bitacora/README.md` se actualizaron en el árbol de trabajo de `feat/frontend-fase-1`, sin commit, porque ya tenían cambios sin commit del manual de usuario.

## Incidentes

- La primera mezcla con `git merge-file` sobre el árbol de trabajo marcó todo el archivo en conflicto (fines de línea). Se repitió con las tres versiones sacadas de git y quedó bien.
- El filtro "anticheat" dejó afuera los replanteos `45` a `47`; se agregaron después.

## Cómo revertir

`git reset --keep <commit anterior>` en `feat/frontend-fase-1` (el anterior es `b607d9ac`) o `git revert` del commit. `feat/mm-claim-en-sala` no se tocó.
