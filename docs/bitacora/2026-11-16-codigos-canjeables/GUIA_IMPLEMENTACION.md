# Códigos canjeables para sorteos: guía de implementación

## Estado

Hecho y probado en local el 2026-11-16 y el 2026-11-17: la base, la API, la web, el manual y los legales. Daniel empezó a probarlo en el navegador el 2026-11-17 y de ahí salió el interruptor de lo VIP de un código. **Sin commit, sin terminar la prueba en el navegador y sin desplegar.** No toca los servidores de juego.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/126_codigos_canjeables.sql` | Nuevo: tablas, funciones, cambios en la tienda y el VIP (`can_use_item` reescrita, `points_config.code_vip_free` y `set_points_config`), avisos y permisos |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/126_codigos_canjeables.sql` | Nueva: inversa |
| `docs/bitacora/2026-11-16-codigos-canjeables/pruebas/probar_126.sh`, `probar_126.sql` | Nuevos: prueba de la `126` con rollback (12 bloques) |
| `supabase/replanteo/README.md` | Fila de la `126` |
| `web/backend/src/routes/codes.ts`, `src/schemas/codes.ts` | Nuevos: las 8 rutas y sus esquemas |
| `web/backend/src/app.ts` | Registra `codes` |
| `web/backend/src/lib/errors.ts` | Códigos de error `CODE_*` |
| `web/backend/src/lib/ratelimit.ts`, `wrangler.toml` | Regla `redeem` y binding `RL_REDEEM` (namespace `1009`) |
| `web/backend/src/routes/shop.ts`, `src/schemas/shop.ts` | `expires_at` en el catálogo y el inventario, origen `code`, `kind = 'code'` en el historial; lo vencido no cuenta como propio; `code_vip_free` en la configuración y en el `usable` del catálogo |
| `web/backend/test/unit/shop-routes.test.ts` | El catálogo con lo VIP de un código, con el interruptor encendido y apagado |
| `web/backend/src/db/types.ts` | Regenerado desde la base local (solo cambia lo de la `126`) |
| `web/backend/test/unit/codes-routes.test.ts`, `test/integration/codes.test.ts` | Nuevos |
| `web/frontend/src/api/schema.d.ts` | Regenerado desde el OpenAPI de la API |
| `web/frontend/src/api/errors.ts` | Códigos `CODE_*` y sus mensajes |
| `web/frontend/src/features/shop/codes.ts`, `codeFormat.ts` | Nuevos: consultas y mutaciones; formato y textos |
| `web/frontend/src/features/shop/RedeemDialog.tsx` | Nuevo: ventana de canje y tarjeta de Mi perfil |
| `web/frontend/src/features/shop/AdminCodesSection.tsx` | Nuevo: Códigos y sorteos en Administración › Tienda |
| `web/frontend/src/features/shop/*.test.ts(x)` | Nuevos: `codeFormat`, `RedeemDialog` y `AdminCodesSection` |
| `web/frontend/src/features/shop/ShopPage.tsx` | Botón **Canjear código**, vencimiento en las tarjetas, "Código" en el Historial y "Congelado" según `usable` |
| `web/frontend/src/features/shop/AdminShopPage.tsx` | Suma la sección de códigos y el interruptor **Lo VIP de un código se usa sin ser VIP** |
| `web/frontend/src/routes/_app/shop.tsx` | `?canjear=true` abre la ventana |
| `web/frontend/src/features/profile/pages/ProfileSection.tsx` | Tarjeta "¿Ganaste un sorteo?" |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `PrivacyPage.tsx`, `terms/terminos.html`, `terms/privacidad.html` | "Sorteos y códigos", con "En preparación" |
| `docs/manual/jugador/tienda-y-cosmeticos.md`, `docs/manual/admin/tienda-y-puntos.md` | Secciones nuevas |
| `docs/PENDIENTES.md`, `docs/bitacora/README.md` | Estado |

Los cuatro archivos legales ya tenían cambios sin commitear de [`2026-11-13-nombre-de-la-ficha-en-mix`](../2026-11-13-nombre-de-la-ficha-en-mix/). Los de este requerimiento se sumaron sin tocar esos.

## Despliegue (pendiente)

Orden obligatorio: la base antes que la API y la API antes que la web.

1. **Probarlo en el navegador** con la API local (`web/backend`: `pnpm dev:node`; `web/frontend`: `pnpm dev`) y una cuenta admin vinculada a una ficha:
   - crear un código de cada premio;
   - canjearlo con otra cuenta;
   - ver el vencimiento en la tarjeta;
   - revocar y revertir;
   - provocar el bloqueo con 5 códigos inexistentes.
