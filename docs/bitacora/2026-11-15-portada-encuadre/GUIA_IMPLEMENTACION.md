# La portada se encuadra más fácil (3:1 y se puede alejar): guía de implementación

## Estado

**Pendiente de despliegue** (API y web).

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/lib/image.ts` | `cropImage` con `fill` (relleno difuminado); JPEG hasta calidad 0,6 |
| `web/frontend/src/features/profile/components/AvatarCropDialog.tsx` | Prop `minZoom` |
| `web/frontend/src/features/shop/CoverCard.tsx` | 3:1, 2400×800, `minZoom` 0,3 y `fill` |
| `web/frontend/src/features/player/pages/PlayerProfile.tsx` | La portada con su proporción natural |
| `web/backend/src/routes/shop.ts` | `COVER_SHAPE` 3:1, de 900×300 a 2400×800 |
| `web/backend/src/schemas/shop.ts`, `players.ts`, `profile.ts` | Descripciones |
| `web/frontend/src/api/schema.d.ts` | Regenerado |
| `web/backend/test/integration/shop.test.ts` | La portada en 3:1, y una 4:1 se rechaza |
| `docs/manual/jugador/tienda-y-cosmeticos.md` | Manual |
| `docs/bitacora/README.md` | Índice |

Sin cambios en la base.

## Pruebas

- **Typecheck** de la web y de la API, y lint y formato de los archivos tocados: sin errores.
- **Integración** (`shop.test.ts`, base local): la de la portada pasa (cuadrada y 4:1 dan 400; 3:1 se sube y sale en la ficha). Las otras 7 de ese archivo fallan, igual que sin este cambio (se corrieron también sobre el código original): dependen de los puntos y los precios que tiene la base local, no de la portada.
- **Navegador:** Daniel lo probó en local el 2026-11-15 (API y web contra la Supabase local, cuenta `portada@test.local` con la ficha `PortadaTest`) y le gustó.

## En qué se apartó del plan

En nada.

## Cómo revertir

Web y API a la versión anterior con `ln -sfn` (ver `deploy/vps/README.md`). Las portadas 3:1 que se hayan subido mientras tanto se siguen viendo bien con la web anterior (la caja 4:1 les corta un poco arriba y abajo).
