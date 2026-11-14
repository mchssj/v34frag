# El avatar puesto reemplaza la foto en toda la web: guía de implementación

## Estado

**Desplegado el 2026-11-14** (23:44 a 23:51 UTC): la `118` y la `119` en producción, y la API y la web `e0b08e9f9e82`. Ver el despliegue en la [guía de la tienda](../2026-11-11-tienda-de-puntos/GUIA_IMPLEMENTACION.md). Falta recorrerlo en el navegador.

Antes: Hecho y probado en local el 2026-11-14 (solo la web), sin desplegar, en `feat/tienda-de-puntos` (worktree `v34frag-mainwt`). **No se recorrió en el navegador**: la extensión de Chrome no estaba conectada. Sale con la tienda.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/shop/avatars.ts` (nuevo) y `avatars.test.tsx` (nuevo) | El cargador por lotes y `usePlayerAvatar`; 3 pruebas |
| `web/frontend/src/components/brand/PlayerAvatar.tsx` | `playerId` y el avatar animado o quieto según el ancho |
| `web/frontend/src/components/brand/initial.ts` (nuevo) | `initialOf`, sacado de `PlayerAvatar` (se sigue exportando desde ahí) |
| `web/frontend/src/features/shop/cosmetics.tsx`, `ItemPreview.tsx` | `EquippedAvatar`; `initialOf` desde `initial.ts` |
| 20 archivos con `PlayerAvatar` (Quiénes somos, equipos, torneos, PCW, comentarios, visitas, buscador, Comparar, ranking, fichas del admin, inscripciones) | `playerId` con el id de la ficha (`id` o `player_id`, según la respuesta) |
| `features/matchmaking/room/RoomStats.tsx`, `RoomHeader.tsx`, `Highlights.tsx`, `PlayFeed.tsx`, `source.ts`, `types.ts` | El avatar en el MVP y los destacados, el capitán del encabezado, los clips y los mejores de la temporada |
| `features/mixes/components/MixHighlights.tsx` | El id de la ficha junto a la foto |
| `features/landing/components/CompetitionSection.tsx` | Los mejores de la portada con `PlayerAvatar` |
| `features/shell/components/AccountMenu.tsx` | El avatar propio en el menú de la cuenta, animado |
| `features/profile/pages/ProfileSection.tsx` | El aviso en Mi perfil |
| `features/widget/StreamWidget.tsx` | El avatar dentro del anillo, animado |
| `web/frontend/src/test/render.tsx`, `features/widget/StreamWidget.test.tsx`, `features/player/components/ProfileWall.test.tsx` | `withQuery`: esas pruebas dibujan fotos y ahora necesitan React Query |
| `web/frontend/src/features/legal/pages/PrivacyPage.tsx`, `terms/privacidad.html` | Privacidad |
| `docs/manual/jugador/tienda-y-cosmeticos.md`, `docs/bitacora/2026-11-11-tienda-de-puntos/CHANGELOG_DISCORD.txt` | Manual y changelog |

## Despliegue (pendiente)

Con la tienda, en la misma tanda: es solo la web (`deploy/vps/desplegar.sh web`). No toca la API ni la base.

## Pruebas

- **Web:** typecheck y lint limpios; 128 archivos y 788 pruebas en verde.
  - `avatars.test.tsx`: tres fotos de una pantalla van en un solo pedido; con avatar se ve el avatar (quieto, porque jsdom no mide) y sin avatar la foto o la inicial; sin id no se pide nada; 150 fichas van en dos pedidos (100 y 50).
- **Navegador:** no se hizo. Falta recorrer, con una cuenta con avatar puesto (propio y de la Tienda): Quiénes somos, un equipo, los comentarios, el buscador, el ranking, la sala, el menú de la cuenta, Mi perfil (el aviso) y el widget; y sacárselo.

## En qué se apartó del plan

- **El menú de la cuenta mide 32 px**, menos que el límite de 48: igual va animado, como decía el plan («el menú de la cuenta»). El MVP de la sala (64 px) y el widget también van animados; los demás `<Avatar>` propios de la sala, los destacados y el feed son chicos y van quietos.
- **`initialOf` a un archivo aparte** (`components/brand/initial.ts`), para que `PlayerAvatar` pueda usar `AvatarMedia` sin un import circular con `cosmetics.tsx`.
- **No hizo falta tocar la API:** los únicos lugares sin id de la ficha (el feed de Jugar y los destacados de un mix) ya tenían el dato en el cliente.

## Cómo revertir

Antes de desplegar, volver estos archivos. Después: la web anterior (`ln -sfn`, ver `deploy/vps/README.md`). No hay nada en la base.
