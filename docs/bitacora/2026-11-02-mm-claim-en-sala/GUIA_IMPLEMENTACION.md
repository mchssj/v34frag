# Matchmaking sin SteamID vinculado: guía de implementación

## Estado

**Implementado y probado en local el 2026-11-02, con commit. Replanteo `49` aplicado en staging el 2026-11-02.** Web y plugin sin desplegar.

- **Base:** la `49` se probó en la base local del backend, dentro de una transacción que se deshace (`pruebas/correr_local.sh`). Aplica las `45` y `48` si faltan, después la `49`, las 15 comprobaciones y la inversa. La base local quedó como estaba.
- **Plugin:** 2.8.2. Compila con `spcomp` 1.8 sin advertencias. **No se probó en un servidor.**
- **Web:** typecheck y lint limpios, y 470 pruebas en verde (5 nuevas en `ClaimCard.test.tsx`).

## Ramas

| Parte | Rama | Carpeta |
|---|---|---|
| Base y plugin | `feat/mm-claim-en-sala`, nueva, sale de `origin/kyan/pruebas` (`5ef75cc9`) | worktree `E:\Css V34 Web\v34frag-mmclaim` |
| Web y bitácora | `feat/frontend-fase-1` | `E:\Css V34 Web\v34frag` |

El worktree de kyan (`v34frag-kyan`) estaba 395 commits atrás de `origin/kyan/pruebas` y con cambios suyos sin commit, así que no se tocó.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/49_mm_claim_en_sala.sql` | Nuevo: `mm_block_reason`, `csstv_mm_poll` y `mm_player_card` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/49_mm_claim_en_sala.sql` | Nueva: las tres funciones como en la `48` |
| `server/addons/sourcemod/scripting/csstv/mm.inc` | `Mm_RosterSizes`, `Mm_UpdateRoster`, `Mm_ClaimNag`, `Mm_ClaimHint`, `Mm_WaitingClaim` y `Mm_OnClaimLinked` |
| `server/addons/sourcemod/scripting/csstv/match.inc` | Aviso del `!claim` al entrar |
| `server/addons/sourcemod/scripting/csstv/claim.inc` | Llama a `Mm_OnClaimLinked` |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | Versión 2.8.2 |
| `web/frontend/src/features/matchmaking/room/ClaimCard.tsx` | Nuevo: tarjeta y `needsClaim` |
| `web/frontend/src/features/matchmaking/room/RoomOverview.tsx` | Muestra la tarjeta y la marca "Sin vincular" |
| `web/frontend/src/features/matchmaking/types.ts` | `MmPlayer.linked?` |

No hizo falta tocar la API: `GET /api/v1/mm/state` devuelve `mm_my_state()` tal cual.

## Cambios respecto del plan

- **El `.smx` no se actualizó en el repo:** el commit de la 2.8.1 tampoco lo hizo. Se compila al desplegar.
- **Bug encontrado por las pruebas de la tarjeta:** la primera versión calculaba el código vigente en cada render. Al vencer, ese cálculo dejaba de devolverlo y la tarjeta quedaba en "Generando código…" sin el botón para pedir otro. Ahora el código queda fijo al montar (`ClaimBody`).

## Pruebas

```bash
# Base (no deja nada en la base local)
bash docs/bitacora/2026-11-02-mm-claim-en-sala/pruebas/correr_local.sh "E:/Css V34 Web/v34frag-mmclaim"
# NOTICE:  OK: 15 comprobaciones del replanteo 49
# NOTICE:  OK: la inversa vuelve a pedir SteamID

# Plugin
SC="E:/CSS DEDICATED SERVER/server/cstrike/addons/sourcemod/scripting"
cd server/addons/sourcemod/scripting
"$SC/spcomp.exe" csstv_reporter.sp -i"$SC/include" -iinclude -o<scratchpad>/csstv_reporter.smx

# Web
cd web/frontend && pnpm typecheck && pnpm lint && pnpm exec vitest run
```

Las 15 comprobaciones de la base:

- Cola sin SteamID: entra, y una sanción sigue bloqueando.
- Poll con un jugador sin vincular: `n1`, `n2`, `unlinked=1`, `t1` con el vinculado y `t2` vacío.
- `linked` de cada tarjeta.
- "connected" no reconoce un SteamID sin ficha.
- `!claim` con un código de `create_claim_code`.
- Después del `!claim`: `unlinked=0`, `t2` con el SteamID nuevo, `linked` en `true` y "connected" que lo reconoce.

## Falta

