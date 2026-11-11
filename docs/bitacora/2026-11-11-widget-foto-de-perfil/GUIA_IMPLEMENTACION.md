# Foto de perfil en el widget para streamers: guía de implementación

## Estado

**En local, sin commit ni despliegue** (worktree de `main`, 2026-11-11). La `111` quedó aplicada en la base local.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/111_widget_foto.sql` | Nuevo: `create or replace` de `widget_player` con `'photo_url', o.photo_url`. Aborta si falta la función del 110 o `player_overview.photo_url` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/111_widget_foto.sql` | Nuevo: el cuerpo del 110, sin `photo_url` |
| `supabase/replanteo/README.md` | Fila de la `111` |
| `web/backend/src/schemas/players.ts` | `photo_url` en `WidgetData` |
| `web/backend/test/integration/widget.test.ts` | Prueba nueva: `photo_url` null sin foto y la de la ficha cuando tiene |
| `web/frontend/src/api/schema.d.ts` | `photo_url` en `WidgetData`, a mano (es la única diferencia con lo que generaría `pnpm gen:api`) |
| `web/frontend/src/features/widget/options.ts` | La parte `photo` ("Foto de perfil"), primera de la lista |
| `web/frontend/src/features/widget/StreamWidget.tsx` | `photo_url` en `WidgetData`; `Photo` e `Identity`; `LevelRing` con `number` y `className`. Los seis diseños usan `Identity` donde estaba `LevelRing` |
| `web/frontend/src/features/widget/demo.ts` | `photo_url: null` |
| `web/frontend/src/features/widget/StreamWidget.test.tsx` | Nuevo: 5 pruebas |
| `web/frontend/src/features/widget/options.test.ts`, `WidgetPage.test.tsx` y `WidgetCard.test.tsx` | `photo` en la ida y vuelta de la URL, y `photo_url` en los datos de prueba |
| `docs/manual/jugador/widget-para-stream.md` | La foto en el resumen y en "qué se muestra", y la sección "Tu foto" |

## En qué se apartó del plan

- La pastilla del nivel quedó 4 px por debajo del anillo (`-bottom-1`), no 2 px: con 2 px tapaba demasiado la foto en el Mini y la Barra (visto en las capturas).

## Despliegue

Ninguna parte toca los servidores de juego.

1. **Base:** `pruebas/probar_111.sql` contra producción (se deshace solo). Después, aplicar la `111` y `notify pgrst, 'reload schema'`. Se puede hacer con mixes en vivo: solo reemplaza una función de lectura con la misma firma, y la API de ahora ignora la clave nueva.
2. **API:** `deploy/vps/desplegar.sh api` desde `main`, sin salas del matchmaking armándose (reinicia `cmleague-api`). Despliega también el manual.
3. **Web:** `deploy/vps/desplegar.sh web` desde `main`.
4. Comprobar `https://<web>/widget?id=<una ficha con foto>&bg=1`, y lo mismo con `&h=photo`.
5. Publicar `CHANGELOG_DISCORD.txt`.

Vuelta atrás: la inversa de la `111`. Con la base vuelta atrás, la API nueva falla en `WidgetData.parse` (falta `photo_url`), así que se vuelve atrás primero la web y la API.

## Pruebas

### Base local (`pruebas/probar_111.sh`, en una transacción que se deshace)

| # | Prueba | Resultado |
|---|---|---|
| 1 | Ficha con foto: `photo_url` es la de la ficha | ok |
| 2 | Ficha sin foto: la clave está y es null | ok |
| 3 | Siguen las claves del 110 (`nick`, `period`, `ultimos`) | ok |
| 4 | Ficha inexistente: null | ok |
| 5 | Aplicarla dos veces no rompe | ok |
| 6 | La inversa saca `photo_url` | ok |

### API

- `test/integration/widget.test.ts`: 5 de 5, con la `111` aplicada en la base local.
- 596 pruebas unitarias, `pnpm typecheck` y `pnpm build` (manual: 56 páginas).

### Web

- 733 pruebas (122 archivos), `tsc -b` y `eslint` sin errores.
- `StreamWidget.test.tsx`: de fábrica la inicial dentro del anillo y el nivel en la pastilla; con `photo` oculta el anillo con el número; con `level` oculto solo la foto; con las dos, nada; y la foto en los seis diseños.
- En el navegador (`/demo/widget` con `vite` y Playwright): Mini, Barra y Stats con la foto prendida y apagada. Con la foto apagada se ve igual que antes. No se probó con una foto real (la demo no tiene) ni en OBS.
