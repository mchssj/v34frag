# Equipo principal: guía de implementación

## Estado

**Desplegado el 2026-11-16**: replanteo `124` en la base de producción, API y web `26c4db1d91c6` (commit `26c4db1d`). Daniel lo probó en local antes del despliegue. Falta publicar `CHANGELOG_DISCORD.txt`. No toca los servidores de juego.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/124_equipo_principal.sql` | Nuevo: columna, trigger, `team_primary_order`, `set_my_primary_team` y el orden de las dos vistas |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/124_equipo_principal.sql` | Nuevo: la inversa |
| `supabase/replanteo/README.md` | Fila de la `124` |
| `web/backend/src/db/types.ts` | `players.primary_team_id` y `set_my_primary_team`, a mano (igual a lo que genera `pnpm db:types`) |
| `web/backend/src/lib/db.ts` | `sortByPrimary` |
| `web/backend/src/routes/teams.ts` | `loadMyTeams` (con `is_primary` y el orden nuevo) y `PUT /api/v1/me/teams/primary` |
| `web/backend/src/routes/me.ts` | `teams` de `/me/profile` con el orden nuevo e `is_primary`; `primary_team_id` no sale en `player` |
| `web/backend/src/schemas/teams.ts`, `schemas/profile.ts` | `is_primary`, `PrimaryTeamBody` |
| `web/backend/test/unit/me-routes.test.ts`, `test/integration/me.test.ts`, `test/integration/players-teams.test.ts` | `is_primary` en lo que ya había y casos nuevos |
| `web/frontend/src/api/schema.d.ts` | Regenerado (`pnpm gen:api`) |
| `web/frontend/src/features/teams/api/queries.ts` | `useSetPrimaryTeam` |
| `web/frontend/src/features/teams/components/TeamSwitcher.tsx` | Estrella en el selector y `PrimaryStar` |
| `web/frontend/src/routes/_app/myteam.tsx` | Usa el orden de la API (sin "capitán primero") |
| `web/frontend/src/features/shell/api/queries.ts` | El menú lateral muestra el principal |
| `web/frontend/src/features/player/pages/PlayerProfile.tsx` | Estrella en el primer equipo |
| `web/frontend/src/features/legal/pages/PrivacyPage.tsx`, `features/legal/lib/meta.ts`, `terms/privacidad.html`, `terms/terminos.html` | Texto de privacidad y fecha |
| `docs/manual/jugador/equipo.md` | Sección "Tu equipo principal" |

## Despliegue (hecho el 2026-11-16)

1. **Base**, por el túnel (con el OpenSSH de Windows, que es el que tiene la llave del VPS; el `ssh` de Git no la tiene). Chequeo previo de solo lectura: la `123` estaba, `players.primary_team_id` no, y las dos vistas ordenaban por `tm.joined_at NULLS FIRST`. Se aplicó la `124` (`psql -v ON_ERROR_STOP=1 -f`). Después: la columna y `set_my_primary_team(uuid)` existen, las dos vistas usan `team_primary_order` y `player_ranking` responde (141 filas). `team_config.max_led` sigue en 1.
2. **API:** sin nadie en la cola del matchmaking ni salas abiertas. `BUILD_CHECK_PORT=28787 deploy/vps/desplegar.sh api` (con las pruebas). `/api/health` respondió `26c4db1d91c6-local11161745`: el `-local` es porque había cambios sin commitear en la web (los legales de `2026-11-13-nombre-de-la-ficha-en-mix`); el backend no tenía ninguno, así que se construyó con lo commiteado.
3. **Web:** esos dos legales ajenos (`PrivacyPage.tsx` y `TermsPage.tsx`) se guardaron con `git stash` para no publicarlos, `deploy/vps/desplegar.sh web` y `git stash pop`. Versión `26c4db1d91c6`.
4. Comprobado en producción: el OpenAPI publica `PUT /api/v1/me/teams/primary` y `team_lead`, y la ruta sin sesión da 401.

Orden obligatorio: la base antes que la API y la API antes que la web.

## Pruebas

> Para probar el botón a mano, `team_config.max_led` estuvo en 2 en la base local; después se volvió a 1, que es lo que espera la prueba "tope de capitán" de `players-teams`.

### Base (Supabase local)

- La `124` se aplicó sobre la base local, que ya tenía hasta la `123`. `pg_get_viewdef` de `player_overview` queda con `ORDER BY (team_primary_order(tm.player_id, tm.team_id)), tm.joined_at NULLS FIRST`.
- Inversa aplicada (las vistas vuelven a `tm.joined_at NULLS FIRST` sin `team_primary_order`) y la `124` vuelta a aplicar: las dos funcionan.

### API

- Unitarias: 654 de 654 (una prueba nueva de `/me/profile`: sin marcar, el más antiguo; marcado, ese primero; los que solo capitanea, al final; `primary_team_id` no sale en `player`).
- Integración `players-teams`, `me` y `seasons`: todas pasan. La nueva marca un equipo, comprueba el orden en `/me/teams`, `/players/{id}` y `/me/profile`, rechaza uno ajeno (409) y sin sesión (401), comprueba que al salir del principal vuelve a `null` y que `null` limpia.
- La suite de integración completa tiene fallas en `claim`, `hud`, `live` y `shop`: configuración de la tienda y VIP distinta a la que esperan, y timeouts de la base local, que tiene datos de muchas corridas y no se reseteó. No tocan equipos ni este cambio. No se investigaron más.

### Web

- `tsc`, ESLint de los archivos tocados y Vitest (811 de 811) pasan.
- **No se probó en el navegador**: la extensión de Chrome no estaba conectada. En la base local quedó un usuario de prueba (`principal@test.local`, alias `PruebaPrincipal`) con dos equipos ("Viejos Lobos", el más antiguo, y "Nuevos Halcones", que capitanea) para probarlo a mano.

## En qué se apartó del plan

- **Crear otro equipo con equipo (pedido por Daniel al probarlo, 2026-11-16):** el botón **Crear equipo** solo estaba en la pantalla sin equipo (`NoTeam`), así que con `max_led` mayor a 1 no había cómo crear el segundo. `GET /me/profile` suma `team_lead: { led, max }` y `TeamSwitcher` muestra **Crear equipo** junto a **Buscar equipo** mientras `led < max` (`myteam.tsx`). Prueba unitaria nueva en `me-routes.test.ts`.

- La ruta de `/me/profile` también suma `is_primary` (el plan solo lo decía de `/me/teams`), para que el menú lateral no tenga que adivinar.
- `team_primary_order` es una función aparte, en lugar de la subconsulta dentro del `ORDER BY`: así la inversa la encuentra y la quita sin depender de cómo formatea Postgres la vista.
- La fecha de la última versión de los legales pasó al 16 de noviembre en los dos `.html` y en `LEGAL_UPDATED` (la comparten términos y privacidad).

## Cómo revertir

1. Web y API: revertir el commit y desplegar.
2. Base: `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/124_equipo_principal.sql` (borra la columna: se pierden los principales marcados).
