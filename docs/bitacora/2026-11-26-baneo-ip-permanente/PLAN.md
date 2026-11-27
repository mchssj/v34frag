# Plan: baneo permanente de una IP o rango desde la web

> Planeación original. Aprobado por Daniel el 2026-11-26 ("también debemos dar la opción de banear permanente"; alcance: "en los dos").

Hasta ahora, desde la web una IP o rango se banea como mucho por 30 días, esté atado a una ficha ([`2026-11-26-baneo-por-ip`](../2026-11-26-baneo-por-ip/)) o no ([`2026-11-26-baneo-ip-sin-ficha`](../2026-11-26-baneo-ip-sin-ficha/)). En el juego, `!banip <ip> 0` ya es permanente.

## Decisiones

| Tema | Decisión |
|---|---|
| Sin ficha (**Banear IP o rango**) | Suma **Permanente** a 1 hora, 1 día, 7 días y 30 días |
| Atada a una ficha (**IPs y rangos**) | Al banear eliges **30 días** o **lo mismo que el baneo**: si el baneo es permanente, **Permanente**; si vence en una fecha, hasta esa fecha. Si el baneo vence antes de 30 días, no hay que elegir |
| Por defecto | 30 días en los dos (las IPs cambian de dueño y se comparten) |
| Quién | Solo admins, como todo lo de IPs |
| Servidores | Sin cambios: la copia local ya entiende "sin vencimiento" (`!banip … 0`) |

## Cambios

1. **Base (replanteo `153`):** `admin_ban_ip_add` suma `p_full` (hasta que venza el baneo); `admin_ban_ip_add_loose` acepta `0` minutos = permanente; `admin_ban_ips` devuelve `null` en vez de `infinity`.
2. **API:** `full` en `POST /api/v1/admin/bans/{id}/ip` y `minutes: 0` en `POST /api/v1/admin/ban-ips`; `expires_at` puede ser `null`.
3. **Web:** la elección en los dos formularios y "permanente" en la lista.
4. **Manual** (`moderador/banear-jugador.md`) y **`/terminos`** (web y `terms/terminos.html`: "hasta 30 días" pasa a "por un tiempo o de forma permanente").
