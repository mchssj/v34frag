# Tierlists de jugadores y equipos: guía de implementación

## Estado

Probado en local el 2026-11-22: la base local con la `137`, la API y la web. **Pendiente de commit y de despliegue** (la `137` en producción, la API y la web).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/137_tierlists.sql` | Nuevo: tablas, funciones, permisos y los avisos en `friends` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/137_tierlists.sql` | Nuevo: la inversa (borra todas las tierlists) |
| `supabase/replanteo/README.md` | Fila de la `137` |
| `web/backend/src/routes/tierlists.ts` | Nuevo: las rutas |
| `web/backend/src/app.ts` | Monta `tierlists` antes que `players` |
| `web/backend/src/schemas/bans.ts` | `SUPPORT_ACTIONS` suma `tierlist_comment_delete` y `tierlist_report` |
| `web/backend/test/integration/tierlists.test.ts` | Nuevo: 7 pruebas contra la base local |
| `web/frontend/src/api/schema.d.ts` | Regenerado desde la OpenAPI (solo agrega) |
| `web/frontend/src/routeTree.gen.ts` | Regenerado (ruta `/tierlists/$id`) |
| `web/frontend/src/routes/_app/tierlists.$id.tsx` | Nuevo |
| `web/frontend/src/features/tierlists/**` | Nuevo: consultas, tablero, editor, comentarios, imagen, página y `board.test.ts` |
| `web/frontend/src/features/player/components/tabs/TierlistsTab.tsx` | Nuevo: la pestaña del perfil |
| `web/frontend/src/features/player/components/PlayerTabs.tsx`, `lib/search.ts` | La pestaña **Tierlists** con su contador |
| `web/frontend/src/features/player/components/CommentReportDialog.tsx` | `title` opcional, para denunciar una tierlist |
| `web/frontend/src/features/admin/bans/components/TierlistReportsPanel.tsx` | Nuevo: la cola de denuncias |
| `web/frontend/src/features/admin/bans/pages/AdminBansPage.tsx`, `lib/search.ts`, `lib/support.ts` | Pestaña **Tierlists** y los textos de la actividad del soporte |
| `web/frontend/src/features/shell/notifications/lib/model.ts` y `model.test.ts` | Los tres avisos nuevos |
| `web/frontend/src/features/shell/lib/nav.ts`, `nav.test.ts`, `api/queries.ts`, `components/Topbar.tsx` | La ruta de arriba de una tierlist (con el link al perfil del autor) y Ranking marcado en el sidebar |
| `web/frontend/src/features/legal/**`, `terms/terminos.html`, `terms/privacidad.html` | Tierlists "En preparación" y fecha 22 de noviembre de 2026 |
| `docs/manual/jugador/tierlists.md` | Nueva |
| `docs/manual/jugador/notificaciones.md`, `moderador/borrar-comentarios.md`, `soporte/borrar-comentarios.md` | Tierlists |

## Despliegue (pendiente)

1. Commit en `main` (no es matchmaking: no va en `feat/mm-claim-en-sala`). El `schema.d.ts` y el `routeTree.gen.ts` regenerados van en el mismo commit.
2. Base de producción (VPS, por el túnel de `PG_*`): aplicar `supabase/replanteo/137_tierlists.sql` con `psql -v ON_ERROR_STOP=1`. Aborta sola si ya se aplicó o si falta la `94` o la `117`.
3. API y web, con el despliegue de siempre del VPS.
4. Después de desplegar: sacar la marca "En preparación" de las tierlists en términos y privacidad (web y `.html`), en un commit aparte.
5. Mandar `CHANGELOG_DISCORD.txt`.

No toca los servidores de juego (#1, #2, #3): no hay nada que subir por SFTP.

## Pruebas

### Base y API (Supabase local, 2026-11-22)

- `137` aplicada sola sobre la base local (sin `db:reset`). La inversa y una segunda aplicación también corren.
- `test/integration/tierlists.test.ts`, 7 de 7: crear con S a D, guardar, ver sin sesión; un jugador repetido (400) y otro que no es el dueño (403); tope de 10 al crear y al copiar; copiar con crédito y no la propia; una sola destacada; me gusta no propio y un solo aviso; comentario, respuesta, no responder una respuesta, borrado con respuestas, `total`/`threads` y comentarios cerrados; denuncia, cola de moderación (403 para un jugador) y borrar la tierlist dejando la denuncia.
- `notifications.test.ts` y `bans.test.ts` siguen pasando. Unitarias del backend: 684 de 684.

### Web

- `pnpm typecheck` y `eslint` sin errores. Vitest: 844 de 844 (con `board.test.ts`, 6 pruebas del tablero).
- Navegador (Playwright contra la web y la API locales, cuentas de prueba creadas para esto):
  - Escritorio, 1440 px: la pestaña **Tierlists** del perfil con la destacada y "Ver otras tierlists", la página de la tierlist, **Descargar imagen** (JPEG correcto), el editor (arrastrar de "Sin clasificar" a un tier, el menú "⋮" para mover, **Guardar**).
  - Teléfono (iPhone 13): me gusta y sacarlo, un solo **Responder** (las respuestas no tienen), la regla de 30 s entre comentarios, denunciar, **Copiar** (abre el editor de la copia) y el menú "⋮".
  - Sin errores de JavaScript en la consola.

## En qué se apartó del plan

- Pedido de Daniel al probar (2026-11-22): flecha de volver en el editor y la ruta de arriba (Ranking › autor › tierlist) en las páginas de tierlists.
- Pedido de Daniel al probar (2026-11-22): una tierlist nueva trae en el banco las 30 primeras fichas del ranking (o los 10 primeros equipos), y en el buscador toda la fila del resultado agrega, no solo el botón de la derecha.
- La migración es la `137` y no la `134` del plan: mientras se implementaba, la `134` (`134_nick_de_la_web.sql`), la `135` y la `136` ya estaban tomadas.
- `tierlists.owner` (la cuenta) además de `player_id` (la ficha): así se borran con la cuenta aunque la ficha quede.
- `tierlist_reports` guarda el texto denunciado (`snapshot`) y de quién era, y sus referencias pasan a null al borrar, para que la denuncia quede después de borrar la tierlist.
- `tierlist_comments_list` suma `threads` (los comentarios que se paginan, sin las respuestas). Con solo `total`, "Ver más" aparecía aunque no hubiera más.
- Los equipos que entran son los que no son bandos de PCW (oficiales e históricos); el buscador de la web busca los oficiales.
- El soporte también borra comentarios de tierlists y resuelve sus denuncias, como en los perfiles (replanteo `117`), con dos acciones nuevas en su actividad.
- El autor de un comentario no tiene nombre propio en la OpenAPI: con nombre y `nullable`, `openapi-typescript` lo tipaba mal.

## Incidentes durante las pruebas

- Una prueba esperaba el nick de la ficha creada a mano y la base lo reemplaza por el alias de la cuenta. Se corrigió la prueba.
- La extensión de Chrome no estaba conectada: la prueba en el navegador se hizo con Playwright.

## Cómo revertir

1. Web y API: volver al commit anterior y desplegar.
2. Base: `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/137_tierlists.sql` (después de la API). **Borra todas las tierlists, sus comentarios y sus avisos.**
