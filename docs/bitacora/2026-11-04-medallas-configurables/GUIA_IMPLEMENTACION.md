# Medallas configurables: guía de implementación

## Estado

> **Número:** primero fue la `75`, después la `78` y el 2026-11-06 quedó en la **`79`**: la `75` (reemplazos), la `76` (clips destacados), la `77` (abandono en la última ronda) y la `78` (sala en el link de reemplazo) ya están en producción. Los cambios se pasaron a la rama `feat/medallas`, que sale de `main`.

Fase 1 del plan hecha y probada **en local** el 2026-11-04/05, en el worktree `v34frag-main`, rama `feat-missions-badges`. El 2026-11-06 (Daniel: "solo las medallas, sin Montserrat por ahora") se pasó a la rama **`feat/medallas`**, que sale de `main` (worktree `v34frag-medallas`), sin `badges/`, misiones, el `.rar` ni las insignias VIP. Se ensayó sobre una copia completa de producción del 2026-11-06 (`~/.v34frag/prod-copy/2026-11-06`). Sin desplegar.

> **La BETA de producción cierra el 2026-11-09 a las 09:00 UTC** (leído en la base el 2026-11-06), no el 2026-12-03: la 79, la API y el timer tienen que estar antes, para que el cierre dé las medallas de puesto con dibujo y la apertura de la temporada 2 reparta Fundador y Pionero.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/79_medallas_configurables.sql` | Nuevo |
| `docs/bitacora/2026-11-04-medallas-configurables/pruebas/` | Inversa, pruebas SQL, definiciones iniciales y el script del manifiesto |
| `docs/bitacora/2026-11-04-medallas-configurables/diseños/` | Los generadores y los `LEEME` de Kyan (sección 10 del plan) |
| `web/frontend/public/medallas/` | 246 SVG desbloqueados de `brillo_solo_marco` (2,7 MB) |
| `web/frontend/src/features/medals/` | Nuevo: `templates.json`, `templates.ts`, `svg.ts`, `Medal.tsx`, `svg.test.ts` |
| `web/frontend/src/routes/demo.medallas.tsx` | Demo de las plantillas, solo en `pnpm dev` |
| `web/frontend/src/features/admin/medals/`, `routes/_app/admin.medals.tsx` | Administración › Medallas |
| `web/frontend/src/features/player/` | Pestaña Logros, medallas dibujadas en Resumen, Bio y Temporadas |
| `web/frontend/src/features/admin/seasons/`, `features/ranking/`, `features/shell/notifications/`, `features/admin/players/` | Tramos con definición, ranking, campana y Fichas sin emoji |
| `web/frontend/src/auth/permissions.ts`, `features/shell/lib/nav.ts`, `api/schema.d.ts`, `routeTree.gen.ts` | Sección `medals`, menú y generados |
| `web/backend/src/routes/medals.ts`, `schemas/medals.ts`, `services/medals.ts` | Nuevos |
| `web/backend/src/routes/players.ts`, `admin-players.ts`, `seasons.ts`, `schemas/players.ts`, `seasons.ts`, `admin.ts`, `app.ts`, `db/types.ts` | `design` sin `icon`, Fichas con definición, tramos con `definition` |
| `web/backend/tsconfig.json` | `resolveJsonModule`: la API importa el manifiesto de la web |
| `web/backend/scripts/medals-tick.mts`, `scripts/build.mjs`, `package.json` | `pnpm medals:tick` |
| `deploy/vps/cmleague-medals.service`, `.timer`, `desplegar.sh` | El cron cada 5 minutos |
| Pruebas de la API | `test/integration/medals.test.ts` (nueva); `seasons`, `players-teams`, `mixes-perfil-ranking` y `seasons-routes` sin emoji |
| Pruebas de la web | `svg.test.ts`, `editor.test.ts`, `achievements.test.ts`; `PlayerProfile.test`, `NotificationsMenu.test`, `model.test`, `seasons.test` sin emoji |
| `docs/manual/admin/medallas.md`, `jugador/logros.md` (nuevas); `admin/temporadas.md`, `admin/usuarios-y-fichas.md`, `jugador/elo-y-estadisticas.md`, `jugador/notificaciones.md` | Manual |
| `docs/frontend/contrato/` | Rutas y campos nuevos |

## Despliegue (no hecho)

Sin un mix en curso ni salas abiertas. No toca el plugin ni los servidores de juego. La fuente Montserrat queda para después (Daniel, 2026-11-06): hasta entonces los textos de las medallas caen en Arial.

1. **Respaldo** de la base del VPS (`sudo /usr/local/bin/cmleague-respaldar`).
2. **Parar `cmleague-mm`** (si no, la vuelta de `mm_tick` espera los bloqueos de la prueba).
3. **Ensayo contra producción:** `pruebas/probar_79.sh "<conexión por el túnel>"`. La 79, las definiciones y la inversa en una transacción con rollback; todo tiene que dar `t`.
4. **Base:** `79_medallas_configurables.sql` y después `pruebas/definiciones_iniciales.sql`, desde los archivos commiteados (LF), y `notify pgrst, 'reload schema'`. Va después de la `78` (la `75` a la `78` son del matchmaking y de los clips, ya en producción). Con la BETA abierta no da ninguna medalla ni ningún aviso.
5. **API:** `deploy/vps/desplegar.sh api` (sube `medals-tick.mjs`). Prender `cmleague-mm` de nuevo.
6. **Cron:** copiar `cmleague-medals.service` y `.timer` a `/etc/systemd/system/`, `systemctl daemon-reload` y `systemctl enable --now cmleague-medals.timer`. Usa `/etc/cmleague/season.env`.
7. **Web:** `deploy/vps/desplegar.sh web` (los SVG van en `public/medallas`).
8. **Al cerrar la BETA (2026-11-09 09:00 UTC):** el cierre da el podio y el top con dibujo; al abrirse la temporada 2 todos los que jugaron entran a la cola y el cron les da Fundador y Pionero en unos minutos (unos 130 avisos). Avisar antes en Discord y publicar `CHANGELOG_DISCORD.txt`.

## Pruebas

### Base (copia de producción del 2026-11-05)

- **Ensayo sobre la copia de producción del 2026-11-06:** `probar_79.sh docker` (la 79, las definiciones y la inversa con rollback): 152 definiciones activas, ninguna medalla ni aviso con la BETA abierta, las 18 manuales con definición, los 5 tramos con medalla y el cierre enganchado; la inversa deja las 4 funciones (md5), las medallas y los tramos como estaban. API: 548 unitarias; integración, las de medallas pasan y fallan las mismas 9 que con el código de `main` sobre esa copia (storage y permisos de la copia) más el tiempo de `seasons`. Web: build, lint y 648 pruebas.
- **Sin las stats de la BETA (2026-11-06):** `prueba79.sql` empieza con una BETA (sin temporada 2: nada), abre la temporada 2 (todos a la cola) y la corre a mitad de las partidas (17a a 17f: kills, ELO máximo, MVP y temporadas jugadas solo desde la T2; Fundador y Pionero con la BETA). 32 comprobaciones "ok" en la base local. Para llevar una base que ya tenía la 79 vieja: `pruebas/79_ajuste_sin_beta.sql` (borra las medallas `auto`). La inversa no corre en la base local porque esa base tiene la 79 con la marca vieja "(replanteo 79)"; en staging y producción no pasa.
- `pruebas/prueba79.sql`: 23 comprobaciones "ok" (con las de la respuesta 5: al guardar un mix la medalla llega en el acto, y si la evaluación falla el mix se guarda igual y los jugadores quedan en la cola) (tramos con definición, sin medallas sin definición, diseño inválido rechazado, retroactiva igual al cálculo, no duplica, aviso con dibujo, motor igual a la retroactiva, cola, un mix sin `match_player_extra` no suma, mínimo de mixes, progreso, permisos, condición fija, archivar, tramo con una medalla que no es de temporada, manual repetida y cierre de temporada por definición, con aviso sin emoji).
- Inversa y reaplicación: inversa, `79` otra vez y otra vez todo "ok". La inversa devuelve el 🏆 a las 18 manuales.
- Las métricas de las 46 plantillas del motor, sobre los 116 mixes de la copia, dan valores razonables (por ejemplo, ELO máximo 1352, 10 jugadores pioneros).
- `definiciones_iniciales.sql`: 146 definiciones, 578 medallas.

### API

- Unitarias: 518 de 518. Integración: `medals.test.ts` (8 casos, con la medalla en el acto al guardar el mix), `seasons`, `players-teams` y `mixes-perfil-ranking` pasan. `pnpm typecheck` y `pnpm build` sin errores.

### Web

- `pnpm typecheck` y `pnpm lint` sin errores. Vitest: 627 de 627 (la de `PlayPage` falló una vez por tiempo con toda la suite y pasa sola). `svg.test.ts` dibuja las 59 plantillas con sus SVG reales y prueba id únicos, tamaño del número, metal y rombos, bloqueada, podio y que no queden scripts.
- Capturas con Playwright (1440 px, oscuro) de `/demo/medallas`, Administración › Medallas (lista y Nueva medalla), Logros de un jugador con 27 medallas, Administración › Temporadas y el ranking de la BETA, sin errores propios en la consola.
- Búsqueda de la sección 9.2 (`🏆|🥇|🥈|🥉|🏅|🎖`, `medal.icon`, `m.icon`) en `web/frontend/src` y `web/backend/src`: no queda ninguno en el código ni en las pruebas (los tramos guardan el emoji viejo en la base, pero no se muestra).

## Respuestas de Daniel a las preguntas del plan (2026-11-05)

Respondidas por Daniel; **falta que las revise Kyan**.

| # | Pregunta | Respuesta | En el código |
|---|---|---|---|
| 1 | Puestos 11 a N de la temporada | El Top 10 en bronce por ahora; después el admin la cambia | Así está (`season_top20`) |
| 2 | Manifiesto: ¿estático en la web o desde la API? | Pidió una recomendación: estático en la web y la API importa el mismo archivo (ver abajo) | Así está |
| 3 | Color: ¿libre o paleta? | La paleta fija de Kyan | Así está |
| 4 | En tamaño chico, ¿plana o con brillo? | Por ahora la de brillo achicada | Así está |
| 5 | ¿Cuándo se calculan? | Al guardar cada mix (al terminar, no ronda a ronda) | **Cambiado:** se dan en el acto al guardar el mix; el cron queda de respaldo |
| 6 | Medallas viejas con emoji | Se convierten | Así está (18 a «Campeón de torneo») |
| 7 | ¿Clutchs desde 1v1? | Sí | Así está |
| 8 | "Más mejorado" | Sigue abierta | Sin implementar (fase 2) |
| 9 | VIP por meses | Meses acumulados; Premium no existe | Para la fase 2. Los diseños `premium_*` no se usan |
| 10 | ¿Dónde van los diseños fuente (`badges/`)? | Revisar qué conviene más | Recomendación abajo; sin aplicar |
| 11 | ¿Se quita sola una medalla automática? | No | Así está |
| 12 | ¿Cuentan solo mixes o todo? | Cuentan todo | Así está: todas las partidas terminadas con la ficha del jugador (mixes, PCW y torneo) |
| 13 | ¿Se edita el objetivo de una otorgada? | No se puede | Así está |

**Recomendación para la 2:** dejarlo como está. Un solo archivo (`web/frontend/src/features/medals/templates.json`) que viaja con los SVG en el mismo commit: la web no hace un pedido más para dibujar y la API valida contra exactamente lo mismo que dibuja la web. Lo arma un script desde los SVG de Kyan, así que no se edita a mano. El único costo es que el build de la API lee un archivo de la carpeta de la web; los dos están en el mismo repo y `desplegar.sh` compila desde ahí. Si algún día la API se despliega sin el resto del repo, se mueve el JSON a una carpeta compartida.

**Recomendación para la 10:** no commitear `badges/`. Son 18 MB y 1255 archivos (PNG de catálogo, muestras, versiones con brillo y planas, bloqueadas). Lo que la web necesita ya está versionado: los 246 SVG en `web/frontend/public/medallas` (2,7 MB) y los generadores en `diseños/`. Los originales quedan en el Drive de Kyan, que es quien los edita. En la práctica: sacar `badges/` (y el `.rar`) del stage y sumarlos al `.gitignore`. Si más adelante se quieren las planas para el tamaño chico (4), se copian solo esas a `public/medallas/planas`.

## En qué se apartó del plan

- **Cola:** en lugar de parchar `csstv_ingest` (sección 4.4), triggers sobre `match_player_stats` y sobre el paso a `finished`. No toca la ingesta, que ya parchan la `04`, la `06`, la `07` y la `15`, y también cubre los mixes que se corrigen después.
- **Cuándo se dan (respuesta 5):** en el acto, al guardar el mix (`medal_evaluate_now`, unos 60 ms para 10 jugadores y 136 medallas en la copia), dentro de un bloque con excepción: si falla, el mix se guarda igual y los jugadores quedan en la cola. El cron `medals:tick` queda de respaldo y para las retroactivas grandes.
- **Nombres:** `medals_evaluate_pending` hace lo de `medals_evaluate_player` por lotes de jugadores; no hay una por jugador suelta.
- **Estado:** `status` (`draft`, `active`, `archived`) en lugar de `active boolean`, para distinguir borrador de archivada.
- **Vista previa:** `POST /admin/medals/preview` con la plantilla y el objetivo, sin guardar, en lugar de `/definitions/{id}/preview`: se usa antes de crear el borrador.
- **Rutas públicas:** `GET /api/v1/medals/definitions` (las activas, para los selectores). El manifiesto no tiene ruta: es estático en la web y la API lo importa (pregunta 2).
- **Preguntas del plan:** respondidas por Daniel el 2026-11-05 (tabla de arriba).
- **Medallas viejas:** las 18 con emoji eran títulos de torneos externos: pasaron todas a «Campeón de torneo» con su título.
- **Mixes jugados:** el SVG de Kyan dice "S1" en la etiqueta; la definición usa "MIXES".
- **No entran todavía:** premios de temporada por estadística, VIP por meses, misiones, prestigio y equipos (fases 2 a 4).
- **El trabajo empezó en otra rama:** primero se hizo sobre `feat/frontend-fase-1` siguiendo el artifact "Medallas configurables" (dibujo hecho en código, 7 plantillas). El 2026-11-05 se pasó a esta rama y se rehízo según este plan. En `feat/frontend-fase-1` no quedó nada.

## Incidentes durante las pruebas

- `pnpm db:types` trae tablas de otras ramas (la base local las tiene): `types.ts` se editó a mano.
- Las pruebas de integración de temporadas borran todas las temporadas y recalculan el ELO. Corridas sobre la copia de producción, se llevaron la BETA. La copia se volvió a cargar desde el volcado local. **No correr esas pruebas sobre la copia**, o recargarla después.
- La carga de la copia: primero `auth` y después `public` (las FK), y los objetos de `public` pasan a ser de `postgres` (si no, los replanteos fallan con "permission denied").

## Cómo revertir

1. `pruebas/79_inversa.sql` en la base (borra las medallas del motor; las de temporada y las manuales quedan con su título y su emoji).
2. Revertir los archivos de la lista y regenerar `schema.d.ts`.
3. En el VPS, si se instaló: `systemctl disable --now cmleague-medals.timer`.
