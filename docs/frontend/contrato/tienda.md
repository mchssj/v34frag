# Contrato para el frontend: Tienda, puntos y cosméticos

> Parte del contrato para el frontend. Índice, estado y novedades: [`README.md`](README.md). Las decisiones de todos los módulos están en [`decisiones.md`](decisiones.md).

## 13. Tienda (disponible en local desde el 2026-11-12, replanteo `113`)

Bitácora: [`2026-11-11-tienda-de-puntos`](../../bitacora/2026-11-11-tienda-de-puntos/). Los archivos de los cosméticos están en el frontend, en `public/cosmetics/` (`catalogo.json`, `marcos/`, `fondos/`, `stickers/`, `insignias/`), y los temas y efectos de nombre son clases de `cosmeticos.css`.

### Reglas

- **Dos monedas:**
  - **Puntos:** 20 por mix y 10 más si gana su equipo (valores con los que sale; los cambia el admin). Cuentan los mixes y los mapas del matchmaking terminados que le dieron ELO; no cuentan los interrumpidos ni aquellos en los que abandonó. Cuentan desde el primer mix.
  - **Monedas VIP:** 20 y 10 más, solo en los mixes jugados siendo VIP ese día. Los valores los cambia el admin.
- **Se calculan, no se anotan:** si un admin borra un mix o cambia los valores, el saldo cambia solo. El saldo puede quedar negativo; lo comprado no se pierde, pero no se compra hasta volver a positivo.
- **Lo VIP** se compra con monedas VIP siendo VIP y se usa mientras la cuenta sea VIP. Si el VIP vence, el saldo y lo comprado quedan **congelados** (`vip_coins.frozen`, `usable: false`). El **Marco Oro VIP** (`vip_reward`) viene con el VIP: no se compra ni se regala.
- **Sin ficha vinculada** no se suma ni se compra (`has_player: false`): mostrar "Vinculá tu cuenta con `!claim`".
- **Ofertas de la semana:** `weekly_count` artículos con `weekly_discount` % menos; cambian solas el lunes a las 00:00 de Argentina (`weekly_ends`).
- **Equipado:** uno por tipo (`frame`, `avatar`, `background`, `theme`, `name`) y hasta 3 stickers. En `avatar` y `background`, una subida propia va como `custom:<id>`.
- **Lo propio** (desde el 2026-11-14, [`2026-11-14-inventario-de-lo-propio`](../../bitacora/2026-11-14-inventario-de-lo-propio/)): cada subida queda guardada, hasta `max.avatar` avatares y `max.background` fondos de miniperfil (5 y 5). Se paga al subir; ponerse una guardada (`PUT /me/cosmetics` con `custom:<id>`) no cuesta. El `background` se llama **fondo de miniperfil** en la web y es vertical, 1:2 (la tarjeta del grupo en Jugar).
- **Avatares** (`avatar`): reemplazan la foto. Los de la tienda son SVG (`file`), algunos VIP y animados; los propios, un `.webm` (`url`) con su imagen fija (`poster_url`). Animados en la ficha, la vista previa y el miniperfil; quietos en las filas (ranking, sala), y animados al pasar el mouse. En las filas no se muestra el marco.
- **Subir imágenes:** la API rechaza PNG y WebP animados (`400 INVALID_FILE`, "La imagen no puede ser animada.") en el avatar, la portada, los logos, los banners y las fotos de mapas.

### Endpoints

| Endpoint | Notas |
|---|---|
| `GET /api/v1/shop/items` | Catálogo con el precio de hoy. Listado estándar: `sort` `sort` (destacados), `price` o `name`; `per` hasta 400. Filtros `kind`, `collection`, `vip`, `weekly`, `owned` (necesita sesión) y `q`. Sin sesión: `owned`, `usable` y `equipped` en `false`. Suma `weekly_ends` al sobre |
| `GET /api/v1/shop/config` | Cuánto se gana (`per_mix`, `per_win`, `vip_multiplier`, `vip_per_mix`, `vip_per_win`, `weekly_count`, `weekly_discount`). Sin sesión: para el "cómo se ganan" |
| `POST /api/v1/shop/items/{id}/buy` | Compra. `{ item, price_paid, currency, balance }`. Sin saldo ("Te faltan N puntos"), ya lo tiene, no se vende, lo VIP sin VIP, el premio VIP o sin ficha: `400 BUSINESS_RULE` con el mensaje para mostrar |
| `GET /api/v1/me/points` | `{ vip, has_player, points: { earned, granted, spent, balance, mixes }, vip_coins: { …, frozen } }` |
| `GET /api/v1/me/points/history` | `currency` (`points` o `vip`), `page` y `per`. Movimientos `{ kind: mix \| mm \| grant \| purchase, at, amount, label, ref }`, lo más nuevo primero. `ref`: la partida o el artículo |
| `GET` y `PUT /api/v1/me/cosmetics` | Ids de lo equipado. `PUT` con lo que cambia; `null` lo saca. En `avatar` y `background`, `custom:<id>` pone una subida propia guardada, sin pagar. Algo que no tiene, del tipo equivocado, lo animado sin VIP o más de 3 stickers: `400` |
| `GET /api/v1/me/custom` | Lo propio: `avatar` y `background` son listas de subidas (`id`, `animated`, `url`, `poster_url`, `price`, `currency`, `created_at`, `equipped`, `visible`), lo más nuevo primero; `max`, `prices` y `animated_available` |
| `POST /api/v1/me/custom/{kind}` | Subir (`multipart/form-data`). Cobra, la guarda y se la pone; devuelve lo mismo que `GET` más `id`, `price_paid`, `currency` y `balance`. Con el tope lleno: `400 BUSINESS_RULE` («Llegaste a 5 avatares guardados: borra uno para subir otro»), sin cobrar. El fondo de miniperfil fijo: 1:2, entre 240×480 y 960×1920 (la web lo recorta a 480×960) |
| `DELETE /api/v1/me/custom/items/{cid}` | Borra una subida guardada, puesta o no. No devuelve lo pagado. `404` si no es suya |
| `POST` y `DELETE /api/v1/me/cover` | Portada: `multipart/form-data`, campo `file`. JPEG, PNG o WebP de hasta 1 MB, **4:1** entre 800×200 y 2400×600: recortar antes de subir. `{ cover_url }` |
| `GET /api/v1/cosmetics?players=a,b,c` | Lo equipado de hasta 100 fichas, para las listas que no lo traen: la sala del matchmaking, los amigos, el grupo. Sin sesión. Las fichas sin nada equipado no vienen |

