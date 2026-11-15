# Pines y trofeos de torneo: guía de implementación

## Estado

**Desplegado el 2026-11-15**: la `123` en producción, y la API y la web `8b39086f0aca` (rama `feat/pines-de-torneo`, commits `e502da3a` y `8b39086f`). No toca los servidores de juego ni el plugin. `main` todavía no tiene estos commits.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/123_pines_de_torneo.sql` | `events.pins`, tablas, `event_final_places`, `event_award_stats`, `event_pins_sync`, elección de premios, triggers, avisos, vitrina, vistas y retroactivo |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/123_pines_de_torneo.sql` | Inversa |
| `docs/bitacora/2026-11-15-pines-y-trofeos/pruebas/probar_123.sh`, `.sql` | Prueba de la base, con rollback |
| `web/backend/src/routes/pins.ts`, `src/schemas/pins.ts` | Rutas de pines, premios, clips del torneo y vitrinas |
| `web/backend/src/schemas/events.ts` | `pins` en `EventCreate` y `EventPatch` |
| `web/backend/src/app.ts` | Registra `pins` antes que `players` |
| `web/backend/src/db/types.ts` | Regenerado con la CLI de Supabase (`supabase gen types --local`) |
| `web/backend/test/integration/pins.test.ts` | Prueba nueva |
| `web/backend/test/integration/medals.test.ts`, `mixes-perfil-ranking.test.ts` | Las medallas de torneo ya no se dan solas. En su lugar, el pin |
| `web/frontend/src/api/schema.d.ts` | Regenerado (`pnpm gen:api`) |
| `web/frontend/src/features/pins/` | `api.ts`, `config.ts`, `PinTile.tsx`, `PinsFields.tsx`, `EventPinsSection.tsx` (más lo del prototipo de Kyan, cherry-pick de `deba6094`) |
| `web/frontend/src/features/player/` | Pestaña Vitrina (`ShowcaseTab.tsx`), Resumen (Vitrina y Logros con 5), `search.ts`, `PlayerTabs.tsx`. En Logros, «Vitrina» pasa a «Destacadas» |
| `web/frontend/src/features/admin/events/components/EventForm.tsx`, `ManageTabs.tsx` | Sección Pines y trofeos. En Configuración, los pines guardados |
| `web/frontend/src/features/events/components/SummaryTab.tsx` | Podio de pines y premios |
| `web/frontend/src/features/teams/components/Showcase.tsx`, `pages/TeamView.tsx` | Vitrina del equipo con pines |
| `web/frontend/src/features/shell/notifications/` | Avisos `event_pin` y `event_award` |
| `docs/manual/…` | Nuevas: `jugador/vitrina-y-pines.md` y `organizador/pines-y-premios.md`. Actualizadas: `jugador/logros.md`, `organizador/crear-torneo.md`, `resultados-y-llave.md`, `subir-torneo-historico.md` y `admin/medallas.md` |

## Despliegue (hecho el 2026-11-15)

1. **Lista previa**, solo leyendo de producción en una transacción de solo lectura: la `114` estaba y la `123` no. Había 12 medallas de torneo (`source = 'event'`): TORNEO TITAN (4 campeón y 3 finalista), Torneo Mercy 2020 (1 y 2) y Torneo LocalStrike 2019 (2 campeón), los tres históricos y terminados. También había 17 medallas de campeón o finalista dadas a mano por torneos de afuera, que no se tocan.
2. **Base:** se aplicó la `123` por el túnel (`psql -v ON_ERROR_STOP=1 -f`) y después `notify pgrst, 'reload schema'`. Resultado: «12 medallas de torneo pasan a pines; 16 pines de jugador en total». Después: 0 medallas `source = 'event'`, 0 avisos `event_pin` y `event_award`, y las dos definiciones manuales y activas.
3. **API:** había 7 jugadores en la cola del matchmaking, así que se esperó a que su sala pasara a `live` (el veto pasa por la API; la partida en juego no, porque el plugin manda a `/rest/v1`). `deploy/vps/desplegar.sh api` falló en `build:check` con `EACCES` en el 18787, porque Windows (Hyper-V o WSL) tenía reservado el rango 18713–18812. Se agregó `BUILD_CHECK_PORT` (commit `8b39086f`) y se desplegó con `BUILD_CHECK_PORT=28787` y `--sin-pruebas`: las 654 pruebas ya habían pasado en la corrida anterior con el mismo código. `/api/health` respondió `8b39086f0aca`.
4. **Web:** `deploy/vps/desplegar.sh web`, con 798 pruebas.
5. Falta publicar `CHANGELOG_DISCORD.txt`.

Orden obligatorio: la base antes que la API (la API nueva lee `team_pin_list` y `events.pins`) y la API antes que la web (la web usa las rutas nuevas).

## Pruebas

### Base (copia local de producción)

`pruebas/probar_123.sh`: **57 de 57**. Corre todo con rollback y por eso pide que la `123` no esté aplicada. Si ya lo está, primero hay que aplicar la inversa. Prueba:

