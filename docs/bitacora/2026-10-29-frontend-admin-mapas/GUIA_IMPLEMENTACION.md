# Administración › Mapas y el selector de pool: guía de implementación

## Estado

Implementado y probado en local el 2026-10-29, sin commit, en la rama `feat/frontend-fase-1`. Sin desplegar. El selector de pool está hecho y probado, pero todavía no se usa: falta hacer los formularios de Torneos y PCW.

## Archivos

Todo en `web/frontend/`:

| Archivo | Cambio |
|---|---|
| `src/auth/permissions.ts` | Sección `maps` (solo admin) |
| `src/features/shell/nav.ts` y `nav.test.ts` | Ítem "Mapas" y su título |
| `src/routes/_app/admin.maps.tsx` | Nueva, con `filter` y `map` en la URL |
| `src/features/admin/maps/` | Nueva: `AdminMapsPage.tsx`, `MapPanel.tsx`, `AddMapDialog.tsx`, `catalog.ts`, `queries.ts` y `catalog.test.ts` |
| `src/features/maps/MapPoolPicker.tsx`, `pool.ts` y sus pruebas | Nuevos |
| `src/features/admin/rules.test.ts` | Permisos de `maps` |
| `src/routeTree.gen.ts` | Regenerado por el plugin del router |

## Despliegue

Pendiente, con el resto del frontend nuevo (`docs/bitacora/2026-10-28-despliegue-vps-ovh/`). La API ya tiene los endpoints (replanteo `30`). Las fotos van al bucket `photos/maps/`.

## Pruebas

### Automáticas

- `pnpm typecheck`, `pnpm lint` y `pnpm build`: en verde.
- `pnpm test`: 44 archivos y 319 pruebas en verde. Las nuevas cubren el borrador (orden, cambios, retirar, mínimo del pool, nombres, versiones y foto), las reglas del pool (por defecto, retirados, BO y máximo) y el selector en uso.

### Contra la API local

Con un script de Playwright, guardado fuera del repo, y una cuenta admin `@test.local`:

1. Se subió una foto PNG a `de_inferno`. Quedó en la API y se vio en la lista y en el panel.
2. En el borrador: se bajó un mapa, se sacó otro de Mixes, se retiró un tercero y se agregó `de_russka`. "Guardar catálogo" los dejó en la API tal cual (orden, marcas y mapa nuevo).
3. Captura a 390 px en tema claro. Sin errores en la consola.

Al terminar se quitó la foto, se volvió a guardar el catálogo original, se borró `de_russka` de `map_pool` por SQL (la API no borra mapas), se borró la cuenta de prueba y se borraron las capturas. Se comparó el catálogo con el de antes: quedó igual.

## Cómo revertir

Todavía no hay commit y algunos de estos archivos también tienen cambios sin commit de otros requerimientos. Por eso no sirve un `git checkout`: hay que deshacer a mano los cambios de la tabla y borrar `src/features/admin/maps/`, `src/features/maps/MapPoolPicker*`, `src/features/maps/pool*` y `src/routes/_app/admin.maps.tsx`.
