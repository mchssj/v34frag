# Banear una IP o rango sin ficha desde la web: guía de implementación

## Estado

Desplegado el 2026-11-27 (UTC): replanteo `152`, API y web `1ca8a09d7459`.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/152_baneo_ip_sin_ficha_web.sql` e inversa | `admin_ban_ip_add_loose` |
| `pruebas/prueba_152.sql` | Prueba de la base (con `rollback`) |
| `web/backend/src/routes/admin-ban-ips.ts`, `schemas/admin.ts` (`LooseBanIpBody`) y su prueba | `POST /api/v1/admin/ban-ips` |
| `web/frontend/src/features/admin/bans/components/RangeExceptions.tsx` | Nuevo: "a quién alcanza" con **Exceptuar**, sacado de `BanIpsSection.tsx`, que ahora lo usa |
| `ServerIpBansPanel.tsx` y su prueba, `api/queries.ts` (`useAddLooseBanIp`), `pages/AdminBansPage.tsx` (la pestaña pasa a **IPs sin ficha**), `src/api/schema.d.ts` | Formulario |
| `docs/manual/moderador/banear-jugador.md`, `docs/manual/admin/comandos-en-el-servidor.md` | Manual |

Commit `1ca8a09d`.

## Pruebas

- Base: `prueba_152.sql` contra producción con `rollback` (normaliza el rango, frena, respeta la excepción, se lista, rechaza más de 30 días, sin motivo, `/8` y a quien no es admin).
- API 708 y web 904 pruebas, typecheck y lint. La de la web cubre el flujo: revisar, excepciones marcadas para los no baneados, botón apagado sin motivo y lo que se manda.

## Despliegue (2026-11-27)

1. `152` como `supabase_admin`.
2. Sin salas ni nadie en la cola: `desplegar.sh api` y `desplegar.sh web` (`/api/health` con `1ca8a09d7459`).

## Cómo revertir

1. Base: la inversa del `152` (los ya puestos quedan y se levantan desde la pestaña).
2. API y web: la versión anterior con `desplegar.sh`.