- el retroactivo (cada medalla con su pin, sin avisos, respaldo y definiciones manuales);
- torneos de cada formato, jugados con el motor: eliminación simple de 8 con y sin 3.er puesto, de 16, doble eliminación de 8, liga de 4, grupos con playoffs y suizo;
- suplentes que no jugaron, avisos una sola vez, configuración (octavos, tercero apagado, participante, mínimo de equipos, apagado) y registro de cambios;
- corregir la final, testing, premios automáticos, a mano, «lo elijo yo», apagados y permisos;
- vitrina automática y manual, y la inversa.

La `123` quedó aplicada en la copia local (139 medallas de torneo pasaron a pines).

### API

- Unitarias: 654 de 654.
- Integración: `pins.test.ts` 5 de 5. Con `medals.test.ts` y `mixes-perfil-ranking.test.ts` actualizados, 30 de 30.
- La suite completa de integración: 216 de 227. Las 11 que fallan son de `claim`, `hud`, `live` y `shop`, y fallan igual con los triggers de pines apagados: son de datos de la copia local (configuración de la tienda, HUD, tiempos), no de este cambio.
- `pnpm build`: valida el manual (68 páginas).

### Producción

- `GET /api/v1/events/{TORNEO TITAN}/pins`: estilo `anillos`, Londonmint campeón, Ogaliciosos finalista, Tasitas tercero. Premios pendientes de elegir: los cinco encendidos por defecto, porque los históricos no tienen stats.
- `GET /api/v1/players/{un campeón}/showcase`: su pin de campeón como primer destacado.
- La sala del matchmaking siguió en `live` durante el despliegue.

### Web

- `tsc -b` sin errores, ESLint sin errores.
- Vitest: 798 de 798.
- Probado en la copia local con Chromium sin interfaz (Playwright): medidas y capturas del Resumen. En el navegador de Daniel, la Vitrina y elegir destacados en local.

## En qué se apartó del plan

- **Las medallas de torneo vuelven a ser manuales, no se archivan.** Si se archivaban, un admin ya no podía registrar títulos de torneos de afuera de la plataforma (en producción hay 18, como «CAMPEON TORNEO TITAN»). Lo automático pasa a los pines, y la medalla queda para lo de afuera.
- **Categoría de los avisos:** `tournament`, porque la categoría `event` no existe.
- **Rutas:** los pines del torneo van en `GET /events/{id}/pins` y no dentro del detalle del torneo, y los del equipo en `GET /teams/{id}/pins`. `GET /players/{id}/showcase` trae destacados, pines y premios en una sola llamada, en lugar de `/players/{id}/pins`. Se sumó `GET /events/{id}/clips` para elegir la jugada.
- **Elegir a mano a cualquiera del plantel** (pedido por Daniel el 2026-11-15, después del plan): la lista trae primero los 10 sugeridos y después el resto del plantel, con un buscador. El plan solo daba los 10 mejores.
- **Resumen del perfil** (pedidos de Daniel el 2026-11-15, después del plan): tarjeta **Mejores mapas** a la derecha (`MapsTab.tsx`, `BestMapsCard`). **Logros** pasa a la izquierda, con hasta 10 (medido con Playwright: «Jugadas clave» mide 600 px y 10 logros, 594), y el dueño elige cuáles en la pestaña Logros (`MedalsCard.tsx`). Con un perfil lleno, las columnas quedaron en 1101 y 1032 px.
- **Escalones según el formato:** «Tercer puesto» también existe en una liga (grupos de un solo clasificado). «Participante» en eliminación simple, solo con más de 16 equipos.
- **El registro de cambios** (`event_pins_log`) queda en la base, sin pantalla.
- **«Vitrina» en Logros** pasa a llamarse «Destacadas», para no tener dos secciones con el mismo nombre en el perfil.
- **Capitán:** la vitrina del equipo se explica en la página del jugador (`jugador/vitrina-y-pines.md`), sin una página aparte.

## Incidentes durante las pruebas

- Una corrida de la prueba de la base chocó con un *deadlock* al aplicar la inversa, por otra conexión que usaba `matches` (la API local). Repetida, pasó.
- La primera versión daba «Tercer puesto» al único que perdía en semis en una llave de 3 equipos sin partido por el 3.º. Se corrigió: ese escalón solo existe con partido por el 3.º, en doble eliminación o en una liga.
- En la copia local, la primera versión de la `123` había archivado las definiciones. Al aplicar la inversa, `event_medals_sync` no encontró definiciones activas y no devolvió las medallas de prueba. La `123` y la inversa ahora dejan `status = 'active'` explícito. Solo afectó a la copia local.

## Cómo revertir

1. La web y la API a la versión anterior.
2. La inversa de la `123`. Devuelve las medallas del respaldo (`player_medals_123_respaldo`), vuelve a poner las definiciones en `event_result`, recrea `event_medals_sync` con sus triggers y la corre en todos los torneos terminados sin avisos. Borra pines, premios, vitrina, avisos `event_pin` y `event_award`, y `events.pins`.
