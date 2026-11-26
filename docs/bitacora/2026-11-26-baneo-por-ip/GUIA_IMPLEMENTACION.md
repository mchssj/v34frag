# Baneo por IP y por rango desde la web: guía de implementación

## Estado

Desplegado el 2026-11-26: replanteos `149` (22:56 UTC) y `150` (23:20 UTC), Caddy, API y web `833b692f19af`. Primer rango: `181.21.0.0/16` en el baneo permanente de Nose ("Cheater"), con GabeV exceptuado.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/149_baneo_por_ip.sql`, `150_excepciones_baneo_ip.sql` e inversas | Base |
| `pruebas/prueba_149.sql`, `pruebas/prueba_150.sql` | Pruebas de la base (con `rollback`) |
| `deploy/vps/Caddyfile` | `127.0.0.1/32` y `::1/128` en `trusted_proxies`; `client_ip_headers CF-Connecting-IP X-Forwarded-For` |
| `web/backend/src/lib/supabase.ts`, `lib/ratelimit.ts`, `lib/auth.ts` | La IP del usuario en `X-Forwarded-For` de todos los clientes de Supabase |
| `web/backend/src/routes/auth.ts` | Registro frenado con IP baneada; `account_ip_seen` al iniciar sesión y renovar |
| `web/backend/src/routes/mm.ts` | `account_ip_seen` al entrar a la cola |
| `web/backend/src/routes/admin-ban-ips.ts`, `schemas/admin.ts`, `app.ts` | Rutas de admin |
| `web/backend/test/unit/ban-ips-routes.test.ts`, `auth-routes.test.ts`, `mm-live-state.test.ts` | Pruebas |
| `web/frontend/src/features/admin/bans/` (`BanIpsSection.tsx` y su prueba, `BanPanel.tsx`, `api/queries.ts`) y `src/api/schema.d.ts` | Sección IPs y rangos |
| `/privacidad`, `/terminos` (web y `terms/`), `docs/manual/moderador/banear-jugador.md`, `docs/manual/jugador/baneos-y-sanciones.md` | Legales y manual |

Commits `427ea298`, `3384c63e` y `833b692f`.

## Despliegue (2026-11-26)

1. Respaldo `20261126T225527Z`.
2. `149` como `supabase_admin`; Caddyfile validado e instalado (`/etc/caddy/Caddyfile.antes-ip` de copia) con `systemctl reload caddy`; API y web `3384c63e550d` (sin salas, 4 en la cola).
3. Comprobado: las IPs que registra la base son las reales de los usuarios (IPv6 de proveedores argentinos), ninguna de Cloudflare ni del VPS; los servidores de juego siguen con 200; la API sin errores.
4. `150` y API y web `833b692f19af` (una sala en vivo).
5. Rango `181.21.0.0/16` con `admin_ban_ip_add` como la cuenta de Daniel, en el baneo `46f6aa09` de Nose, con GabeV exceptuado (usa ese proveedor, con IPs en 5 `/24` distintos, y no está baneado). Comprobado con `ip_banned_for`: Nose frenado, GabeV no, una cuenta nueva sin sesión frenada, `181.22.*` no.

## Pruebas

- Base: `prueba_149.sql` (IP del pedido, IPs de la web, admin, rangos, freno en cola y grupos, levantar, permisos) y `prueba_150.sql` (excepción por ficha y por cuenta, listados, permisos), contra producción con `rollback`.
- API: 704 pruebas. Web: 901, typecheck y lint. Manual validado.

## En qué se apartó del plan

- **Rangos** (Daniel, durante la implementación): hasta `/16`, con "a quién afecta" antes de confirmar.
- **Excepciones** (Daniel, al ver que el `/16` alcanzaba a GabeV): replanteo `150`.
- **Freno:** cola, aceptar y grupos; no el veto ni el conectar (sin aceptar no se llega).
- **`mm_my_state`** no informa la IP baneada: la web muestra el error al intentar entrar a la cola.
- **La sección va en el detalle del baneo**, no en el diálogo de baneo: después de banear, la página abre ese detalle.

## Cómo revertir

1. Levantar un rango: la X en la sección, o levantar el baneo.
2. Base: inversas del `150` y del `149` (en ese orden).
3. Caddy: `/etc/caddy/Caddyfile.antes-ip` y `reload`.
4. API y web: la versión anterior con `desplegar.sh`.
