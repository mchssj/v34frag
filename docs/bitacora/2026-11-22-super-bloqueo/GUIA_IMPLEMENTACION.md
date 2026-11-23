# Super bloqueo del admin: guía de implementación

## Estado

**Probado en local, sin commit ni despliegue** (2026-11-22).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/135_mm_super_bloqueo.sql` | Columna `mm_blocks.super`, `mm_block_super`, `mm_best_split_ex` con los super bloqueos y `mm_my_profile` con `super` (reemplazo de texto que falla si no encuentra el fragmento) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/135_mm_super_bloqueo.sql` | Inversa: `mm_best_split_ex` de la `104`, `mm_my_profile` sin `super`, borra la función y la columna |
| `web/backend/src/routes/mm.ts` | `PUT /api/v1/mm/blocks/{id}/super` |
| `web/frontend/src/api/schema.d.ts` | Regenerado (`pnpm gen:api`): solo suma la ruta y `MmBlockSuper` |
| `web/frontend/src/features/matchmaking/` | `BlockPanel.tsx` (escudo y etiqueta), `source.ts`, `demo.ts`, `types.ts` |
| `docs/manual/admin/matchmaking.md` | El super bloqueo |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `terms/terminos.html` | Idem, "En preparación" |

## Despliegue

1. Base: aplicar la `135` en el VPS por el túnel (`psql -v ON_ERROR_STOP=1 -f supabase/replanteo/135_mm_super_bloqueo.sql`). Agrega una columna con default constante (no reescribe la tabla) y reemplaza funciones; no hace falta esperar a que terminen los mix.
2. API y web: `deploy/vps/desplegar.sh` de las dos. La API sin la `135` responde error en la ruta nueva; la web sin la API nueva solo falla al tocar el escudo (con un aviso).
3. Después: sacar "En preparación" del super bloqueo en `/terminos` y `terms/terminos.html`, y publicar el changelog (CMLeague 2.9.62).
4. Matchmaking en dos ramas: la base y la API también van en `feat/mm-claim-en-sala` (ver `CLAUDE.md`).

## Pruebas

- Base local, 2026-11-22, con `pruebas/probar_135.sh` (la `135` y la inversa en una transacción con rollback), 6 de 6:
  1. Bloqueo normal del admin en una sala donde separarlos cuesta 1900 de diferencia: se ignora (diferencia 100).
  2. Marcado como super bloqueo: se respeta (diferencia 1900) y `mm_my_profile` trae `super`.
  3. Con los dos en el mismo grupo: la sala se arma igual y el bloqueo figura como ignorado.
  4. Si quien bloqueó deja de ser admin, cuenta como normal, y ya no puede marcar.
  5. No se marca un bloqueo que no existe; desmarcado vuelve a ser normal.
  6. La inversa deja `mm_best_split_ex` y `mm_my_profile` con el mismo `md5` y sin la columna.
- Web: `pnpm typecheck` y las 109 pruebas de `features/matchmaking` pasan.
- Lo que no se probó: el escudo en el navegador con una cuenta admin, ni una sala real.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

Aplicar la inversa y revertir el commit de la API y la web. Se pierden las marcas; los bloqueos quedan como normales.