1. **Probar el plugin con un servidor y dos clientes** (uno vinculado y otro sin vincular). Comprobar: espectador, recordatorio, `!claim`, el paso a su equipo, que "connected" llegue y que el `!ready` espere.
2. ~~Commit de las dos ramas~~: **hecho el 2026-11-02** (pedido por Daniel): `d8c4d115` en `feat/mm-claim-en-sala` (base y plugin) y `c05352f5` en `feat/frontend-fase-1` (web). Ninguna rama se subió a GitHub.
3. **Staging:** ~~aplicar la `49`~~, **hecho el 2026-11-02** (ver abajo). Falta la web, junto con el próximo despliegue de staging. Redesplegar la API no hace falta.
4. **Plugin:** cuando se despliegue el matchmaking, la 2.8.2 va a #1, #2 y #3 en la misma tanda: genérico en #1 y #3, y build licenciado en flow (#2). El #1 también puede seguir con su build licenciado. Hasta entonces, el 2026-11-01 Daniel decidió no tocar el plugin de ningún servidor.
5. ~~`min_mixes`~~: **en 0 desde el 2026-11-02** (replanteo `50`, ver abajo).
6. ~~`min_account_days`~~: **en 0 desde el 2026-11-02** (replanteo `51`, ver abajo).

## Replanteo `49` en staging (2026-11-02)

Pedido por Daniel. Supabase de staging `edaljnirzvisiaathitt`, por el session pooler (usuario `postgres.<ref>`).

1. **Antes:** se bajaron con `pg_get_functiondef` las tres funciones que cambia la `49`. Eran idénticas a las de la `48` del repo (la corrección del 2026-11-01, `fix_mm_admin_staging.sql`, no las toca), así que la `49` no pisa nada hecho a mano.
2. **Aplicada:** `psql -v ON_ERROR_STOP=1 -f supabase/replanteo/49_mm_claim_en_sala.sql` terminó sin errores.
3. **Verificado:**
   - `mm_player_card` tiene `linked`.
   - `csstv_mm_poll` manda `unlinked=`.
   - `mm_block_reason` ya no pide SteamID.
   - Los permisos siguen como en la `48`: `csstv_mm_poll` para `anon` y `mm_block_reason` solo para `service_role`.
4. **Estado de staging ese día:** la cola cerrada (`open = false`), `min_mixes = 5`, `require_anticheat = false` y ninguna sala abierta. **No hay fichas con cuenta y sin SteamID**, así que la prueba de punta a punta necesita crear una cuenta nueva.

## Replanteo `50`: `min_mixes` en 0 (2026-11-02)

**Decisión de Daniel (2026-11-02):** `min_mixes` siempre en 0. Con el matchmaking como única forma de jugar, un jugador nuevo no tiene dónde jugar los mixes que pide el mínimo. Ese es el mismo problema que resuelve este pedido.

- **Replanteo `supabase/replanteo/50_mm_min_mixes_cero.sql`:** pone `min_mixes` en 0 y cambia el valor por defecto a 0. La inversa vuelve a 5.
- **Prueba local:** corrió en una transacción que se deshace. Después de la `50` da 0 y 0, y después de la inversa da 5.
- **Staging:** aplicada el 2026-11-02 sin errores. `min_mixes = 0` y el valor por defecto también es 0.
- **Por qué un replanteo nuevo:** la `49` ya estaba aplicada en staging.

## Replanteo `51`: `min_account_days` en 0 (2026-11-02)

**Decisión de Daniel (2026-11-02):** `min_account_days` en 0 por ahora. En una comunidad tan chica como la de Source, esperar días es un freno muy grande para los jugadores nuevos. Contra quien se hace otra cuenta para evadir un baneo alcanza el SteamID.

**Lo que se comprobó en el código:**

- **SteamID de otra ficha:** `claim_with_code` (replanteo `15`) no lo vincula. Responde "Ese SteamID pertenece a otra cuenta" o "Ese SteamID es de otra ficha: pedile a un admin que lo revise".
- **Baneo de una ficha:** alcanza a todos sus SteamID en todos los servidores (`ban_active_for` y `csstv_bans_since`, replanteo `31`). El plugin lo revisa al conectarse (`csstv_ban_check`). Una cuenta nueva no puede usar el SteamID de la baneada: el `!claim` lo rechaza y, aunque entrara, el servidor la echa.
- **SteamID baneado sin ficha:** si una cuenta nueva lo reclama, el baneo sigue valiendo por SteamID. El plugin la echa y `mm_block_reason` no la deja entrar a la cola (`bans.steam_id`).
- **Lo que no cubre:** una cuenta nueva **con otro SteamID** (en v34 se cambia con el emulador). Así evade las sanciones del matchmaking, que van por cuenta (`mm_penalties`, `mm_bans`), y también el baneo. Esto pasaba igual con los 7 días, que solo lo demoraban. Para detectarlo están las IPs de la ficha (`admin_player_ips`, replanteo `38`).

**Cambios:**

- **Replanteo `supabase/replanteo/51_mm_min_account_days_cero.sql`:** pone `min_account_days` en 0 y cambia el valor por defecto a 0. La inversa vuelve a 7.
- **Prueba local:** corrió en una transacción que se deshace. Después de la `51` da 0 y 0, y después de la inversa da 7.
- **Staging:** aplicada el 2026-11-02 sin errores. `min_mixes = 0` y `min_account_days = 0`, los dos también con 0 por defecto.
