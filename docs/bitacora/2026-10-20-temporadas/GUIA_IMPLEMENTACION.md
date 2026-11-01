# Temporadas: guía de implementación

## Estado

Hecho el 2026-10-21, **solo en local y sin desplegar**. Las pruebas SQL, las unitarias y las de integración pasan contra la Supabase local. Sale con el corte. El cierre automático necesita el VPS; mientras tanto se cierra con el botón del admin.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/24_temporadas.sql` | Nuevo: tablas, ranking, vistas, cierre, cron, vista previa; `elo_recompute_all` con los eventos de temporada; `elo_apply_match` recalcula si el mix es anterior a un cierre |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/24_temporadas.sql` | Nuevo: inversa |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/24_temporadas.sql` | Nuevo: 67 pruebas SQL |
| `supabase/replanteo/README.md` | Fila de la `24` |
| `web/backend/src/routes/seasons.ts` | Nuevo: rutas públicas y de admin |
| `web/backend/src/schemas/seasons.ts` | Nuevo: esquemas (los tramos se validan como en la base) |
| `web/backend/src/app.ts` | Registra las rutas |
| `web/backend/src/schemas/players.ts`, `routes/players.ts`, `routes/admin-players.ts` | Las medallas suman `season` y `rank` |
| `web/backend/src/db/types.ts` | Regenerado (`pnpm db:types`) |
| `web/backend/scripts/season-tick.mts`, `package.json` | Nuevo: el script del cron (`pnpm season:tick`) |
| `web/backend/src/env.ts` | Comentario de `SUPABASE_SERVICE_KEY`: la usa el cron |
| `web/backend/test/unit/seasons-routes.test.ts` | Nuevo: 9 pruebas unitarias |
| `web/backend/test/integration/seasons.test.ts` | Nuevo: 9 pruebas de integración |
| `docs/frontend/contrato/temporadas.md` | Nuevo: módulo del contrato (sección 8f) |
| `docs/frontend/contrato/README.md`, `api.md`, `jugadores.md`, `admin.md`, `decisiones.md` | Novedades, listados, medallas, `peak_elo` de la temporada y decisiones |
| `docs/bitacora/2026-10-16-despliegue-vps/PLAN.md` | El timer de systemd del cron, `season.env` y el build del script (el plan sigue sin aprobar) |
| `docs/bitacora/2026-10-20-temporadas/` | `PLAN.md` (respuestas de Daniel y aprobación, antes de implementar), esta guía, `DOCUMENTACION.md` y `CHANGELOG_DISCORD.txt` |

## Despliegue

**No se desplegó.** En el corte:

1. Aplicar `supabase/replanteo/24_temporadas.sql` después de la `23` (pide la `22` y la migración de mixes en vivo `20261017120000`).
2. Desplegar el backend con el resto de la web nueva.
3. Abrir la temporada 1 desde el admin (`POST /api/v1/admin/seasons`). Lo jugado antes queda como pretemporada.
4. Cuando exista el VPS: `season.env` con `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`, y el timer `v34frag-season.timer` cada 10 minutos (plan del VPS, sección 2, punto 8). Comprobar con `pnpm season:tick` a mano: sin salida y código 0 si la temporada no venció.
5. Publicar `CHANGELOG_DISCORD.txt` cuando la web nueva esté en línea.

No toca el plugin ni los servidores de juego (ni el nuestro ni RBK).

## Pruebas

### SQL (`pruebas/24_temporadas.sql`)

Corrido en la Supabase local el 2026-10-21: **67 de 67 OK**. Ciclo de la `24`: se aplica, pasan las pruebas, una segunda aplicación aborta, la inversa deja la estructura idéntica y se vuelve a aplicar.

Cubre:
- Los tramos (válidos e inválidos), la medalla de cada puesto, la fórmula del reinicio (2540 → 2055, 2200 → 2021, 2010 → 2002, 1990 igual; 0 % y 100 %) y la fecha de fin (06:00 de Argentina).
- Abrir (solo admin, una sola activa, valores por defecto), cambiar la activa y sus validaciones.
- El ranking en vivo por ficha, con un SteamID adicional.
- La vista previa sin cambiar nada.
- Cerrar: "estoy seguro", la foto, las medallas, el reinicio, el pico, la temporada siguiente y que no se cierre dos veces.
- **Un recálculo después del cierre da el mismo ELO**, también después de cambiar la configuración.
- **Un mix que llega tarde** deja el mismo ELO que un recálculo y no cambia la foto.
- El cron: solo `service_role`, no cierra antes de la fecha, espera un mix en vivo, no espera uno sin novedades hace 10 minutos y cierra igual pasadas 6 horas.

`correr.sh` completo **no llega a la `24`**: se corta en la `23` por una prueba que ya fallaba ("por STEAM_0 del adicional…", ver incidentes). Por eso el ciclo de la `24` se corrió a mano con los mismos pasos.

### Backend

- `pnpm typecheck`: sin errores.
- `pnpm test`: 282 de 282 (9 nuevas de temporadas: validación de tramos y rangos, confirmación, 404, ranking con valores vacíos, vista previa con resumen y medallas sin temporada).
- `pnpm test:int`: 96 de 96, en los 13 archivos (9 nuevas: configuración, abrir, cambiar, ranking en vivo con dos mixes, vista previa, cerrar con reinicio y foto, medallas e historial del jugador, recálculo después del cierre).
- `pnpm season:tick` no se probó contra una base: el script solo llama a `season_close_due()`, que está probada en SQL.

## En qué se apartó del plan

- **Duración y hora:** 30 días y las 06:00 de Argentina, por las respuestas de Daniel (el plan proponía 90 días y las 05:00 de Colombia).
- **Nombres de las medallas 2 y 3:** "Subcampeón" y "Tercer puesto" (el plan solo daba los íconos).
- **El mínimo de mixes va de 1 a 1000:** con 0, cualquiera con ELO y sin mixes entraría al ranking.
- **El pico también se reinicia al empezar la temporada 1,** no solo al cerrar, para que el de la temporada 1 no arrastre el de la pretemporada.
- **Mix que llega tarde:** recalcula si la fecha es anterior al cierre **o al comienzo** de una temporada, por la misma razón.
- **Vista nueva `player_season_list`** para `GET /players/{id}/seasons` (ordenar por número de temporada).
- **La vista previa** usa los tramos de la temporada activa (sin activa, los de la configuración y los mixes desde el último cierre). No ordena por "cuánto baja": con los mismos valores es el mismo orden que por ELO.
- **Mensajes de error:** las reglas del cierre usan el código por defecto (`P0001`) y no `22023`, para que la API devuelva el mensaje y no "Algún dato tiene un formato inválido".
- **Fecha de fin al cambiar la activa:** tiene que ser futura; para terminarla ya está el botón.
- **El cron usa su propio archivo de entorno** (`season.env`) en el VPS, para que la API siga sin la clave de servicio, como decía el plan del VPS.

## Incidentes durante las pruebas

- **La prueba SQL de la `23` (`!whois`) falla:** "por STEAM_0 del adicional: nicks y partidas de toda la ficha (privada igual), ficha y alias". Ya estaba así antes de este cambio: esas pruebas se escribieron el 2026-10-19 sin correrlas (`PENDIENTES.md`, punto 1.10). Queda anotado allí.
- **Sin la fila de `elo_config`, los ajustes de ELO fallan** (`elo_apply_adjustment` deja `elo` en null). La base local no la tiene; producción sí. Las pruebas la crean si falta y la borran al terminar.
- **Las pruebas SQL dependían de los datos de la base local:** el ranking es de todas las fichas, así que los mixes que dejan las pruebas de integración cambiaban los puestos. La prueba vacía los mixes y el ELO dentro de su transacción (con rollback).

## Cómo revertir

Antes del corte, no hay nada que revertir en producción. En una base con la `24`:

```bash
docker exec -i supabase_db_v34frag-api psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/24_temporadas.sql
```

Después, `select elo_recompute_all();` para sacar los reinicios del ELO. La inversa borra las temporadas, sus fotos y sus medallas. En el backend, revertir el commit.
