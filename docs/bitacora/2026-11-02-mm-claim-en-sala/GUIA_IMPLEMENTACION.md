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
2. ~~Commit de las dos ramas~~: **hecho el 2026-11-02** (pedido por Daniel): `d8c4d115` en `feat/mm-claim-en-sala` (base y plugin) y `c05352f5` en `feat/frontend-fase-1` (web). Las dos ramas se subieron a GitHub el 2026-11-02 (pedido por Daniel): `feat/mm-claim-en-sala` como rama nueva (no se tocó `kyan/pruebas`) y `feat/frontend-fase-1`.
3. **Staging:** ~~aplicar la `49`~~ y ~~desplegar la web~~, **hechos el 2026-11-02** (ver abajo). Redesplegar la API no hace falta.
4. **Plugin:** ~~#1~~, **subido el 2026-11-02** (ver abajo). #2 (flow) y #3 siguen con la 2.7.3: la 2.8.2 les llega cuando se abra el matchmaking, en la misma tanda.
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

## Web en staging (2026-11-02)

- **Despliegue:** `deploy/vps/desplegar.sh web` desde `feat/frontend-fase-1` en `b7a10ff3`, sin cambios sin commit en `web/frontend`. Corrieron las pruebas y el build, y se subió la versión `b7a10ff39137`. La anterior era `6d228f93b4dc-local11020706`; su contenido sin commit de ese momento ya está en `c8e48597`.
- **Comprobado en el VPS:** `web/current` apunta a `b7a10ff39137` y `PlayPage-BTYx0emH.js` tiene "Vincula tu SteamID". Desde afuera, `cmleague.lat/assets/…` responde 401: staging tiene autenticación.

## Plugin 2.8.2 en el #1 (2026-11-02)

**Pedido por Daniel: solo en el #1**, el servidor para probar el matchmaking, que manda a staging. Es una excepción, pedida por él, a la regla de `CLAUDE.md` de desplegar en todos los servidores en la misma tanda. #2 (flow) y #3 siguen con la 2.7.3 (producción no tiene el matchmaking).

| Archivo en el #1 | Qué se subió | Respaldo |
|---|---|---|
| `addons/sourcemod/plugins/csstv_reporter.smx` | 2.8.2 **licenciada** con el mismo ID que tenía (`96bb5060-a639-483a-94ef-f15135c57b1b`, "CMLeague #1" en staging): `server/build_licenciado.sh 96bb5060-… srv1`, 136613 bytes | `plugins/disabled/csstv_reporter.smx.bak_2.7.3` |
| `addons/sourcemod/plugins/csstv_password.smx` | El de la línea del matchmaking (`d56fdc64`): con `csstv_mm 1` no toca la contraseña, que maneja la web. 10875 bytes | `plugins/disabled/csstv_password.smx.bak_pre_mm` |
| `cfg/sourcemod/csstv_reporter.cfg` | `csstv_claim "0"` → `"1"` (estaba apagado: sin eso no hay `!claim`) y `csstv_mm "1"` al final. Nada más | `cfg/sourcemod/csstv_reporter.cfg.bak_mm` |

