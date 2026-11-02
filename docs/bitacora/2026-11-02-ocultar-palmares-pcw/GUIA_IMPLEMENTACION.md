# Quitar Palmarés y desactivar PCW en el menú: guía de implementación

## Estado

**Implementado y probado en local el 2026-11-02, sin commit. Desplegado en staging el 2026-11-02** (web `7f7ca3e0f8f4-local11021851`, junto con [`2026-11-02-ajustes-primer-mm`](../2026-11-02-ajustes-primer-mm/)). Typecheck y lint limpios, y 471 pruebas de Vitest en verde (una nueva en `nav.test.ts`). No se miró en el navegador.

## Archivos

| Archivo | Cambio |
|---|---|
| `src/features/shell/lib/nav.ts` | Sin `hall-of-fame` (y sin `AwardIcon`); `NavItem.soon?`; PCW con `soon: true` y sin `badge` |
| `src/features/shell/components/AppSidebar.tsx` | Ítem `soon`: `SidebarMenuButton` con `aria-disabled`, `opacity-50` y `Badge variant="muted"` "Pronto" |
| `src/features/shell/components/CommandMenu.tsx` | Filtra los ítems `soon` |
| `src/features/matches/components/MatchesTable.tsx` | Vacío de PCW sin "Ir a PCW" |
| `src/features/series/pages/SeriesRoom.tsx` | "← PCW" a `/matches` con `kind: "pcw"` |
| `src/routes/_app/hall-of-fame.tsx` | Borrado |
| `src/routeTree.gen.ts` | Regenerado por el plugin del router (`vite build`) |
| `src/features/shell/lib/nav.test.ts` | Sin `/hall-of-fame` en `activeNavKey`; prueba nueva de `NAV_GROUPS` |
| `src/features/matches/pages/MatchesList.test.tsx` | El vacío de PCW ya no tiene el link |

## Pendiente

- **Contador de PCW:** `useBadgeCounts` (`features/shell/api/queries.ts`) todavía consulta `/api/v1/pcw/posts` aunque no se muestre. Es un pedido chico por página. Se deja para no tocar el tipo `BadgeKey` antes de reactivar PCW.
- **No se miró en el navegador.**
- **Commit y despliegue:** cuando Daniel lo pida.
