# Guardar el widget para streamers en la cuenta: guía de implementación

## Estado

**Desplegado** desde `main` (commit `f97a565a`) el 2026-11-11. **Falta** probar el diálogo con una cuenta real.

- **La `112`:** antes, `probar_112.sql` contra producción pasó 9 de 9 y se deshizo. Aplicada a las ~16:50 UTC, con `notify pgrst, 'reload schema'`, sin salas del matchmaking activas. Verificado: existen `widget_settings` y `widget_save`, `widget_player` devuelve `settings` y `anon` no puede ejecutar `widget_save`.
- **La API y la web `f97a565a104e`:** desplegadas a las 16:53 y 16:55 UTC.
- **Comprobado en producción:**
  - `GET /api/v1/players/{id}/widget` sin período: `200` con `settings` null; con `since` sin período, `200`; con `period=all&since`, `400`.
  - `PUT /api/v1/me/widget` sin sesión: `401`.
  - `/widget?id=…` (sin nada guardado) muestra lo de fábrica, y una URL de antes (`&d=barra&v=historico&a=00b4ff`) se ve como siempre. Sin errores en la consola.
- La `112` también quedó aplicada en la base local.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/112_widget_guardar.sql` | Nuevo: tabla `widget_settings` (RLS, lectura pública), `widget_save(texto)` y `widget_player` con `settings` y período guardado |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/112_widget_guardar.sql` | Nuevo: borra `widget_save`, vuelve `widget_player` al 111 y borra la tabla |
| `supabase/replanteo/README.md` | Fila de la `112` |
| `web/backend/src/schemas/players.ts` | `period` opcional, `since` sin período, `settings`, `WidgetSaveBody` y `WidgetSaved` |
| `web/backend/src/routes/players.ts` | `p_period` null cuando no viene |
| `web/backend/src/routes/account.ts` | `PUT /api/v1/me/widget` |
| `web/backend/src/db/types.ts` | `widget_save` y `p_period` null, a mano |
| `web/backend/test/integration/widget.test.ts` | Prueba nueva de guardar |
| `web/frontend/src/api/schema.d.ts` | Regenerado con `pnpm gen:api` contra la API local: solo cambia lo del widget |
| `web/frontend/src/features/widget/options.ts` | `optionsQuery`, `widgetUrl` sobre `optionsQuery`, `savedWidgetUrl` y `mergeOptions` |
| `web/frontend/src/features/widget/api.ts` | `WidgetResponse`, período `null`, `widgetKeys.all` y `saveWidget` |
| `web/frontend/src/features/widget/WidgetPage.tsx` | Lo guardado con la URL encima |
| `web/frontend/src/features/widget/WidgetCard.tsx` | El diálogo: abre con lo guardado, **Guardar**, "Cambios sin guardar", confirmación al cerrar y URL fija |
| `web/frontend/src/features/widget/WidgetCustomizer.tsx` | `WidgetPreview` con `hint` |
| `web/frontend/src/features/widget/*.test.*` | Pruebas de guardar, de la URL fija y de unir lo guardado con la URL |
| `web/frontend/src/features/legal/pages/PrivacyPage.tsx`, `lib/meta.ts`, `terms/privacidad.html` y `terms/terminos.html` | La configuración del widget en "Lo que subes o escribes" y la fecha |
| `docs/manual/jugador/widget-para-stream.md` | Guardar, la URL fija y las URLs de antes |

## En qué se apartó del plan

- `widget_save` le quita la ejecución a `anon` de forma explícita (`revoke … from public, anon`): Supabase se la da por defecto a las funciones nuevas, y la prueba 2 lo mostró.
- El diálogo pide confirmación al cerrar con cambios sin guardar (no estaba en el plan).

## Despliegue

Ninguna parte toca los servidores de juego.

1. **Base:** `pruebas/probar_112.sql` contra producción (se deshace solo). Después, aplicar la `112` y `notify pgrst, 'reload schema'`. Se puede hacer con mixes en vivo. La API de ahora sigue andando con la base nueva: siempre manda un período e ignora `settings`.
2. **API:** `deploy/vps/desplegar.sh api` desde `main`, sin salas del matchmaking armándose.
3. **Web:** `deploy/vps/desplegar.sh web` desde `main`.
4. Comprobar `GET /api/v1/players/{id}/widget` (trae `settings`) y abrir el diálogo en Mi perfil › Cuenta con una cuenta con ficha.
5. Publicar `CHANGELOG_DISCORD.txt`.

Vuelta atrás: primero la web y la API, después la inversa de la `112` (borra lo que guardaron los jugadores).

## Pruebas

### Base local (`pruebas/probar_112.sh`, en una transacción que se deshace)

| # | Prueba | Resultado |
|---|---|---|
| 1 | Sin nada guardado: `settings` null, período hoy y sigue `photo_url` | ok |
| 2 | `anon` no puede llamar a `widget_save` | ok |
| 3 | Cuenta sin ficha: error "necesitas tu ficha de jugador vinculada" | ok |
| 4 | El dueño guarda y vuelve a guardar: una sola fila | ok |
| 5 | Rechaza `<`, `>` y más de 600 caracteres | ok |
| 6 | Sin escritura directa en la tabla | ok |
| 7 | Como `anon`: lee `settings`; sin período usa el guardado (histórico cuenta un mix de hace 3 días) y con período, el pedido | ok |
| 8 | Borrar la ficha borra su configuración | ok |
| 9 | La inversa vuelve al 111 | ok |

### API

- `test/integration/widget.test.ts`: 6 de 6. La nueva: `settings` null sin guardar; `401` sin sesión; `400` sin ficha (con el mensaje) y con texto inválido; el dueño guarda; sin período devuelve lo guardado.
- 596 pruebas unitarias, `pnpm typecheck` y `pnpm build` (manual: 56 páginas).

### Web

- 737 pruebas (122 archivos), `tsc -b` y `eslint` sin errores. Nuevas o cambiadas:
  - el diálogo abre con lo guardado (sin período en la consulta), la URL es fija, **Guardar** manda `d=barra&v=historico` y deja de decir "Cambios sin guardar";
  - cerrar con cambios pide confirmación;
  - `/widget?id=…` usa lo guardado y la URL gana opción por opción;
  - `optionsQuery`, `savedWidgetUrl` y `mergeOptions`.
- **De punta a punta en local** (API con `wrangler dev`, web con `vite` y la base local): con una configuración guardada en una ficha real, `/widget?id=…` dibuja la Barra, con Histórico, el color y la frase guardados; con `&d=stats&v=hoy`, el diseño y el período de la URL, con el color y la frase guardados. Sin errores en la consola. El diálogo con una sesión real no se probó en el navegador (sí con las pruebas de la web y de la API).
