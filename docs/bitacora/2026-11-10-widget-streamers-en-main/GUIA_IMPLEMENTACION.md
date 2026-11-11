# Widget para streamers en `main`: guía de implementación

## Estado

**Desplegado** desde `main` (commit `a737d54e`). **Falta** probarlo en OBS de verdad.

- **La `110`:** aplicada el 2026-11-10. Antes, `probar_110.sql` contra producción pasó 10 de 11 y se deshizo; la 9 quedó salteada porque producción ya tiene una temporada activa.
- **La API y la web `a737d54e2c4f`:** desplegadas el 2026-11-11 a las 04:58 UTC. Había una sala del matchmaking `live` y ninguna aceptando ni en el veto. El partido no depende de la API, y `desplegar.sh api` no reinicia `cmleague-mm`.
- **Comprobado en producción:**
  - `GET /api/v1/players/{id}/widget` responde `200` con caché de 30 s, y `404` con una ficha que no existe.
  - `https://cmleague.lat/widget?…&d=stats` se dibuja con los datos reales y la frase "Primero del ranking", sin errores en la consola.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/110_widget_streamers.sql` | Nuevo: `widget_player(ficha, período, desde)` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/110_widget_streamers.sql` | Nuevo: la inversa (borra la función) |
| `supabase/replanteo/README.md` | Fila de la `110` |
| `web/backend/src/db/types.ts` | La función `widget_player`, agregada a mano (ver "En qué se apartó del plan") |
| `web/backend/src/schemas/players.ts` | `WidgetQuery`, `WidgetPeriodStats` y `WidgetData` |
| `web/backend/src/routes/players.ts` | `GET /api/v1/players/{id}/widget` |
| `web/backend/test/integration/widget.test.ts` | Nuevo: 4 pruebas contra la base local |
| `web/frontend/src/api/schema.d.ts` | Regenerado: solo suma la ruta y `WidgetData` |
| `web/frontend/src/features/widget/options.ts`, `options.test.ts` y `demo.ts` | Copiados de `kyan/pruebas` (`d9c02ee0`) sin cambios |
| `web/frontend/src/features/widget/StreamWidget.tsx` | Copiado de `kyan/pruebas`. `LevelRing` dibuja el anillo de `LevelBadge` en vez de los `.svg` de `public/niveles/`, que no están en `main` |
| `web/frontend/src/features/widget/api.ts` | Nuevo: `widgetDataOptions` (cada 60 s, también en segundo plano), `localMidnight` y `toWidgetData` |
| `web/frontend/src/features/widget/WidgetPage.tsx` y `routes/widget.tsx` | Nuevos: la página `/widget`, fuera de `_app` |
| `web/frontend/src/features/widget/WidgetCustomizer.tsx` | Nuevo: el personalizador de la demo de Kyan, pasado a componentes (`WidgetControls`, `WidgetPreview`) y en tuteo |
| `web/frontend/src/features/widget/WidgetCard.tsx` | Nuevo: la tarjeta y el diálogo de Cuenta |
| `web/frontend/src/features/widget/WidgetPage.test.tsx` y `WidgetCard.test.tsx` | Nuevos: 5 y 2 pruebas |
| `web/frontend/src/features/profile/pages/AccountSection.tsx` | La tarjeta debajo de la del HUD |
| `web/frontend/src/routes/demo.widget.tsx` | Copiado de `kyan/pruebas`, ahora con el personalizador compartido |
| `web/frontend/src/routeTree.gen.ts` | Regenerado: `/widget` y `/demo/widget` |
| `docs/manual/jugador/widget-para-stream.md` | Nueva |
| `docs/manual/streamer/hud-obs.md` | Enlace al widget |

## Despliegue

Ninguna parte toca los servidores de juego, así que no hay que subir nada a los servidores ni esperar un cambio de mapa.

1. **Base:**
   - `pruebas/probar_110.sql` contra producción: se deshace solo.
   - Aplicar la `110` y después `notify pgrst, 'reload schema'`.
   - Se puede hacer con mixes en vivo: solo suma una función de lectura.
2. **API:** `deploy/vps/desplegar.sh api` desde `main`. Reinicia `cmleague-api`, así que hay que hacerlo sin salas del matchmaking armándose. Despliega también el manual nuevo de `/help`.
3. **Web:** `deploy/vps/desplegar.sh web` desde `main`.
4. Comprobar `https://<web>/widget?id=<una ficha>&bg=1` y la tarjeta en Mi perfil › Cuenta.
5. Publicar el changelog (`CHANGELOG_DISCORD.txt`).

## Pruebas

### Base local (`pruebas/probar_110.sh`, en una transacción que se deshace)

