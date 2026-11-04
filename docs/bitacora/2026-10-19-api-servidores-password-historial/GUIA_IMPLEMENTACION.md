# Estado de los servidores, cambio de contraseña y mis partidas: guía de implementación

## Estado

Hecho y probado en local el 2026-10-19, en la rama `feat/backend-api-fase-1`. **Sin desplegar:** sale con el backend en el corte (la migración `19` va después de la `18`).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/19_listado_servidor.sql` | Nuevo: `match_list` suma `server_id` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/19_listado_servidor.sql` | Nuevo: la inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/19_listado_servidor.sql` | Nuevo: 4 comprobaciones |
| `supabase/replanteo/README.md` | Fila de la `19` |
| `web/backend/src/lib/a2s.ts` | Nuevo |
| `web/backend/src/lib/udp-node.ts` | Nuevo |
| `web/backend/src/services/servers.ts` | Nuevo |
| `web/backend/src/routes/servers.ts` | Nuevo |
| `web/backend/src/app.ts`, `src/node.ts`, `src/lib/types.ts` | Opción `udp` de la app; `node.ts` pasa el envío de Node |
| `web/backend/src/routes/auth.ts`, `src/schemas/auth.ts` | `POST /api/v1/me/password` |
| `web/backend/src/lib/ratelimit.ts`, `wrangler.toml` | Regla `password` (`RL_PASSWORD`) y clave propia en `rateLimit` |
| `web/backend/src/lib/errors.ts`, `src/schemas/common.ts` | Códigos `WRONG_PASSWORD`, `SAME_PASSWORD` y `NOT_AVAILABLE`; respuesta `501` |
| `web/backend/src/routes/players.ts` | `GET /api/v1/me/matches` y `playerMatches` compartida |
| `web/backend/src/routes/matches.ts`, `src/schemas/matches.ts` | Filtro `server` |
| `web/backend/src/schemas/profile.ts` | Textos de `player` y `player.steam_id` en Mi perfil |
| `web/backend/src/db/types.ts` | Regenerado |
| `web/backend/tsconfig.json` | Excluye `src/lib/udp-node.ts` (solo Node) |
| `web/backend/scripts/a2s-probe.mts` | Nuevo: consulta A2S a mano |
| `web/backend/test/unit/servers-status.test.ts` | Nuevo |
| `web/backend/test/unit/auth-routes.test.ts`, `test/integration/auth.test.ts`, `players-teams.test.ts`, `servers.test.ts` | Pruebas nuevas |
| `docs/frontend/contract.md` | Ahora es un aviso con la tabla de secciones a archivos |
| `docs/frontend/contrato/` | Nuevo: el contrato por módulos, con lo nuevo de este plan |
| `docs/frontend/2026-10-14-decisiones-para-frontend.md` | Enlace al contrato nuevo |
| `docs/MODELO_DATOS.md` | Varios SteamID y el resumen de las migraciones `11` a `19` |
| `docs/PENDIENTES.md`, `docs/bitacora/README.md` | Estado |

## Despliegue

Nada todavía. En el corte:
1. **Base:** la migración `19` después de la `18`.
2. **API en el VPS:** arrancar con `node.ts`, que es lo que pasa el envío UDP. El VPS tiene que poder **salir** por UDP hacia los puertos de los servidores de juego; no hace falta abrir nada de entrada.
3. **Workers (`preview`):** si se vuelve a desplegar ahí, crear el binding `RL_PASSWORD`, que ya está en `wrangler.toml`. El estado de los servidores responde `501`.
4. **Cargar el `connect_address`** de cada servidor en el admin, con el formato `host:puerto`. Sin él, el servidor aparece apagado.

## Pruebas

**Base:**
- `pruebas/19_listado_servidor.sql`: 4 comprobaciones, todas bien.
- `correr.sh` con las 19 migraciones, sus inversas y su segunda aplicación: "Todo ok".

**API, unitarias** (268 en total, 18 archivos):
- **A2S:**
  - Lee la respuesta real grabada del servidor local (v34).
  - Rechaza respuestas que no son S2A_INFO o vienen cortadas.
  - Reenvía el desafío por el mismo socket.
  - Lee direcciones.
- **Estado de los servidores:**
  - Cada servidor y los totales; uno sin respuesta y otro sin dirección.
  - Caché de 20 s y `304`.
  - `501` sin UDP.
  - Un error de la base no se guarda en la caché.
  - Los jugadores nunca dan negativo.
- **UDP de Node** contra dos sockets locales:
  - Uno que pide desafío atado al puerto, como el servidor real.
  - Otro que nunca responde (tiempo máximo).
- **Contraseña:**
  - Usa la sesión nueva para cambiarla y para cerrar las otras.
  - Pide el correo a Auth si el token no lo trae.
  - `same_password` y `weak_password` de Auth.
  - `500` sin cerrar sesiones.
  - Si falla el cierre de las otras sesiones, responde `200` y lo registra.

**API, integración** contra la Supabase local (86 en total):
- **Contraseña:**
  - Con la vieja ya no entra; con la nueva, sí.
  - El `refresh_token` de antes y el de otra sesión ya no sirven; el nuevo, sí.
  - `WRONG_PASSWORD`, `SAME_PASSWORD`, `VALIDATION_ERROR` y `401` no la cambian.
  - `429` al sexto intento.
- **Mis partidas:**
  - Con ficha, con un filtro y sin sesión.
  - Una cuenta sin ficha da la lista vacía.
- **Filtro `server`:** solo las partidas de ese servidor; `400` con un id inválido.
- **Estado de los servidores con la base local:**
  - Aparece el activo, con lo que respondió.
  - No aparece el revocado.

Sin errores de tipos en los dos `tsconfig`. Cobertura total: 94 %.

**Contra servidores reales:**

| Servidor | Resultado |
|---|---|
| Servidor local de pruebas (`srcds`, `csstv_reporter` apartado) | Responde sin desafío: de_dust2, 2 bots de 20. Su respuesta quedó como dato de las pruebas unitarias |
| Servidor real (`45.235.98.57:27062`, del panel) | **Pide desafío** y lo ata al puerto de origen. La primera versión abría un socket por envío y fallaba; se rehízo con un solo socket por conversación. Después: "v34frag #1 By ExtremeHost", de_mirage_rc1, 3 de 12 con 1 bot, es decir **2 jugadores** |
| RBK | **No se consultó:** ni el `.env` ni la documentación tienen su dirección de juego (solo el acceso SFTP). Se verifica cuando se cargue su `connect_address` en el admin, con `scripts/a2s-probe.mts` |

El servidor local quedó como estaba: plugin md5 `5ca8c752…` y cola vacía.

## En qué se apartó del plan

- **El envío UDP es una conversación** (`UdpExchange` abre el socket, corre los envíos y lo cierra), no un envío suelto. El plan suponía que un servidor v34 no pediría desafío; el real lo pide y lo ata al puerto de origen.
- **El estado de los servidores no se consultó contra RBK** porque no está su dirección.
- **`contract.md` no se borró:** quedó como aviso con la tabla de secciones a archivos, para que las referencias de la bitácora sigan sirviendo.

## Cómo revertir

- **Antes del corte:** revertir el commit.
- **Después del corte:**
  - La `19` con `reversas/19_listado_servidor.sql`.
  - Los endpoints se van con el backend anterior. No hay datos nuevos que limpiar: las contraseñas cambiadas siguen cambiadas.
