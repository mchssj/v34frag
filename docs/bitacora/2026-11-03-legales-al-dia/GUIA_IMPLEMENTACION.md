# Términos y privacidad al día con la plataforma: guía de implementación

## Estado

Implementado y probado en local el 2026-11-03, sin commit ni despliegue. Los textos siguen siendo borradores: falta la aprobación y la revisión de un abogado (ver `docs/PENDIENTES.md`).

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/legal/pages/TermsPage.tsx` | Baneos, reglas del ELO y PCW con `Wip`; resultados de torneos reescritos; PCW y ranking corregido |
| `web/frontend/src/features/legal/pages/PrivacyPage.tsx` | Favoritas y búsquedas guardadas, y capturas de reportes con `Wip`; aviso de la cola en la fila de Discord |
| `terms/terminos.html` y `terms/privacidad.html` | Los mismos cambios, con `<span class="pending">en preparación</span>` |
| `CLAUDE.md` | Regla "Términos y privacidad" |
| `docs/bitacora/PLANTILLA.md` | Sección "Términos y privacidad" en `DOCUMENTACION.md` |

## Cómo se verificó cada frase

| Frase | Dónde se miró |
|---|---|
| Favoritas y búsquedas guardadas | `grep` de `favorit` y `saved_search` en `supabase/`, `web/backend` y `web/frontend`: nada |
| Lista de baneos | `web/backend/src/routes/bans.ts` (`optionalUser`); en la web solo `routes/_app/admin.bans.tsx` |
| Reglas del ELO | Solo `features/admin/servers/components/EloRulesTab.tsx` |
| PCW y ranking | `supabase/replanteo/27_mixes_perfil_ranking.sql` (`team_results` suma `kind = 'pcw'`); el ELO de jugadores solo usa `kind = 'mix'` (`34_elo_por_ficha.sql`) |
| Aviso de la cola | `web/backend/src/routes/mm.ts`: el mensaje lleva "avisó <tag>" |
| IP, demos, abandono, privacidad del perfil, almacenamiento del navegador | Coinciden: `20261029180000_ips_jugadores.sql` (90 días), Worker `demo_expire` (90 días), `48_matchmaking.sql` (`abandon_extra_elo`), `ProfilePatch`, `tokenStore.ts` y `theme-provider.tsx` |

## Despliegue
> **En staging desde el 2026-11-03**, en una sola tanda con el manual, los valores reales del manual, los legales, la imagen del login (`67`), el resumen del matchmaking (`66`) y los reportes, clips y nombre del equipo (`68`): base `66` y `67` aplicadas (la `65` y la `68` ya estaban), API `0d5732881cbe` (merge temporal "tmp: API de staging" de `034d280a` de `feat/mm-claim-en-sala` sobre `f5f6d7b9`, en `v34frag-deploy`, con `MANUAL_DIR` = `v34frag/docs/manual`: 37 páginas) y web `e53200f83840` (checkout limpio de `feat/frontend-fase-1`). Detalle en [`2026-11-03-reportes-clips-nombre-equipo`](../2026-11-03-reportes-clips-nombre-equipo/GUIA_IMPLEMENTACION.md).

Ninguno todavía. La web va con el próximo despliegue a staging (`deploy/vps/desplegar.sh web`). Los `.html` se publican cuando se aprueben los textos.

## Pruebas

- `pnpm typecheck`: bien.
- `pnpm exec vitest run src/features/legal`: 4 de 4.
- `prettier --check` y `eslint` de `features/legal`: bien.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Revertir el commit. No toca la base, la API ni los servidores.
