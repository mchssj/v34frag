# Tierlists de jugadores y equipos: guía de implementación

## Estado

Desplegado el 2026-11-23 (UTC): la `137` en la base de producción y la API y la web en `c3803aa60c69`. Falta publicar el changelog (CMLeague 2.9.64).

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

## Despliegue (hecho el 2026-11-23, UTC)

1. Commits en `main`: `b8f830fa` (todo) y `c3803aa6` (sale "En preparación" de términos y privacidad y el changelog pasa a 2.9.64, porque la 2.9.62 y la 2.9.63 ya estaban usadas). Los archivos compartidos con otros pedidos sin commit (legales, `PENDIENTES.md` y los dos índices) se commitearon desde `HEAD` más lo de tierlists, sin los cambios ajenos.
2. Worktree limpio en `c3803aa6` (`v34frag-deploy`, porque en `main` había cambios sin commit de otros pedidos): `pnpm install --frozen-lockfile`, typecheck y pruebas (web 845 de 845, backend 684 de 684).
3. Base, desde la PC de Daniel, con un mix en vivo (la migración solo crea tablas y funciones y reemplaza `notification_category`, sin reiniciar nada):

   ```bash
   (echo "set lock_timeout = '5s';"; cat supabase/replanteo/137_tierlists.sql)      | /c/Windows/System32/OpenSSH/ssh.exe ubuntu@<VPS> "sudo docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 -q"
   ```

   Antes se comprobó que estaban la `135`, la `136`, `support_log`, `comment_blocked_word` y el texto que reemplaza en `notification_category`. Después: `tierlists` existe, 22 funciones `tierlist*` y los tres avisos en `friends`.
4. `deploy/vps/desplegar.sh api` y `desplegar.sh web` desde el worktree, con `VPS_HOST` del `.env` de `main`. `/api/health` respondió `c3803aa60c69`. Vuelta atrás: API y web `aaa8fe06c12b`.
5. Prueba sin sesión en producción: `/api/v1/tierlists/<id inexistente>` da 404 con "Esa tierlist no existe" y `/api/v1/players/<id>/tierlists` responde la lista vacía.

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

1. Web y API: volver a `aaa8fe06c12b` (las versiones anteriores quedan en el VPS) o desplegar un revert.
2. Base: `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/137_tierlists.sql` (después de la API). **Borra todas las tierlists, sus comentarios y sus avisos.**