- **Cómo:** por SFTP con el `sftp` de OpenSSH, `SFTP_CSS_*_MVZG`, la contraseña por `SSH_ASKPASS`, los comandos por stdin y la clave del host de `ssh-keyscan`.
- **Verificado:** se bajaron los tres archivos y el respaldo del cfg, y coinciden byte a byte con lo que se subió.
- **Sin recargar:** entra en el próximo cambio de mapa (`CLAUDE.md`: no recargar con una partida en curso). Al subirlo, el #1 seguía reportando a staging (`last_seen_at` al día) y todavía no había consultado salas (`mm_server_state` vacío).
- **Diferencias de cfg con el repo:** las que ya había (el #1 se armó igual al #3, punto 1.44 de `PENDIENTES.md`) no se tocaron.

**Qué cambia en el #1 desde el próximo mapa:**

- **La contraseña la maneja la web:** al cambiar de mapa pone una al azar. Sin una sala del matchmaking, nadie entra salvo con la que se rote desde Administración › Matchmaking › Servidores.
- **Consultas:** cada 5 s consulta salas a staging. En staging, "CMLeague #1" ya tiene `mm_enabled = true` y región `Sudamerica`, pero la cola está cerrada (`mm_config.open = false`).
- **El `!claim`** funciona contra staging.

**Para volver atrás:** renombrar los tres respaldos a su nombre original, con el próximo cambio de mapa.

**Ojo en staging:** flow también figura con `mm_enabled = true`, pero su plugin apunta a producción y nunca consulta a staging, así que no le llegan salas (`mm_free_server` pide un poll de los últimos 30 s).

## Replanteo `52`: cuentas sin ficha (2026-11-02)

**El problema:** al registrarse no se crea una ficha, solo el `!claim` (o un admin) la crea. `mm_block_reason` exigía una ficha una línea antes del SteamID, así que **la `49` no alcanzaba**: una cuenta nueva seguía sin poder entrar a la cola. En la copia de producción, 1177 de 2265 cuentas no tienen ficha, y en staging ninguna de las 4. Las pruebas de la `49` no lo vieron porque le creaban la ficha a mano a la cuenta de prueba.

**Por qué no alcanzaba con crearle una ficha al entrar a la cola:** rompía el caso más común. Un jugador que jugó antes de registrarse tiene una ficha vieja con su SteamID y sin cuenta (2082 en la copia). Si la cuenta ya tiene una ficha vacía, el `!claim` respondía "Ese SteamID es de otra ficha: pedile a un admin".

**Cambios (aprobados por Daniel el 2026-11-02):**

- **`mm_ensure_player`:** `mm_join` le crea la ficha con el alias a cada integrante que no la tenga, y `mm_block_reason` ya no pide ficha.
- **`claim_with_code`:** si la ficha de la cuenta está vacía (`player_is_empty`: sin SteamID, sin adicionales y sin partidas) y el SteamID es de una ficha sin cuenta, se unen con `player_merge_empty`:
  - Todo lo que apuntaba a la vacía pasa a la vieja. Se recorren las claves foráneas a `players`, así que entran las tablas del matchmaking y las que se sumen, y también `matches.lineup1` y `lineup2`.
  - Si una fila ya existe con la vieja, la de la vacía se borra.
  - Después se borra la vacía y la cuenta pasa a la vieja. El trigger le pone el alias como nick, igual que cuando se toma una ficha cargada por un admin.
- **`mm_after_claim`:** después de un `!claim` que vincula, el ELO de la cola y de la sala abierta pasa a ser el de la ficha (antes quedaba en 1000) y avisa a la sala.
- **Arreglo de paso:** las 28 cuentas de la copia que tienen una ficha vacía tampoco reciben más "pedile a un admin".
- **Sin cambios en el plugin:** en el siguiente poll ve el SteamID en `t1` o `t2` y lo pasa a su equipo.
- **El reemplazo de `claim_with_code`** se hace con `pg_temp.reemplazar`, como en la `34`: si el texto no está, aborta sin aplicar nada. La inversa hace el reemplazo al revés y vuelve `mm_join` y `mm_block_reason` a como estaban.

**Pruebas (`pruebas/52_mm_cuentas_sin_ficha.sql`, 20 comprobaciones) contra la copia de producción de la base local**, dentro de una transacción que se deshace (`correr_local.sh` corre de la `49` a la `52` y las dos inversas):

- **Cuenta sin ficha:** no está bloqueada, `mm_join` le crea la ficha con el alias y queda en la cola.
- **A. `!claim` con el SteamID de una ficha vieja real** (1 mix, ELO 997):
  - La cuenta queda con la ficha vieja y la vacía se borra.
  - ELO, mixes y partidas quedan iguales.
  - La sala y el plantel apuntan a la vieja, y el ELO de la sala se actualiza.
  - El poll la reconoce (`unlinked=0`) y "connected" funciona.
- **B. `!claim` con un SteamID real que jugó y no tiene ficha:** queda con el ELO de ese SteamID, sus partidas y el ELO de la cola actualizado.
- **C. `!claim` con el SteamID de una ficha que ya tiene cuenta:** "Ese SteamID pertenece a otra cuenta", y la ficha vacía queda.

**Staging (2026-11-02):**

- **Antes:** `mm_join` y `mm_block_reason` estaban como las espera la `52` (`mm_join` como en la `48` y `mm_block_reason` como en la `49`), y `claim_with_code` igual que en local.
- **Aplicada** sin errores.
- **Verificado:**
  - `claim_with_code` llama a `player_merge_empty` y `mm_after_claim`.
  - `mm_join` llama a `mm_ensure_player`.
  - `mm_block_reason` ya no pide ficha.
  - `player_merge_empty` no es ejecutable para `authenticated`.
  - `claim_with_code` (para `anon`) y `mm_join` (para `authenticated`) mantienen sus permisos.
- **Sin pruebas con datos de staging:** no tiene fichas viejas sin cuenta.

**Lo que no cubre:** a una cuenta sin ficha no la pueden invitar a un grupo (`mm_party_invite` busca por ficha) hasta que entre a la cola una vez o haga `!claim`.
