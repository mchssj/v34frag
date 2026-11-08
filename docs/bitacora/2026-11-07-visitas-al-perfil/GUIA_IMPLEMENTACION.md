# Visitas a tu perfil: guía de implementación

## Estado

Implementado y probado en local el 2026-11-07, en la copia de `main` (`v34frag-mainwt`), con la `86` aplicada en la base local. **Sin commit ni despliegue.**

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/86_visitas_al_perfil.sql` y su inversa | Tabla y funciones |
| `web/backend/src/routes/community.ts` (nuevo), `app.ts` | Las tres rutas |
| `web/backend/test/unit/community.test.ts` | Pruebas |
| `web/frontend/src/features/player/components/ProfileVisitsCard.tsx` (+ prueba) | La tarjeta |
| `web/frontend/src/features/player/components/tabs/SummaryTab.tsx` | La tarjeta en el Resumen propio |
| `web/frontend/src/features/player/pages/PlayerProfile.tsx` | Registra la visita |
| `web/frontend/src/features/ranking/components/parts.tsx` | `useMine().ready`: no registrar antes de saber si el perfil es propio |
| `web/frontend/src/features/vip/VipDialog.tsx` | "Ser VIP" |
| `web/frontend/src/test/renderWithRouter.tsx` | Ayuda para probar componentes con `<Link>` |
| `docs/manual/jugador/visitas-al-perfil.md` (nueva) | Manual |
| Privacidad y términos (web y `terms/`) | Las visitas y la ventaja VIP |

## Despliegue (pendiente)

Respaldo, `probar_86.sh` contra producción, la `86`, `reload schema`, la API y la web. No toca el matchmaking.

## Pruebas

- Base: `probar_86.sh docker` (6 bloques: una por persona y día, sin VIP solo el número, con VIP quiénes, cupo de 15 y la 16 a la vista, VIP vencido, 30 días) y la inversa igual a antes.
- API: `community.test.ts` (4 de visitas).
- Web: `ProfileVisitsCard.test.tsx` (sin VIP no hay ningún nick ni link; con VIP, el interruptor y "Ver todas").
- En la web local, con la cuenta `organizador2@prueba.local` hecha VIP y 24 visitas cargadas a mano (se borraron después): `pruebas/visitas_vip.png`.

## En qué se apartó del plan

- Los colores de las siluetas salen de una semilla al azar por carga de la página (la regla de React no deja usar `Math.random` al dibujar).
