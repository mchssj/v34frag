# Baneo permanente de una IP o rango: guía de implementación

## Estado

Desplegado el 2026-11-27 (UTC): replanteo `153` y API y web `4d587789fd0c` (el código es de `2bfe22f9`).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/153_baneo_ip_permanente.sql` e inversa | Base |
| `pruebas/prueba_153.sql` | Prueba de la base (con `rollback`) |
| `web/backend/src/routes/admin-ban-ips.ts`, `schemas/admin.ts` y su prueba | `full` en `POST /api/v1/admin/bans/{id}/ip`; `minutes: 0` en `POST /api/v1/admin/ban-ips`; `BanIp.expires_at` nullable |
| `web/frontend/src/features/admin/bans/` (`BanIpsSection.tsx`, `BanPanel.tsx`, `ServerIpBansPanel.tsx`, `api/queries.ts` y sus pruebas), `src/api/schema.d.ts` | La elección de duración |
| `docs/manual/moderador/banear-jugador.md`, `TermsPage.tsx`, `terms/terminos.html` | Textos |

## Pruebas

- Base: `prueba_153.sql` contra producción con `rollback`: permanente con un baneo permanente, 30 días sin `p_full`, hasta el vencimiento del baneo con `p_full`, sin ficha con `0`, la lista con `null`, y que frena.
- API 710 y web 906 pruebas, typecheck y lint.

## Despliegue (2026-11-27)

1. `153` como `supabase_admin`. Es compatible con la API anterior (`p_full` tiene valor por defecto).
2. Sin salas abiertas (4 en la cola, que vive en la base): `desplegar.sh api` y `desplegar.sh web`.

## Cómo revertir

1. API y web: la versión anterior con `desplegar.sh`.
2. Base: la inversa del `153` y volver a correr `admin_ban_ip_add` y `admin_ban_ips` del `150` y `admin_ban_ip_add_loose` del `152`. Los permanentes ya puestos quedan; se levantan desde la web.
