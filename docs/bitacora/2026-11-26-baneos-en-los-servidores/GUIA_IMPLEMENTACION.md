# Baneos en los servidores: guía de implementación

## Estado

Desplegado el 2026-11-27 (UTC): replanteo `151` (00:07), reporter 2.12.0 subido a **#1, #2 y #3** (entra en el próximo cambio de mapa de cada uno), API y web `5e78a062107b`.

## Archivos

| Archivo | Cambio |
|---|---|
| `server/addons/sourcemod/scripting/csstv/bans.inc` | Nuevo |
| `server/addons/sourcemod/scripting/csstv_reporter.sp` | 2.12.0: `Bans_Init`, `Bans_OnConfigsExecuted` y `Bans_OnJoin` (primero en `OnClientPostAdminCheck`) |
| `server/addons/sourcemod/plugins/csstv_reporter.smx` | Compilado con `spcomp` 1.8.0.5963 (el del servidor local) |
| `supabase/replanteo/151_baneos_servidor_ip.sql` e inversa | Base |
| `web/backend/src/routes/admin-ban-ips.ts`, `schemas/admin.ts` y su prueba | `GET /api/v1/admin/ban-ips` |
| `web/frontend/src/features/admin/bans/` (`ServerIpBansPanel.tsx` y su prueba, `BanIpsSection.tsx`, `AdminBansPage.tsx`, `lib/search.ts`, `api/queries.ts`) y `src/api/schema.d.ts` | Pestaña **IPs del servidor** |
| Manual (4 páginas), `/terminos`, `/privacidad` y `terms/*.html` | Textos |

Commit `5e78a062`.

## Pruebas

- **Base:** `pruebas/prueba_151.sql` (con `rollback`, contra producción): `!banip`, excepciones en el chequeo y en la copia, `!ban` con IP y mismo vencimiento, levantar el baneo levanta la IP, `!unbanip`, la web frena los sin ficha, permisos.
- **Plugin:** `pruebas/probar_local.sh`, servidor local con bots y la base local apagada: **21 de 21** (copia local por SteamID, vencidos, rangos, `/32`, excepciones; expulsión; `!banip` rechaza `/8` e IPs inválidas; `!unbanip`, `!unban` y `sm_addban` en la copia; `banned_user.cfg` sin tocar; los cuatro pedidos en la cola; sincronizar sin web deja la copia; `csstv_bans 0`). Arranca sin SourceTV (`-nohltv`): el juego abierto en la PC puede tener el 27020.
- **Por HTTP con el token del #1** (después del `151`): la copia trae los 8 SteamID baneados y el rango `181.21.0.0/16` con la excepción de GabeV; una IP del rango da "baneado por IP" y una de afuera no.
- API 706 y web 903 pruebas, typecheck y lint.

## Despliegue (2026-11-27)

1. Respaldo `20261127T000638Z` (también en R2) y `151` como `supabase_admin`.
2. Importación de `banned_user.cfg` del #1: **no hizo falta**, los dos SteamID (LESCO y Nose) ya tenían un baneo activo en la web. #2 y #3 lo tenían vacío; `banned_ip.cfg` vacío en los tres.
3. Sin mixes en curso (último evento de los tres: cierre o cancelación), `pruebas/desplegar.py .env --hacer`: la 2.10.3 (`d7c3a929…`) a `plugins/disabled/csstv_reporter_2.10.3.smx` y la 2.12.0 (`c00156df…`) en su lugar, comparadas byte a byte. Sin recargar.
4. Sin salas ni nadie en la cola: `desplegar.sh api` y `desplegar.sh web`.

## Falta

- Comprobar en cada servidor, después de su cambio de mapa: `sm plugins info csstv_reporter.smx` (2.12.0) y `sm_csstv_bans` (8 SteamID y 1 rango).
- Después, vaciar `banned_user.cfg` del #1 (con copia).
- Probar con una persona: un moderador con `!ban <jugador> 0` (rechazado), y alguien baneado que intenta entrar.
- **Ramas:** `feat/frontend-fase-1` y `feat/mm-claim-en-sala` no tienen los replanteos 148 a 151 ni el reporter 2.10.x; no se copió (los baneos no son del matchmaking).

## En qué se apartó del plan

- **IPs y rangos** (sección 10, Daniel): `!banip`, `!unbanip` y la IP del `!ban` de un admin.
- **Copia local en texto** (`csstv_bans_compact` y `csstv_ban_ips_compact`) y no `csstv_bans_since` con cursor: la lista entera es chica, y así cubre las IPs y las bajas sin cursor.
- **`sm_banip`** lo toma el reporter (antes iba a quedar el de SourceMod).
- **Comando de diagnóstico** `csstv_bans_test`.

## Cómo revertir

1. Servidores: `plugins/disabled/csstv_reporter_2.10.3.smx` a `csstv_reporter.smx` en los tres (entra en el cambio de mapa), o `csstv_bans 0` en vivo.
2. Base: la inversa del `151` (borra los `!banip` sin ficha).
3. API y web: la versión anterior con `desplegar.sh`.
