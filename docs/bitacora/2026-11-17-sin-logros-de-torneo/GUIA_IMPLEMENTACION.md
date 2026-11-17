# Sin logros de torneo dados a mano: guía de implementación

## Estado

**La base se desplegó el 2026-11-17** (replanteo `127`). Los textos de la API y de la web **faltan desplegar**: van con el próximo despliegue de cada una. Mientras tanto, la ficha dice "staff, caster, campeón de torneo…" pero la lista ya no ofrece ninguna de torneo.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/127_sin_logros_de_torneo.sql` | Nuevo: respaldo y borrado de las medallas, los destacados, los avisos y las definiciones de torneo |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/127_sin_logros_de_torneo.sql` | Nuevo: la inversa, desde los respaldos |
| `supabase/replanteo/README.md` | Fila de la `127` |
| `web/backend/src/routes/medals.ts` | Texto del error al crear desde una plantilla de torneo |
| `web/backend/src/schemas/medals.ts` | Descripción de `MedalGrant` sin "campeón de torneo" |
| `web/backend/test/integration/manual-medal.ts` | Nuevo: la definición manual `staff` para las pruebas (la crea si no está) |
| `web/backend/test/integration/medals.test.ts` | "Fichas" con `staff`; "medallas de torneo" pasa a "sin logros de torneo" (no están ni se crean, y el progreso no las lista) |
| `web/backend/test/integration/mixes-perfil-ranking.test.ts`, `pins.test.ts`, `players-teams.test.ts` | `staff` en lugar de `campeon_torneo` |
| `web/frontend/src/features/admin/players/components/FichasTab.tsx` | Solo las manuales y el texto "staff, caster…" |
| `web/frontend/src/features/admin/medals/lib/editor.ts` y `components/MedalEditor.tsx` | Texto y comentario sin "se da a mano" |
| `docs/manual/admin/medallas.md`, `admin/usuarios-y-fichas.md` y `jugador/vitrina-y-pines.md` | Ver DOCUMENTACION |
| `docs/bitacora/README.md` | Fila de este requerimiento |

## Despliegue

### Base (hecho el 2026-11-17)

1. Túnel con el `ssh` de Windows (`C:\Windows\System32\OpenSSH\ssh.exe`, el que tiene la clave): `ssh -N -L 5433:127.0.0.1:5432 ubuntu@<VPS>`.
2. Prueba con `rollback`: la migración sin `commit`, la inversa sin `begin` ni `commit` y un `rollback` al final, en un solo `psql -f`.
3. Aplicarla:

   ```bash
   tr -d '\r' < supabase/replanteo/127_sin_logros_de_torneo.sql | psql -v ON_ERROR_STOP=1
   ```

No hace falta reiniciar nada ni esperar al final de los mix: el servidor de juego no usa las medallas.

### API y web (pendiente)

Con el próximo despliegue de cada una. No hay cambios de contrato: solo textos.

## Pruebas

### Producción (2026-11-17)

- **Antes:** 2 definiciones, 17 medallas, 1 destacado y 6 avisos de torneo; 898 medallas y 2981 avisos en total.
- **Prueba con `rollback`:** después de la migración, 0, 0, 0 y 0 (881 medallas y 2975 avisos). Después de la inversa, otra vez 2, 17, 1 y 6, y el md5 de toda `player_medals` igual al de antes. Después del `rollback`, todo igual al principio.
- **Aplicada:** `se borraron 2 definiciones, 17 medallas, 1 destacados y 6 avisos`. Por REST, ninguna medalla manual con "torneo" en el título, y `player_medals_127_respaldo` responde 401 con la clave pública.

### API y web

- API: `tsc` del proyecto con las pruebas (`tsconfig.node.json`) sin errores y `pnpm test` (unitarias) 677 de 677.
- **Las de integración no se corrieron:** Docker no estaba levantado (`pnpm db:start`). Quedan para la próxima vez que se levante la Supabase local con la `127` aplicada.
- Web: `tsc` sin errores y las pruebas de `src/features/admin` 95 de 95.

## En qué se apartó del plan

Nada.

## Cómo revertir

Por el túnel, antes de borrar los respaldos (2026-12-17):

```bash
tr -d '\r' < docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/127_sin_logros_de_torneo.sql | psql -v ON_ERROR_STOP=1
```

Vuelven las dos definiciones, las 17 medallas, el destacado de kyan (si no ocupó ese lugar con otro logro) y los 6 avisos, sin avisos nuevos.
