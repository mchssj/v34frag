# Aviso de la cola del matchmaking en Discord: guía de implementación

## Estado

**En staging desde el 2026-11-02**, con commit. **Falta el mensaje de prueba en #avisos**: Daniel pidió que se le avise antes de mandarlo.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/57_mm_aviso_cola.sql` | Nuevo: `mm_queue_pings`, `mm_queue_ping_next`, `mm_queue_ping_status`, `mm_queue_ping`, `mm_queue_ping_cancel` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/57_mm_aviso_cola.sql` | Nueva |
| `web/backend/src/routes/mm.ts` | `queuePingText` y `GET`/`POST /api/v1/mm/queue/ping` |
| `web/backend/src/env.ts` | `DISCORD_QUEUE_WEBHOOK_URL` y `DISCORD_QUEUE_ROLE_ID` (opcionales) |
| `web/backend/src/lib/errors.ts` | `V5701` → 409 `CONFLICT` con `next_at` |
| `web/backend/test/unit/mm-queue-ping.test.ts` | Nuevo: 5 pruebas (webhook simulado) |
| `web/frontend/src/features/matchmaking/PlayBar.tsx` | Botón "Avisar en Discord" en la barra de "Buscando" |
| `web/frontend/src/features/matchmaking/{source,demo,types}.ts` | `queuePingStatus` y `queuePing` en la fuente de datos y en la demo |
| `web/frontend/src/features/matchmaking/PlayPage.test.tsx` | Una prueba nueva |

Commits: `37cd005f` en `feat/mm-claim-en-sala` y `9cc0b4d0` en `feat/frontend-fase-1`.

## Despliegue en staging (hecho el 2026-11-02)

1. **Base:** `57` aplicada en `edaljnirzvisiaathitt` sin errores. Verificado: la tabla existe, `mm_queue_ping` es de `authenticated` y no de `anon`.
2. **Entorno:** las dos variables agregadas a `/etc/cmleague/api.env` con el usuario `ubuntu` (el `deploy` no lo puede leer), pasadas por la entrada estándar para que el webhook no quede en ningún comando. Respaldo: `/etc/cmleague/api.env.bak_antes_discord`.
3. **API `51b2127f7777`:** rama temporal con `feat/mm-claim-en-sala` (`7ec0a27a`) y `feat/backend-api-fase-1` (`240e2694`), armada en una carpeta aparte y borrada después. 425 pruebas. Arrancó con las variables nuevas (se validan al iniciar). `GET /api/v1/mm/queue/ping` sin sesión: 401.
4. **Web `21dc2fb36f7e`:** desde una carpeta limpia de `feat/frontend-fase-1`, porque en la carpeta de trabajo había otro trabajo sin commit (el manual de usuario). 499 pruebas. El bundle tiene "Avisar en Discord".

## Pruebas

- **Base:** `bash pruebas/correr_local.sh "E:/Css V34 Web/v34frag-mmclaim"` → 12 comprobaciones y la inversa, en una transacción que se deshace.
- **API:** 5 pruebas unitarias (publica solo con el rol, Discord falla, 409 con la hora, 501 sin webhook, el texto sin markdown ni menciones).
- **Web:** la prueba de Jugar avisa y después muestra la espera.

## Falta

1. **Mensaje de prueba en #avisos**, avisándole antes a Daniel. Menciona al rol `@player` de verdad.
2. Con el aviso andando, regenerar el webhook en Discord (se pegó en el chat) y actualizarlo en el `.env` y en `/etc/cmleague/api.env`.
3. Producción, con el corte.

## Cómo revertir

- Base: la inversa de la `57`.
- Entorno: volver a `/etc/cmleague/api.env.bak_antes_discord` y reiniciar `cmleague-api` (sin el webhook, la ruta responde 501).