2. **Commit** en `main`. Los legales ajenos se dejan afuera o se commitean aparte.
3. **Respaldo** de la base en R2: `sudo cmleague-respaldar` en el VPS.
4. **Base**, por el túnel (OpenSSH de Windows), sin mixes en curso. No hace falta, pero la `126` no toca partidas.
   - Chequeo de solo lectura: está la `125` (`mm_active_lobby` mira `replaced_by`), no existe `redeem_codes`, y existen `user_items_source_check` y `vip_memberships_source_check`.
   - Opcional: la prueba completa con rollback, `probar_126.sql` con las rutas de la `126` y de la inversa. Deja todo como estaba.
   - `psql -v ON_ERROR_STOP=1 -f supabase/replanteo/126_codigos_canjeables.sql`. El archivo tiene que tener saltos LF (ver "Incidentes"). Ya trae `notify pgrst`.
   - Después: `select notification_category('code_redeemed')` da `account`, `select code_vip_free from points_config` da `true`, y `admin_codes()` con un admin responde.
5. **API:** sin nadie en la cola del matchmaking ni salas abiertas. `BUILD_CHECK_PORT=28787 deploy/vps/desplegar.sh api`. El build valida el manual. Comprobar que `/api/openapi.json` publica `/api/v1/me/redeem` y que la ruta sin sesión da 401.
6. **Legales:** sacar la marca "En preparación" de "Sorteos y códigos" y de las dos filas de plazos, en la web y en los `.html`, y commitearlo.
7. **Web:** `deploy/vps/desplegar.sh web`. Publicar `terms/terminos.html` y `terms/privacidad.html`.
8. **En producción:** un código de 1 uso para una cuenta de prueba, canjearlo y revertirlo.
9. Publicar `CHANGELOG_DISCORD.txt` (2.9.54).

## Pruebas

### Base (Supabase local, copia de producción sin la `125`)

`pruebas/probar_126.sh`, en una transacción que se deshace: **13 de 13** (con el bloque 6b), con la `126` sin aplicar. Antes del 6b pasó 12 de 12 también con la `126` ya aplicada (en ese caso la prueba la revierte primero).

| Bloque | Qué prueba |
|---|---|
| 1 | Permisos: tablas sin acceso, internas sin ejecutar, `anon` no canjea, un jugador no crea códigos |
| 2 | Formato `CML-XXXX-XXXX-XXXX` y normalización |
| 3 | Artículo para siempre: 2 usos, una vez por cuenta, "ya lo canjeaste" antes que "agotado", sin ficha, baneado y "ya lo tienes" (no se gasta) |
| 4 | Temporal: se suman los días, vence, se saca de lo puesto, desde ahora si ya venció, y la compra y el regalo lo vuelven permanente |
| 5 | Puntos y monedas en `point_grants` y en el historial |
| 6 | VIP por días, encadenado, y no a quien es VIP de por vida |
| 6b | Lo VIP de un código: se usa sin VIP con `code_vip_free` encendido (también puesto, en `player_cosmetics_public`), se congela si se apaga, `set_points_config` solo acepta un booleano y solo un admin lo cambia, y lo regalado sigue la regla de siempre |
| 7 | Para una cuenta, vencido, sin empezar y revocado (los dos últimos cuentan como fallo) |
| 8 | 5 fallos en 15 minutos, 20 en 24 horas, borrado a los 30 días y las bloqueadas en la lista del admin |
| 9 | Personalizados, lotes de 100 y validaciones |
| 10 | Revertir puntos, VIP, artículo para siempre (se saca de lo puesto), temporal y lo ya comprado (no se toca) |
| 11 | Mis canjes y las listas del admin |
| 12 | La inversa deja la estructura idéntica (funciones, columnas, restricciones, políticas y permisos) |

La `126` quedó aplicada en la base local.

### API

- **Unitarias:** 677 de 677. `codes-routes` (PostgREST simulado) prueba:
  - los esquemas;
  - que el código va en el cuerpo y no en la URL;
  - cada error con su HTTP;
  - el 429 con `Retry-After`, y el tope por IP antes de llegar a la base;
  - 401 y 403;
  - lo que se pasa a cada función.
- **Integración** `codes` contra la base local: 6 de 6.
  - Crear y canjear puntos, con el historial; "ya lo canjeaste" y "agotado".
  - Artículo por 7 días en el catálogo y el inventario; al vencer, deja de ser suyo.
  - Para una cuenta, sin ficha y revocado.
  - La lista del admin, los canjes y revertir.
  - El bloqueo tras 5 fallos.
  - Un artículo VIP de un código: se usa sin VIP, se congela al apagar el interruptor desde `PUT /api/v1/admin/points/config` y vuelve al encenderlo.
- **Integración** `shop`: las mismas 7 de 8 que fallaban antes de la `126` (la base local tiene 20 y 10 puntos por mix y las pruebas esperan 10 y 5). Se comprobó revirtiendo la `126`: fallan igual.
- `tsc` sin errores. El manual valida sin errores (69 páginas), con el mismo chequeo del build.

### Web