**En los jugadores:**
- `PlayerSummary` (Jugadores), `RankingPlayer.player` y `ComparePlayer.player` suman `cosmetics: { frame, avatar, name } | null`.
- `PlayerDetail` (la ficha) trae `cosmetics` completo (`frame`, `avatar`, `name`, `background`, `theme`, `stickers`) y `cover_url`. Un perfil privado oculta la portada, igual que los datos personales.

Cada cosmético viene resuelto como `Cosmetic`: `{ id, kind, name, file, css_class, animated, vip_only }`. `file` es relativo a `/cosmetics/`. Nunca trae lo que la cuenta ya no puede usar.

### Admin

| Endpoint | Notas |
|---|---|
| `GET /api/v1/admin/shop/items` | Todo el catálogo, también lo inactivo, con `owners` (cuántas cuentas lo tienen). Filtros `kind`, `collection`, `vip`, `active` y `q` (nombre o id) |
| `PATCH /api/v1/admin/shop/items/{id}` | `price` (lo de todos) y `vip_price` (lo VIP; `null` lo saca de la venta), `active`, `sort`, `name` y `description`. Inactivo: no se ve en la tienda, pero quien lo tiene lo sigue usando |
| `GET` y `PUT /api/v1/admin/points/config` | Los valores. **Cambian el saldo de todos**: avisarlo antes de guardar. También los precios de lo propio y los topes `custom_max_avatar` y `custom_max_background` (1 a 50) |
| `GET /api/v1/admin/users/{id}/custom` | Todo lo que guardó la cuenta (`avatar` y `background`, listas) |
| `POST /api/v1/admin/users/{id}/custom/items/{cid}/clear` | `{ reason }`: saca esa subida (puesta o no), con aviso (`custom_removed`). Las demás siguen. `204` |
| `GET /api/v1/admin/points/accounts` | Cuentas con saldo, monedas, artículos y portada. `sort` `balance`, `vip_balance`, `mixes` o `alias`; `q` y `vip` |
| `GET /api/v1/admin/users/{id}/points` y `…/points/history` | Lo mismo que `/me/points` de esa cuenta |
| `POST /api/v1/admin/users/{id}/points` | `{ currency, amount, reason }`: suma o resta, con aviso a la cuenta (`points_granted`) |
| `GET` y `POST /api/v1/admin/users/{id}/items` | Inventario; regalar `{ item, note }` (también lo VIP o algo sin precio), con aviso (`item_granted`) |
| `POST /api/v1/admin/users/{id}/items/{item}/revoke` | `{ reason }`. Lo saca del inventario y de lo equipado; **no devuelve lo pagado** (queda un descuento "Compra quitada: …" en el historial). Aviso `item_revoked`. `204` |
| `POST /api/v1/admin/users/{id}/cover/clear` | `{ reason }`: quita la portada, con aviso (`cover_removed`) |

### Avisos nuevos (categoría `account`)

| Tipo | `data` | Texto sugerido |
|---|---|---|
| `points_granted` | `amount`, `currency`, `reason` | "Un admin te sumó 500 puntos: premio del torneo" (o "te restó", si es negativo; "monedas VIP" si `currency` es `vip`) |
| `item_granted` | `item`, `name`, `kind` | "Te regalaron *Mira* para tu perfil" |
| `item_revoked` | `item`, `name`, `reason` | "Un admin te quitó *Mira*: motivo" |
| `cover_removed` | `reason` | "Un admin quitó tu portada: motivo" |
