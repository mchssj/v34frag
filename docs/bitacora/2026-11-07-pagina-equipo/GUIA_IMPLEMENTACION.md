# La página del Equipo (Quiénes somos): guía de implementación

## Estado

Implementado y probado en local el 2026-11-07, en la copia de `main` (`v34frag-mainwt`), con la `87` aplicada en la base local. Commit en `main` el 2026-11-08.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/87_pagina_equipo.sql` y su inversa | Funciones |
| `web/backend/src/routes/community.ts` | `GET /api/v1/staff` y `/api/v1/me/vip-list` |
| `web/frontend/src/routes/_app/equipo.tsx`, `features/staff/StaffPage.tsx` (+ prueba) | La página |
| `web/frontend/src/features/shell/lib/nav.ts` | "Quiénes somos" en Comunidad |
| `web/frontend/src/features/profile/components/VipListCard.tsx`, `routes/_app/profile.privacy.tsx` | Ocultarse de la lista |
| `docs/manual/jugador/quienes-somos.md` (nueva) | Manual |
| Privacidad (web y `terms/`) | Lo que se publica de admins, moderadores y VIP |

## Despliegue (hecho el 2026-11-08)

**Desplegado el 2026-11-08 (05:47-06:00 UTC)** desde `main` (`8991457b`; copia `8428d9e5` en `feat/frontend-fase-1`): sin salas ni nadie en la cola (la única partida `live` sigue siendo la `0d42d09a…` colgada del #1); respaldo `20261108T054752Z` (también en R2); `cmleague-mm` parado; `probar_85.sh`, `probar_86.sh` y `probar_87.sh` contra producción, en verde y con la inversa igual a antes; las tres migraciones desde el archivo commiteado con `PGCLIENTENCODING=UTF8` y `notify pgrst, 'reload schema'`; la API `8991457b20f8` (`/api/health` con el commit), `cmleague-mm` prendido de nuevo y la web `8991457b20f8`. La web, con `--sin-pruebas`: en la corrida del script dos pruebas de `PlayPage` se cortaron a los 5 s (la máquina estaba cargada) y con `--maxWorkers=2` pasaron las 667 sobre el mismo commit. Detalle en la guía de [amigos](../2026-11-07-amigos-con-solicitudes/GUIA_IMPLEMENTACION.md).

Los pasos:

Respaldo, `probar_87.sh` contra producción, la `87`, `reload schema`, la API y la web.

## Pruebas

- Base: `probar_87.sh docker` (admins y moderadores con ficha, VIP sin admins y por antigüedad, ocultarse, sin sesión no) y la inversa igual a antes.
- API: `community.test.ts`.
- Web: `StaffPage.test.tsx`.
- En la web local: `pruebas/equipo.png`. En la base local KilluaZ todavía no es admin (el cambio se hizo solo en producción), así que ahí sale entre los VIP.

## En qué se apartó del plan

- El link del menú se llama **Quiénes somos** y no "Equipo", para no confundirlo con **Mi equipo**. La ruta sigue siendo `/equipo`.
