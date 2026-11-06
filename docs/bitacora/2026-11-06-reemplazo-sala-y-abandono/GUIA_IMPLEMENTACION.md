# La sala en el link de reemplazo, el detalle como sala y el ELO del abandono: guía de implementación

## Estado

Hecho y probado en local el 2026-11-06 (la base con la copia de producción, la API y la web). Commiteado en `main` (copia en `feat/frontend-fase-1`; la base y la API en `feat/mm-claim-en-sala`). **Sin desplegar.** No se miró en el navegador con datos reales.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/78_mm_reemplazo_sala_y_abandono.sql` | Nuevo: topes del abandono, `mm_elo_delta`, rondas del reemplazo, `mm_lobby_replacements`, `mm_replace_info.room`, `mm_game_room`, `mm_set_config`, `manual_valores` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/78_mm_reemplazo_sala_y_abandono.sql` | Nueva: inversa |
| `pruebas/prueba_78.sql`, `probar_78.sh` | Pruebas de la base |
| `web/backend/src/routes/mm.ts` | `GET /api/v1/mm/games/{id}/room` |
| `web/backend/src/lib/manual.ts` | Marcadores `mm.abandono_*` |
| `web/backend/test/unit/mm-replace.test.ts` | 4 pruebas de la ruta nueva; una sola llave para todo el archivo |
| `web/frontend/src/features/matchmaking/room/RoomOverview.tsx`, `roomData.ts`, `MatchRoom.tsx` | La sala en tres modos, el lugar libre, la fila del reemplazo, el que se fue, "Entra al servidor" y "Cambios en la partida" |
| `web/frontend/src/features/matchmaking/ReplacePage.tsx` | La vista previa |
| `web/frontend/src/features/mixes/pages/MixRoomPages.tsx` | El detalle de una partida del matchmaking es su sala |
| `web/frontend/src/features/matchmaking/admin/GeneralForm.tsx`, `types.ts`, `source.ts`, `queries.ts`, `demo.ts` | Los topes en Administración y la fuente de datos |
| Pruebas de la web | `room/RoomOverview.test.tsx` (nuevo), `ReplacePage.test.tsx`, `mixes/components/MixRoom.test.tsx` |
| `docs/manual/...`, `terms/terminos.html`, `TermsPage.tsx`, `lib/meta.ts` | Manual y términos |

## Despliegue (pendiente)

Sin un mix en curso. No toca el plugin ni los servidores.

1. **Base del VPS:** la `78` desde el archivo commiteado (LF). Antes, `probar_78.sh` contra la base por el túnel **con `cmleague-mm` parado** (si no, la vuelta de `mm_tick` del worker espera los bloqueos de la prueba). Necesita la `75` (ya está) y no depende de la `77`.
2. **API y web juntas**: la web nueva pide `/api/v1/mm/games/{id}/room`. Con la API vieja, el detalle cae en la sala de mix (la consulta falla y queda la de siempre), así que el orden no rompe nada.
3. Publicar el `CHANGELOG_DISCORD.txt` (2.9.19) y los términos.

## Pruebas

### Base (Supabase local con la copia de producción)

- `probar_78.sh docker`: **12 comprobaciones** y la inversa, en una transacción con rollback. La inversa deja las siete funciones exactamente como estaban (md5) y no quedan las columnas ni las funciones nuevas. Cubre: ganó y se fue temprano (−4), perdió parejo (la derrota normal), perdió siendo muy favorito el rival (el rango: −9), empate (como derrota), se fue al final (el mínimo de cada rango), sin estadísticas (el máximo), los topes de la configuración y que no se crucen, el compañero sigue con su regla, las rondas del reemplazo (se pide en la 6 y entra en la 11), la sala del link sin el servidor ni lo privado, el plazo para conectarse mientras está tomado, la sala del detalle (cualquiera con sesión, null para un mix sin sala y para la serie, sin sesión no), el manual y los permisos.
- `mm_game_room` sobre partidas reales de la copia: 10 jugadores, sus estadísticas y sin el servidor.

### API

- `pnpm test`: 40 archivos, **547 pruebas**. `pnpm typecheck` y `pnpm build` (manual: 38 páginas) sin errores.

### Web

- `pnpm test`: 104 archivos, **631 pruebas** (6 nuevas: la vista previa, tomé el lugar con la cuenta regresiva y el orden de las filas, el detalle con los números de la partida, la página del link con la sala, y el detalle que abre la sala o la de mix). `tsc -b` y `eslint` sin errores.
- No se miró en el navegador.

## En qué se apartó del plan

- **El detalle no lleva la pestaña en la URL**: la sala guarda la pestaña como "Tu última partida" (abre siempre en Descripción general).
- **La ronda del abandono es la del pedido de reemplazo**, no la del momento en que se desconectó (eso no se guarda): por eso la sala dice "se pidió en la ronda N".
- **Los marcadores del manual son cuatro números** (`mm.abandono_ganado_min`…), no dos rangos de texto.

## Incidentes durante las pruebas

- La primera corrida de `prueba_78.sql` comparaba el nick del jugador con el que se creó, pero el alias del perfil lo pisa (como en la `75`). Se compara con el de `players`.
- En la API, la prueba nueva usaba otra llave de firma y el JWKS ya estaba guardado con la primera: 401. El archivo comparte una sola llave.
- Prettier sobre `src/features` reformateó archivos ajenos (`TeamConfigTab`, `teams/api/queries`, la página de términos, una prueba de Administración). Se devolvieron a como estaban.

## Cómo revertir

- **Base:** la inversa de la `78` (se pierden los topes y las rondas de los reemplazos; el abandono vuelve a la derrota completa más el extra).
- **API y web:** revert del commit y desplegar.
