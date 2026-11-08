# El moderador crea torneos y el premio con monto y divisa: guía de implementación

## Estado

Implementado y probado en local el 2026-11-07, en la copia de `main` (`v34frag-mainwt`), sobre la base local con la copia de producción. Daniel lo revisó en el navegador. Commit `2e298676` en `main` y su copia `0c3577c4` en `feat/frontend-fase-1`. **Desplegado el 2026-11-07 (19:25-19:48 UTC)** desde `main`: la `84` en la base del VPS, API y web `2e29867643a6`. Falta publicar el `CHANGELOG_DISCORD.txt`.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/84_moderador_crea_torneos_y_divisa.sql` | Nuevo. `admin_review`, columnas del premio, política de crear, `events_guard`, `event_review`, `event_resubmit`, `can_own_event`, `tg_notify_events` y `event_list` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/84_moderador_crea_torneos_y_divisa.sql` | Nueva. La inversa, generada con las definiciones de antes; aborta si hay torneos de un moderador o premios con monto |
| `pruebas/prueba_84.sql`, `pruebas/probar_84.sh` | 12 bloques de pruebas y la inversa, en una transacción con rollback |
| `web/backend/src/schemas/events.ts`, `routes/events.ts`, `lib/errors.ts`, `db/types.ts` | Campos, filtro, `viewer.can_approve` y el mensaje del premio |
| `web/backend/test/integration/historicos-testing.test.ts`, `admin-torneos.test.ts` | El moderador crea y lo aprueba un admin; el premio; `viewer` con `can_approve` |
| `web/frontend/src/auth/permissions.ts` (+ prueba) | `canCreateEvent` con el moderador y `eventApprover` |
| `web/frontend/src/features/events/lib/model.ts` (+ prueba) | `prizeText`, `prizeOrNull`, `prizeAmountText` y `CURRENCY_LABEL` |
| `EventForm.tsx`, `AdminEventPages.tsx`, `ManageTabs.tsx`, `ReviewPanel.tsx`, `AdminEventsPage.tsx`, `api/queries.ts` | Crear del moderador, el premio, aprobar según `can_approve` y **Qué falta** |
| `SummaryTab.tsx`, `EventList.tsx`, `EventView.tsx`, `CompetitionSection.tsx`, `Showcase.tsx` | El premio con su divisa |
| `web/frontend/src/api/schema.d.ts` | Regenerado (`pnpm gen:api`) |
| `docs/manual/organizador/crear-torneo.md`, `subir-torneo-historico.md`, `moderador/aprobar-torneos-y-mixes.md` | Quién aprueba y el premio |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `terms/terminos.html` | Lo que crea un moderador lo aprueba un admin |
| `docs/frontend/contrato/torneos.md` (sección 8d), `notificaciones.md` | El contrato |

## Despliegue (hecho el 2026-11-07, salvo el paso 4)

Cómo quedó: sin mixes en vivo (la única partida `live` seguía siendo la `0d42d09a…` colgada del #1), sin salas en las 6 horas anteriores y 2 jugadores en la cola; respaldo `20261107T192554Z` (también en R2); `cmleague-mm` parado; `probar_84.sh` contra producción, los 12 bloques ok y la inversa igual a antes; la `84` desde el archivo commiteado y `notify pgrst, 'reload schema'`; la API `2e29867643a6` (555 pruebas, `/api/health` con el commit) y `cmleague-mm` prendido de nuevo; la web `2e29867643a6`. La base ya tenía la `83` y la API y la web eran `4480fbc4cd92` (desplegadas por la sesión de las jugadas).

Dos incidentes:

- **El primer intento de la `84` falló y se deshizo entero** (no quedó nada a medias): el `psql` de Windows se conectó con `client_encoding` WIN1252, y el texto con acento que busca `pg_temp.reemplazar` ("históricos") no coincidió. Se reaplicó con `PGCLIENTENCODING=UTF8`. Antes se comprobó que en producción no hay ninguna función ni comentario con texto mal codificado (la `80` de esta mañana quedó bien). **Para la próxima: aplicar siempre con `PGCLIENTENCODING=UTF8`.**
- **La web se desplegó con `--sin-pruebas`.** `desplegar.sh web` corta si falla una prueba, y dos de `PlayPage` (Jugar, que no se tocó) se cortaban a los 5 s porque la máquina estaba cargada: la API y la web locales seguían corriendo y no se pudieron cerrar desde la sesión. Con `vitest run --maxWorkers=2` sobre el mismo commit pasaron las 656, y recién entonces se subió sin volver a correrlas. Entre la API y la web hubo unos 18 minutos con la API nueva y la web vieja, que es compatible.

No toca el matchmaking ni el plugin: va en `main` y su copia en `feat/frontend-fase-1`. Sin un mix en curso.

1. **Commit** en `main` cuando Daniel lo pida.
2. **Base del VPS:** respaldo; `probar_84.sh` contra producción por el túnel; después la `84` desde el archivo commiteado (LF). Necesita la `80` (ya en producción). No depende de la `81`, `82` ni `83`.
3. **API y web juntas**, desde `main`. La web nueva con la API vieja no ve el premio ni `can_approve` (el moderador no vería Aprobar en lo de un organizador); la API nueva con la web vieja funciona, sin el monto.
4. Publicar el `CHANGELOG_DISCORD.txt` (2.9.24) y los términos.

## Pruebas

- **Base:** `probar_84.sh docker` en la base local (copia de producción con la `80`): los 12 bloques ok y la inversa igual a antes.
- **API:** `pnpm typecheck`; 548 unitarias; integración `historicos-testing` y `admin-torneos` (8 de 8). En `tournaments`, `llave-serie`, `groups-double`, `equipo-torneos` y `notifications` fallan solo las 3 de siempre (subir logo o banner: Storage responde `403` en esta base local).
- **Web:** `tsc -b` y `eslint` sin errores; 651 pruebas (2 nuevas: el premio y `eventApprover`), 650 en verde. La que falla es de `PlayPage` (Jugar, no se tocó): se corta a los 5 s con la máquina cargada (la API y la web locales corriendo) y pasa sola (32 de 32).
- **De punta a punta** contra la API local, con `moderador2@prueba.local`: crea "Copa del Moderador (prueba)" con "$ 50.000 ARS + rol en Discord", queda `pending` con `admin_review`; otro moderador recibe `403` al aprobar; el admin tiene `can_approve`. Queda en la base local para revisarlo en la web.
- **No se recorrió en el navegador.**

## En qué se apartó del plan

- **Sin página nueva `moderador/crear-torneo.md`:** la sección `organizador/` del manual ya la ven los moderadores y los admins, así que se actualizaron sus páginas.
- **`notify_admin_ids()` ya existía** (replanteo `28`): la `84` la usa en vez de crear otra.
- **`db/types.ts`:** la base local tiene aplicada la `83` (jugadas, de otra sesión, todavía no en `main`). De lo regenerado se dejaron solo las cuatro líneas de `events` y `event_list` que cambian con la `84`.
