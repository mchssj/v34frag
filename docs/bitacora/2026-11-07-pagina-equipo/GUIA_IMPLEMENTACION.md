# La página del Equipo (Quiénes somos): guía de implementación

## Estado

Implementado y probado en local el 2026-11-07, en la copia de `main` (`v34frag-mainwt`), con la `87` aplicada en la base local. **Sin commit ni despliegue.**

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

## Despliegue (pendiente)

Respaldo, `probar_87.sh` contra producción, la `87`, `reload schema`, la API y la web.

## Pruebas

- Base: `probar_87.sh docker` (admins y moderadores con ficha, VIP sin admins y por antigüedad, ocultarse, sin sesión no) y la inversa igual a antes.
- API: `community.test.ts`.
- Web: `StaffPage.test.tsx`.
- En la web local: `pruebas/equipo.png`. En la base local KilluaZ todavía no es admin (el cambio se hizo solo en producción), así que ahí sale entre los VIP.

## En qué se apartó del plan

- El link del menú se llama **Quiénes somos** y no "Equipo", para no confundirlo con **Mi equipo**. La ruta sigue siendo `/equipo`.
