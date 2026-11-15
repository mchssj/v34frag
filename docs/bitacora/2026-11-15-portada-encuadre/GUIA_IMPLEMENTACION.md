# La portada se encuadra más fácil (3:1 y se puede alejar): guía de implementación

## Estado

**Desplegado el 2026-11-15**: la API y la web `6169f01eaa77` (sin cambios en la base). Falta subir una portada en producción y verla en el perfil, y publicar `CHANGELOG_DISCORD.txt` (2.9.49) en Discord.

## Despliegue (hecho el 2026-11-15)

1. **Un primer intento desde la rama equivocada.** Se desplegó la API desde `feat/tienda-de-puntos` (`f806b69ee4d6`), que no tenía lo último de `main`: producción estaba en `add29312b03b` (límites del soporte, [`2026-11-14-limites-baneo-soporte`](../2026-11-14-limites-baneo-soporte/)). La API quedó unos 40 segundos sin esos cambios (05:48 UTC) y se volvió a `add29312b03b` con `ln -sfn` y `systemctl restart cmleague-api`. La web no se llegó a desplegar. **Para la próxima:** se despliega desde `origin/main` (producción), no desde la rama de la tienda.
2. **Los commits sobre `origin/main`:** en un worktree nuevo (`v34frag-portada`, rama `deploy/portada-encuadre`), `cherry-pick` de los dos commits (el índice de la bitácora tuvo conflicto: quedaron las dos filas). Typecheck de la API y de la web limpio.
3. **API:** `deploy/vps/desplegar.sh api`, `6169f01eaa77` (antes `add29312b03b`), 654 pruebas; `/api/health` con esa versión a las 05:52 UTC.
4. **Web:** `deploy/vps/desplegar.sh web`, `6169f01eaa77` (antes `add29312b03b`), 789 pruebas.
5. **Comprobado sin sesión:** `/api/health` con `6169f01eaa77`, `POST /api/v1/me/cover` da 401 (la ruta existe), el OpenAPI público dice 3:1 de 900×300 a 2400×800 y la web responde.

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

Web y API a `add29312b03b` con `ln -sfn` (ver `deploy/vps/README.md`). Las portadas 3:1 que se hayan subido mientras tanto se siguen viendo bien con la web anterior (la caja 4:1 les corta un poco arriba y abajo).
