# Insignia de jugador verificado: guía de implementación

## Estado

**Desplegado el 2026-11-09 (14:09-14:35 UTC)** desde `main` (`d06cc274`, desplegado como `e53f3e7b4a96`; copias `46524bbc` en `feat/frontend-fase-1` y `62666ff2` en `feat/mm-claim-en-sala`): sin salas, cola ni mixes en vivo; respaldo `20261109T141109Z` (también en R2); `cmleague-mm` parado; contra producción, `probar_88.sh` (con una PCW de prueba: producción no tenía ninguna), la prueba de la `89`, `probar_90_91.sh`, `probar_92.sh`, `probar_93.sh` y `probar_94.sh`, todas en verde y con la inversa igual a antes; 88 → 89 → 90 → 91 → 92 → 93 → 94 desde los archivos commiteados con `PGCLIENTENCODING=UTF8` (la `96` ya estaba); `notify pgrst, 'reload schema'`; la API (`/api/health` con `e53f3e7b4a96`), `cmleague-mm` prendido de nuevo y la web con `--sin-pruebas` (las 703 pasaron antes con `--maxWorkers=2`). La `88` no recalculó nada: no había PCW jugadas, así que el ELO de nadie cambió. Falta mirarlo con una sesión en producción y publicar el changelog.

**Hecho y probado en local el 2026-11-09**, en `kyan/pruebas`. **Sin commit** y **sin aplicar en producción.**

Se despliega junto con los comentarios: la 91 lee `players.verified`, así que la 90 va primero. Los pasos están en la guía de [comentarios](../2026-11-09-comentarios-perfil/GUIA_IMPLEMENTACION.md).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/90_jugadores_verificados.sql` y su inversa | Columnas, trigger y función |
| `web/backend/src/schemas/players.ts` | `PlayerVerification`, `verificationOf` y `PlayerDetail.verification` |
| `web/backend/src/routes/players.ts` | La insignia en la ficha |
| `web/backend/src/routes/admin-players.ts` | `PUT …/verification` |
| `web/backend/src/db/types.ts` | Las cuatro columnas en `players`, a mano: igual que lo que genera `pnpm db:types` con la 90 aplicada |
| `web/frontend/src/components/brand/VerifiedBadge.tsx` (nuevo) | El sello y su ficha |
| `web/frontend/src/features/player/components/VerifyDialog.tsx` (nuevo) | El diálogo del admin |
| `web/frontend/src/auth/permissions.ts` | `canVerifyPlayers` |
| `PlayerProfile.tsx` y su prueba | El sello y "Steam vinculado" |
| Manual: `jugador/cuentas-verificadas.md` (nueva) y `admin/usuarios-y-fichas.md` | |

## Pruebas

- **Base:** el bloque "90" de `probar_90_91.sh docker` (2026-11-09), en verde:
  - solo un admin la pone, la cambia o la saca;
  - un moderador o un jugador no pueden;
  - el `UPDATE` directo del jugador no cambia nada;
  - el del admin falla por el trigger, y cambiar otra columna (la bio) sí funciona;
  - motivo de más de 60 caracteres y color inválido.
  - Las inversas dejan la estructura igual que antes.
- **Web:** `PlayerProfile.test.tsx` (el sello dorado con su nombre accesible). En `/demo/perfil-social`, la ficha de la gris y de la dorada al pasar el mouse.
- **No se probó:**
  - el diálogo del admin contra la API real, porque la base local no tiene la 90;
  - "Saber más" con sesión, que lleva a `/help/jugador/cuentas-verificadas` y solo se ve con sesión.

## En qué se apartó del plan

- Quitar el permiso por columna (`revoke update (verified…)`) no servía: el `UPDATE` de `players` está dado a nivel de tabla. Se reemplazó por el trigger.
- Las listas (ranking, buscador, sala del matchmaking) todavía no muestran el sello. `VerifiedSeal` ya está listo para sumarlo cuando la API lo mande en `PlayerSummary`.