- **Vitest:** 826 de 826 (824 en tres corridas seguidas antes del interruptor).
  - `codeFormat`: formato, textos, la espera y el CSV.
  - `RedeemDialog`: formato al escribir, el código en el cuerpo, el premio, el aviso de congelado de un artículo VIP según el interruptor, el error de la base, el bloqueo y "Tus canjes".
  - `AdminCodesSection`: lo que manda **Generar** y el código personalizado.
- `tsc -b`, lint y build sin errores (la advertencia del tamaño de los chunks ya estaba).
- **No se probó en el navegador.**

## En qué se apartó del plan

- **Lo VIP de un código se usa sin ser VIP (Daniel, 2026-11-17).** El plan seguía la regla de la tienda: lo VIP se usa siendo VIP. Probando con `daniloevtesting`, un sticker VIP ganado con un código quedó en el inventario sin poder ponerse. Daniel eligió que se pueda usar, y que se pueda apagar: `points_config.code_vip_free`, encendido por defecto. Se sumó a la `126`, que todavía no estaba en producción, en vez de abrir una `127`. Ver "Lo VIP de un código" en la documentación.

- **El canje no lanza errores.** El plan decía `raise exception` con `hint`, pero el rollback se llevaba el fallo recién anotado y los topes nunca contaban. `code_redeem` devuelve `{ok: false, error, message[, retry_after]}`, y la API lo pasa al código HTTP.
- **Errores en mayúsculas.** `CODE_INVALID` en vez de `code_invalid`, como los demás `error.code` de la API. El bloqueo de la base usa `RATE_LIMITED`, igual que el tope por IP.
- **Orden de las comprobaciones.** El plan ponía "agotado" antes que "ya lo canjeaste". Al revés: a quien ya canjeó un código de 1 uso le dice eso, no que se agotó (lo encontró la prueba de integración).
- **Sin `pgcrypto`.** Los códigos al azar salen de `gen_random_uuid()`: los 15 dígitos al azar de un UUID v4, que son 60 bits del generador fuerte de Postgres.
- **Personalizados.** El admin los escribe con letras, números y guiones (hasta 30 caracteres; de 8 a 24 después de normalizar). Al canjear, el jugador puede escribir espacios.
- **"Solo para una cuenta"** se crea de a un código y con 1 uso: más usos no sirven si solo una cuenta puede canjearlo.
- **Errores del admin.** "No existe ese canje" y "No existe ese código o ya estaba revocado" responden `400 BUSINESS_RULE`, no 404.
- **El vencimiento se ve en el catálogo.** El plan hablaba del inventario. La tienda de `main` muestra lo propio con el filtro **Lo mío** del catálogo, así que `GET /api/v1/shop/items` trae `expires_at`, y lo vencido sale como no propio (se puede comprar). El inventario del admin también lo trae.
- **`db/types.ts` regenerado.** Solo cambiaba lo de la `126`. Las llamadas nuevas siguen con `as never`, como en el resto.
- **El prototipo de Kyan no se trajo.** La pantalla real se hizo directo, como decía el plan.

## Incidentes durante las pruebas

- **Saltos de línea.** Las ediciones con Python dejaron varios archivos con CRLF. La `126` aplicada así metía `\r\n` en `notification_category`, `shop_buy` y `admin_item_grant`, y la inversa (LF) no encontraba el texto. Se pasaron a LF todos los archivos del requerimiento y la base local se limpió con una copia CRLF de la inversa. **Al aplicar en producción, el archivo tiene que estar en LF.**
- **`redeem_blocked_until` daba una fecha pasada en vez de `null`**, y la cuenta seguía bloqueada para siempre. Lo encontró el bloque 8 y se corrigió.
- **"1 códigos"** en el resumen del admin. Lo encontró la prueba del componente.
- **La prueba del bloqueo en la web fallaba a veces** con toda la suite en paralelo: tardaba más del segundo de espera por defecto. Se le dieron 4 segundos.
- Para levantar la base local se abrió Docker Desktop.
- **Datos de prueba borrados en local (2026-11-17).** Para pasar la base local de la `126` vieja a la nueva se corrió la inversa, que borra los códigos, los canjes y los intentos. Se perdieron los códigos que Daniel había creado probando en el navegador. El ACE de `daniloevtesting` quedó como regalo y se le devolvió a mano el origen `code`. No se avisó antes: con datos de prueba de otra persona en la base, hay que avisar antes de revertir.

## Cómo revertir

1. **Web y API:** volver a desplegar el commit anterior (`deploy/vps/desplegar.sh web` y `api` desde ese commit).
2. **Base:** `psql -v ON_ERROR_STOP=1 -f docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/126_codigos_canjeables.sql`.
   - Borra los códigos, los canjes, los intentos y los avisos `code_redeemed` y `code_reverted`.
   - Los puntos y las monedas quedan como regalos, el VIP pasa a `manual` con la misma fecha de fin, y lo que se dio para siempre queda como regalo.
   - **Lo temporal se borra.**
3. **Legales:** sacar "Sorteos y códigos" y las dos filas de plazos de la web y los `.html`.