| # | Prueba | Resultado |
|---|---|---|
| 1 | Ficha inexistente: null | ok |
| 2 | Período inválido: error `22023` | ok |
| 3 | Hoy desde hace 2 h: solo el mix de hace 1 h. Las stats de `match_player_extra`: sniper = AWP + Scout, cuchillo, pistolas y clutches 1v1 + 1v2 | ok |
| 4 | 24 h: dos mixes, ELO +5, rating calculado. El mix sin `match_player_extra` suma 0 en esas stats | ok |
| 5 | Histórico: V-D-E 1-1-1. El empate sin ELO suma 0, y no cuentan ni el cancelado ni el oficial | ok |
| 6 | Últimos: V, D, E con su ELO, del más nuevo al más viejo | ok |
| 7 | ELO, pico, puesto 1, primero de su país y sigla del equipo. El segundo de ese país da puesto 2 en los dos | ok |
| 8 | Ficha sin ELO ni mixes: ELO inicial, sin puestos, todo en 0 y rating null | ok |
| 9 | Temporada: desde el comienzo de la activa | ok |
| 10 | Como `anon`: anda, y ve el país del perfil público pero no el del privado | ok |
| 11 | La inversa borra la función | ok |

### API

- `test/integration/widget.test.ts` (4 de 4):
  - sin sesión, por id y por nick;
  - los cuatro períodos y la caché de 30 s;
  - `404` con una ficha que no existe;
  - `400` con período inválido, con `since` en otro período, de hace 72 h o que no es una fecha.
- Las 596 pruebas unitarias y `pnpm typecheck` pasan.
- `pnpm build` valida el manual: 56 páginas.

### Web

- 728 pruebas (`pnpm test`), `pnpm typecheck` y `pnpm lint` pasan.
- Las nuevas cubren:
  - `/widget` sin id, con datos, el período que va a la API, ficha inexistente y sin conexión;
  - la tarjeta sin ficha (botón apagado y enlace a Vinculación) y con ficha (vista previa y la URL que cambia con el diseño y el período).

### En el navegador (Playwright contra la API y la web locales, con la base local)

- Los seis diseños con una ficha real de la base local (42 mixes, 25 con `match_player_extra`): todos se ven bien, con su color y su tamaño.
- Sin `bg=1`, `html` y `body` quedan transparentes (`rgba(0, 0, 0, 0)`).
- Con la API cortada durante 65 s, sigue el último widget.
- "Falta el jugador en la URL" y "Jugador no encontrado".
- `/demo/widget` con el personalizador compartido.
- Con un usuario de prueba creado y borrado en la base local: se inicia sesión, **Armar mi widget** abre el diálogo con la vista previa y la URL queda `…/widget?id=<ficha>&d=stats&v=historico`.
- Sin errores en la consola, salvo los de los pedidos cortados a propósito y el 404 esperado.

**Sin probar:** en OBS de verdad (el `zoom` del tamaño y la transparencia en su navegador) y en producción.

## En qué se apartó del plan

- **Perfil privado:** el plan decía `404` y "Perfil privado". Pero el perfil público muestra el ELO y las stats aunque el perfil sea privado (solo oculta los datos personales), así que el widget sigue el mismo criterio: se ve igual, sin la bandera.
- **Qué partidas cuentan:** el plan decía "las mismas que `player_elo_history`", que solo tiene los mixes con ELO. Cuentan todos los mixes terminados (un mix sin ELO cuenta como V, D o E y suma 0), como en la versión de octubre y en las victorias del perfil.
- **Dónde está el botón:** en Mi perfil › **Cuenta**, al lado del HUD para OBS, en vez de en la primera pestaña del perfil.
- **Vista previa:** el diálogo dibuja el widget directamente, en vez de con un `iframe` de `/widget?…&bg=1`. Es el mismo componente con los mismos datos, y se ahorra cargar la web otra vez.
- **Sigla del equipo:** null si el equipo no tiene sigla. Probé usar el nombre, pero cortaba el nick en el diseño Stats.
- **`types.ts` de la API:** `widget_player` se agregó a mano. `pnpm db:types` regenera todo desde la base local, que no estaba en el mismo estado que `main`: faltaba al menos la `109`.
- **Anillo de nivel:** `LevelRing` usa los segmentos de `LevelBadge` en vez de los `.svg` de `public/niveles/` del prototipo, que no están en `main`.
- **`PLAN.md`:** enlaza a `2026-10-29-widget-streamers` y `2026-11-08-widget-streamers-stats`, que solo existen en `kyan/pruebas`. En `main` esos enlaces no llevan a ningún lado.

## Incidentes durante las pruebas

- **API de la Supabase local:** Kong (`54321`) devolvía respuestas vacías. Se reinició su contenedor (`docker restart supabase_kong_v34frag-api`), solo en local.
- **La `110` en la base local:** quedó aplicada para las pruebas. `probar_110.sql` borra la función dentro de su transacción antes de aplicarla, así que se puede correr igual.

## Cómo revertir

La inversa (`reversas/110_widget_streamers.sql`) y revertir el commit. Si se deshace la base y la web queda, `/widget` y la tarjeta muestran el error de la API. Conviene revertir las tres partes juntas.
