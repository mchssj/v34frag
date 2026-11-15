# La portada se ve nítida, y el staff la puede quitar desde el perfil: guía de implementación

## Estado

**Desplegado el 2026-11-15** (00:48 a 00:52 UTC): la `120` en producción, y la API y la web `355f10ee714c`. Falta probarlo en producción con una cuenta de soporte o de moderador.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/120_portada_staff.sql` | Nuevo: `staff_remove_cover` y `cover_remove` en `support_actions` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/120_portada_staff.sql` | Nuevo: la inversa |
| `pruebas/probar_120.sql` y `probar_120.sh` | Nuevos: 5 bloques con rollback |
| `web/backend/src/routes/admin-players.ts` | `POST /api/v1/admin/players/{id}/cover/remove` |
| `web/backend/src/schemas/bans.ts` | `cover_remove` en `SUPPORT_ACTIONS` |
| `web/backend/src/db/types.ts`, `web/frontend/src/api/schema.d.ts` | Regenerados |
| `web/backend/test/unit/support-routes.test.ts` | 2 pruebas nuevas |
| `web/frontend/src/features/shop/CoverCard.tsx` | Recorte a 2400×600 |
| `web/frontend/src/features/player/pages/PlayerProfile.tsx` | La portada siempre en 4:1 y **Quitar portada** para el staff |
| `web/frontend/src/features/admin/bans/lib/support.ts` | La acción en la actividad del soporte |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `terms/terminos.html` | Términos |
| `docs/manual/jugador/tienda-y-cosmeticos.md`, `soporte/quitar-fotos-y-logos.md`, `moderador/revisar-imagenes.md`, `admin/tienda-y-puntos.md` | Manual |
| `supabase/replanteo/README.md`, `docs/bitacora/README.md` | Índices |

## Despliegue (hecho el 2026-11-15)

1. **Respaldo** `20261115T004433Z` en R2 (`sudo cmleague-respaldar`). Producción tenía la `119` y no la `120`.
2. **Base:** la `120` por el túnel, 00:48:36 a 00:48:39 UTC. Comprobado: `staff_remove_cover` existe, `anon` no la ejecuta y `support_actions_action_check` acepta `cover_remove`. (El modo automático de Claude Code bloqueó el primer intento por ser una escritura en producción; Daniel lo autorizó con `/permissions`.)
3. **API:** `deploy/vps/desplegar.sh api`, `355f10ee714c` (antes `e0b08e9f9e82`), 649 pruebas; `/api/health` con esa versión.
4. **Web:** `deploy/vps/desplegar.sh web`, `355f10ee714c` (antes `919c51970d4f`), 788 pruebas.
5. **Comprobado sin sesión:** `POST /api/v1/admin/players/{id}/cover/remove` da 401 (la ruta existe) y la web responde.
6. **Falta:** con una cuenta de soporte o de moderador, quitar una portada desde el perfil (aviso, actividad del soporte); subir una portada nueva y ver que se ve nítida y en 4:1; publicar `CHANGELOG_DISCORD.txt` (2.9.47) en Discord y `terms/terminos.html` donde se publique.

## Pruebas

- **Base** (`probar_120.sh`, local, con rollback): un jugador no puede (1); el soporte la quita con motivo y no si es corto, si no hay portada o si la ficha no existe (2); aviso `cover_removed` en `account`, `support_actions` con `cover_remove` y la denuncia cerrada (3); el moderador también, sin registro de soporte (4); la inversa deja la estructura igual (5).
- **API:** 649 unitarias (2 nuevas: con motivo y sin permiso) y typecheck.
- **Web:** 788 pruebas, typecheck y lint.
- **Navegador:** no se recorrió (la extensión de Chrome no estaba conectada).

## En qué se apartó del plan

- Se borra el archivo de la portada con la clave de servicio (bucket `avatars`, carpeta del dueño), como hace **Quitar foto**.
- La portada se invalida también en `["public-player"]` (la ficha pública), además de `["players"]` y `["player"]`.

## Cómo revertir

- Web y API: `355f10ee714c` → `919c51970d4f` (web) y `e0b08e9f9e82` (API) con `ln -sfn` (ver `deploy/vps/README.md`).
- Base: la inversa de la `120`. Se pierden las acciones `cover_remove` del registro del soporte; las portadas quitadas no vuelven.
