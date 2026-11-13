# Chat de la sala con textos largos y jugadores sin ficha en los torneos históricos: guía de implementación

## Estado

- **Hecho** en `main` (commits `b8b3d259` y el siguiente): la `113`, la API, la web, el manual y `/privacidad`. La `113` quedó aplicada en la base local.
- **Probado en local con la copia de producción del 2026-11-12** (base local, la API y la web de este código, con Playwright).
- **Sin desplegar.**

## Archivos

- `supabase/replanteo/113_historico_jugadores_sin_ficha.sql` y `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/113_historico_jugadores_sin_ficha.sql`.
- `web/backend/src/`: `routes/events.ts` (`PUT …/registrations/{teamId}` con `guests`, `GET …/registrations` con `guests`), `routes/matches.ts` (planteles de la serie), `schemas/events.ts`, `schemas/matches.ts` y `db/types.ts` (a mano: `pnpm db:types` contra la base local trae tablas de otras ramas).
- `web/backend/test/integration/historicos-testing.test.ts`: casos de la `113`.
- `web/frontend/src/`: `api/schema.d.ts` (regenerado desde la OpenAPI de este código: la API que corría en `:8787` era de otro worktree), `features/admin/events/components/HistoricRegistrations.tsx` y su prueba nueva, `features/admin/events/api/queries.ts`, `routes/demo.siembra.tsx` (el campo nuevo), el chat (`features/matchmaking/LobbyChat.tsx`, `ChatDock.tsx`, `room/RoomOverview.tsx`) y `features/legal/`.
- `docs/manual/organizador/subir-torneo-historico.md`, `terms/privacidad.html` y `terms/terminos.html` (fecha).

## Despliegue

Ninguna parte toca los servidores de juego.

1. **Base:** `pruebas/probar_113.sql` contra producción (se deshace solo). Después, aplicar la `113` y `notify pgrst, 'reload schema'`. Se puede hacer con mixes en vivo: la API de ahora no lee la columna nueva.
2. **API:** `deploy/vps/desplegar.sh api` desde `main`, sin salas del matchmaking armándose.
3. **Web:** `deploy/vps/desplegar.sh web` desde `main`.
4. Comprobar: en un histórico, **Jugadores** › **Agregar «nombre» sin ficha** › **Guardar**; el nombre sale en la tabla y en el plantel de una partida de la llave. Mandar un mensaje largo sin espacios en una sala.
5. Publicar `CHANGELOG_DISCORD.txt` y las dos páginas legales de `terms/` (cambió la fecha y el texto de privacidad).

Vuelta atrás: primero la web y la API, después la inversa de la `113` (borra los nombres cargados).

## Pruebas

### Base local (`pruebas/probar_113.sh`, en una transacción que se deshace)

7 de 7: un usuario común no carga (`42501`); fichas y nombres juntos, con los espacios limpios; repetidos sin distinguir mayúsculas, nombres de 1 o de 25 caracteres y más de 10 en total, rechazados; un rechazo no toca lo guardado y la lista vacía borra los nombres; en un torneo normal, rechazado; `anon` no puede; la inversa se aplica.

### API

- 596 unitarias.
- Integración (`historicos-testing.test.ts`, 6 de 6): guarda nombres en un equipo de la plataforma y en uno histórico, `400` con repetidos, `403` sin gestionar el torneo, `GET …/registrations` con `guests` (vacío en un equipo sin nombres) y el plantel de la serie con el nombre como invitado.

### Web

- Prueba nueva `HistoricRegistrations.test.tsx`: la tabla muestra "(sin ficha)"; el diálogo agrega un nombre con los espacios limpios, no ofrece el mismo nombre dos veces y manda `{active, subs: [], guests}`.
- Matchmaking: 106 de 106 después del cambio del chat.
- Lint y typecheck sin errores; la suite completa, 739 de 739. Después, `HistoricRegistrations.test.tsx` suma 3 casos (en curso, cancelado y ficha con el alias exacto): 21 de 21 en `features/admin/events`.

### En local con la copia de producción (2026-11-13)

API de este código en `:8788` y web en `:5174` contra la base local (copia de producción del 2026-11-12, con la `113`), con un admin de prueba creado solo en la base local.

- **Chat:** en `/demo/matchmaking`, un mensaje de 250 caracteres sin espacios en el chat de equipo y en el general. La página no se desborda (ancho de la página igual al de la ventana en 1440 y 390 px) y el texto corta dentro de cada chat.
- **Histórico en inscripciones** (el de prueba "M m36wd6"): equipo de la plataforma (ETHEREAL) con una ficha y un nombre sin ficha, y un equipo histórico nuevo con un nombre (los espacios de más se limpian). La página de ETHEREAL no muestra el nombre. Con el fixture generado, la llave muestra los dos planteles con los nombres.
- **TORNEO TITAN (en curso):** **Jugadores** activo y **Quitar** bloqueado. En Lotus, la ficha de kobassj y dos nombres sin ficha; la llave los muestra en la alineación.
- **Lo que encontró la prueba:** la opción "sin ficha" salía antes que las fichas encontradas, y al buscar `kobassj` se cargó como texto en vez de su ficha. Se corrigió: la opción va al final, espera a que termine la búsqueda y no aparece si hay una ficha con el alias exacto; Enter elige la ficha. Prueba nueva en `HistoricRegistrations.test.tsx`.

## En qué se apartó del plan

- **Jugadores con el torneo en curso o terminado:** no estaba en el plan. En un histórico, **Jugadores** ahora queda activo en cualquier estado menos cancelado, para cargar los jugadores de TORNEO TITAN (en curso). Pedido por Daniel el 2026-11-13.

- El plan nombraba la página del manual del moderador. No hizo falta: la de subir un histórico es la del organizador y la usan los tres roles que gestionan uno.

## Cómo revertir

Inversa de la `113` y `git revert` del commit.
