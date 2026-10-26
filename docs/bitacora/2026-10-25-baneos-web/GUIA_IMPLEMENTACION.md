# Baneos de los servidores gestionados desde la web: guía de implementación

## Estado

Primera tanda (base y API) implementada y probada en local el 2026-10-26, sin despliegue. Sale con el corte (replanteo `31`).

Pendiente, en este orden:
- el frontend;
- el plugin `csstv_bans`;
- la importación de los `banned_user.cfg`.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/31_baneos.sql` | Rol `moderator`, `is_moderator`, `set_user_role` con `moderator`, tabla `bans` y su trigger, `ban_owner`, `ban_active_for`, `ban_steams`, `ban_insert`, `ban_create`, `ban_update`, `ban_lift`, `ban_unix`, `csstv_ban_check`, `csstv_bans_since`, `csstv_ban_add`, `csstv_ban_lift` y la vista `ban_list` |
| `supabase/replanteo/README.md` | Fila de la `31` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/31_baneos.sql` | Inversa. Aborta si hay cuentas `moderator` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/31_baneos.sql` | 49 comprobaciones |
| `web/backend/src/routes/bans.ts` | Nuevo: las 5 rutas |
| `web/backend/src/schemas/bans.ts` | Nuevo: `Ban`, `BanList`, `BanQuery`, `PlayerBanQuery`, `BanIdParam`, `BanCreate`, `BanPatch` y `BanLift` |
| `web/backend/src/services/bans.ts` | Nuevo: `BAN_FIELDS`, `toBan` y `activeBan` |
| `web/backend/src/app.ts` | Registra `bans` |
| `web/backend/src/lib/auth.ts` | `isModerator` y `requireModerator`; `isAdmin` usa `userRole` |
| `web/backend/src/services/account.ts`, `schemas/auth.ts`, `schemas/admin.ts` | `moderator` en el rol de la sesión y en el filtro de usuarios |
| `web/backend/src/routes/pcw-play.ts` | `PUT /admin/users/{id}/role` acepta `moderator` |
| `web/backend/src/schemas/players.ts`, `routes/players.ts` | `ActiveBan` y `ban` en la ficha |
| `web/backend/src/schemas/claim.ts`, `routes/claim.ts` | `ban` en el perfil sin reclamar |
| `web/backend/src/db/types.ts` | Regenerado |
| `web/backend/test/unit/bans-routes.test.ts` | Nuevo: 11 pruebas |
| `web/backend/test/unit/claim-routes.test.ts` | `ban: null` en el perfil sin reclamar |
| `web/backend/test/integration/bans.test.ts` | Nuevo: 8 pruebas |
| `docs/frontend/contrato/admin.md`, `jugadores.md`, `api.md`, `decisiones.md` y `README.md` | Contrato |
| `docs/bitacora/2026-10-25-baneos-web/PLAN.md` | Decisiones del 2026-10-26, antes de aprobarlo |

## Despliegue (pendiente, en el corte)

1. Aplicar `supabase/replanteo/31_baneos.sql` después de la `30`.
2. Desplegar el backend con la web nueva.
3. El admin nombra a los moderadores desde Administración (cuando esté el frontend).
4. **Plugin y servidores:** con la web nueva (decidido por Daniel el 2026-10-26), después de hacer y probar `csstv_bans`:
   - importar los `banned_user.cfg`;
   - desplegar `csstv_bans` en el servidor real y en RBK (build licenciado) en la misma tanda.

## Pruebas

### Base de datos

Se probó en la Supabase local con los pasos de `pruebas/correr.sh`, sin el reset de la base:
- **Pruebas:** 49 comprobaciones en verde. Cubren:
  - roles: quién nombra, que el admin no se dé desde la web, y qué hace cada uno;
  - banear: permisos, datos inválidos, una ficha sin SteamID y la tabla no legible directo;
  - el reemplazo y un activo por ficha;
  - el SteamID adicional;
  - cambiar y levantar, con las reglas de permanente;
  - un SteamID que después suma una ficha;
  - las cuatro funciones del plugin: token, SteamID inválido, `!ban` permanente que no se acorta, sincronización con y sin cursor, SteamID nuevo de una ficha baneada y `!unban`;
  - vencidos, permisos de `anon` y la lista pública.
- **Segunda aplicación:** aborta.
- **Inversa:** deja la estructura idéntica, y la migración se vuelve a aplicar después.

### API

- **Typecheck:** sin errores.
- **Unitarias:** `pnpm test`, 326 en verde (11 nuevas).
  - Esquemas de alta y cambio.
  - SteamID oculto o visible, y `search` contra `search_all`.
  - Baneo del juego levantado.
  - `403` sin rol y argumentos en null.
  - El error `42501` de la base como `403`.
  - `404` sin llamar a la función.
  - Cambiar y levantar.
- **Integración:** `pnpm test:int` contra la Supabase local, 135 en verde (8 nuevas).
  - Nombrar moderador y verlo en `/me/profile`.
  - Banear una ficha y verlo en la ficha y en la lista, con la búsqueda por SteamID.
  - `csstv_ban_check` con la anon key.
  - Permanente: moderador no, admin sí.
  - Levantar e historial.
  - SteamID sin ficha en el perfil sin reclamar.
  - `csstv_ban_lift`.
  - Un usuario común no banea.

## En qué se apartó del plan

- **Sincronización cada 3 minutos, no cada 30 s** (Daniel, 2026-10-26): para no sumarle carga al servidor real mientras no se sepa qué lo congela (`docs/PENDIENTES.md`, 2.00).
  - El plugin también sincroniza al empezar cada mapa.
  - `!syncbans` (moderadores y admins) sincroniza al momento, con 15 s de espera entre usos, y avisa en el chat cuántos echó.
  - A quien se conecta lo frena siempre la consulta al entrar. La espera solo afecta a quien ya está jugando: un baneo de la web lo echa en hasta 3 minutos, o al instante con `!syncbans`.
  - La base no cambia: el cursor funciona igual con cualquier intervalo.
- **Nombres de las funciones del plugin:**
  - El plan decía `server_ban_check`, `server_bans_since`, `server_ban_add` y `server_ban_lift`. Quedaron con el prefijo `csstv_`, como las demás del plugin (`csstv_whois`, `csstv_match_lookup`).
  - `csstv_ban_add` suma `p_nick` (el nombre del jugador si está conectado) y `csstv_ban_lift` suma `p_admin_name`.
- **SteamID en la lista pública:**
  - El plan lo ponía siempre. Con ficha, solo lo ven moderadores y admins, por la regla de SteamID ocultos del 2026-10-24.
  - Sin ficha es público, como los perfiles sin reclamar.
  - La búsqueda pública tampoco encuentra una ficha por su SteamID.
- **`!ban` sobre un permanente:** si ya hay un baneo permanente activo, un `!ban` del juego no lo reemplaza (devuelve el mismo id). El plan no lo decía.
- **Ficha sin SteamID:** no se puede banear (no hay nada que aplicar en los servidores).
- **`ban` también en el perfil sin reclamar** (`GET /players/steam/{steamid}`), además de la ficha. "La foto en vivo" del plan no se tocó: no hay una ficha en vivo aparte.
- **`docs/PENDIENTES.md`:** se actualizó en la rama `feat/frontend-fase-1`, donde estaba el plan (sección 6). En `feat/backend-api-fase-1` no se tocó: tenía cambios sin commit de otra sesión (la investigación del crash del 2026-10-26).

## Cómo revertir

1. En la base local, aplicar la inversa: `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/31_baneos.sql`. Antes, pasar a otro rol a las cuentas `moderator`.
2. Revertir el commit del backend.
