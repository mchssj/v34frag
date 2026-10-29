# Notificaciones programadas (segunda etapa): guía de implementación

## Estado

Implementado y probado en local el 2026-10-29, en la rama `feat/frontend-fase-1`. **Sin desplegar**: ni la `35` en la base ni el timer en el VPS. El frontend (textos de los seis tipos y la campana del organizador) va en un requerimiento aparte.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/35_notificaciones_programadas.sql` | Nuevo: tipos nuevos en `notification_category`, `notification_sent` y `notify_due()` |
| `supabase/replanteo/README.md` | Fila de la `35` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/35_notificaciones_programadas.sql` | Nuevo: la inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/35_notificaciones_programadas.sql` | Nuevo: 28 pruebas SQL |
| `web/backend/src/jobs/notify-due.ts` | Nuevo: `runNotifyDue` y `summary` |
| `web/backend/scripts/notify-tick.mts` | Nuevo: el script del timer |
| `web/backend/package.json` | Script `notify:tick` |
| `web/backend/scripts/build.mjs` y `build-check.mjs` | `notify-tick.mjs` en el build y en su chequeo |
| `web/backend/test/unit/notify-due.test.ts` y `test/integration/notify-due.test.ts` | Nuevos |
| `deploy/vps/cmleague-notify.service` y `.timer` | Nuevos, copia de `cmleague-season.*` |
| `deploy/vps/preparar.sh`, `desplegar.sh`, `README.md` y `season.env.example` | Instalan, suben y nombran lo nuevo |
| `docs/frontend/contrato/notificaciones.md` y `README.md` | Los seis tipos y la fila de novedades |
| `docs/PENDIENTES.md` y `docs/bitacora/README.md` | Estado |

## Despliegue (pendiente)

1. **Base (en el corte, después de la `28`, la `32` y la `33`):** aplicar `supabase/replanteo/35_notificaciones_programadas.sql`.
2. **VPS, cuando la base de producción tenga la `35`:**
   1. `deploy/vps/desplegar.sh api` (sube `notify-tick.mjs` con la API).
   2. Copiar las unidades e instalarlas:
      ```bash
      sudo install -m 644 cmleague-notify.service cmleague-notify.timer /etc/systemd/system/
      sudo systemctl daemon-reload
      sudo systemctl enable --now cmleague-notify.timer
      ```
   3. Comprobar: `systemctl list-timers 'cmleague*'` y, después de 10 minutos, `sudo journalctl -u cmleague-notify -n 5` sin errores.

Mientras la base del VPS (staging) no tenga la `35`, el servicio fallaría cada 10 minutos con `PGRST202` (no existe `notify_due`): por eso el timer no se prende antes.

## Pruebas

### Base (`pruebas/35_notificaciones_programadas.sql`)

28 pruebas en verde contra la Supabase local con la copia de producción (todo con rollback): permisos, cada tipo dentro y fuera de su ventana, los destinatarios, preferencias, una segunda corrida sin repetir, reprogramar, prender la categoría después y la limpieza a los 60 días. Además: una segunda aplicación de la `35` aborta, y la inversa deja la estructura idéntica a la de antes (`estructura.sql`).

### Backend

- Unitarias: 377 en verde (3 nuevas de `notify-due`).
- Integración: `notify-due`, `notifications` y `vip` en verde (12). `notify-due` crea dos equipos con una partida en 30 minutos y un VIP que vence en 2 días, corre `notify_due` dos veces y comprueba por `GET /api/v1/notifications` que cada aviso llega una sola vez; y que un usuario no puede llamar a `notify_due`.
- `pnpm typecheck`, `pnpm build` y `pnpm build:check` (que ahora corre también `notify-tick.mjs` sin variables) en verde.

No se probó en el VPS.

## En qué se apartó del plan

- **Rama:** el plan decía trabajar en `feat/backend-api-fase-1` y mezclar. Esa rama no tiene `deploy/vps/` ni la `34`, que se commitearon directo en `feat/frontend-fase-1`, así que se hizo en `feat/frontend-fase-1`.
- **Índices:** no hizo falta ninguno nuevo. `matches` ya tiene `(kind, status)` y `starts_at`, y `pcw_posts` es chica.
- **`data` de `season_ending`:** usa el objeto `season` (`id`, `number`, `name`), como `season_closed` y `season_started`.

## Cómo revertir

- Base: `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/35_notificaciones_programadas.sql` (borra los avisos programados, `notify_due` y `notification_sent`, y deja `notification_category` como en la `33`).
- VPS: `sudo systemctl disable --now cmleague-notify.timer` y borrar las dos unidades de `/etc/systemd/system/`.
- Código: revertir el commit.
