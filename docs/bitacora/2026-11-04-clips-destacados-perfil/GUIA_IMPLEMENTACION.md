# Clips destacados en el perfil y rechazar un clip: guía de implementación

## Estado

Hecho y probado en local el 2026-11-05 (la base con la copia de producción, la API y la web). **Commiteado el 2026-11-05 en `feat/frontend-fase-1`** y **Desplegado el 2026-11-06 (13:04-13:20 UTC)** desde `main` (`73d0e92e`), sin salas ni mixes en curso (la cola vacía; el #1 sin jugadores). Va solo en esa rama: no es del matchmaking. El commit no lleva los reemplazos (replanteo `75`), que siguen sin commitear en el mismo árbol.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/76_clips_destacados_y_rechazo.sql` | Nuevo |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/76_clips_destacados_y_rechazo.sql` | Nueva: inversa |
| `supabase/replanteo/README.md` | Fila de la `76` |
| `pruebas/prueba_76.sql`, `probar_76.sh` | Pruebas de la base |
| `web/backend/src/routes/clips.ts`, `src/schemas/clips.ts` | Rutas de Mi Perfil, la ficha, rechazar y recuperar; topes en la configuración; filtro de rechazados |
| `web/backend/src/db/types.ts` | A mano: `clip_config.featured_*`, las columnas del rechazo y `match_clip_ranked` (no se regenera: la base local tiene cosas de otras ramas) |
| `web/backend/src/lib/manual.ts` | Marcadores `clips.destacados` y `clips.destacados_vip` |
| `web/backend/test/unit/clips-featured.test.ts` | Nuevo: 12 pruebas |
| `web/frontend/src/api/schema.d.ts` | Regenerado (`pnpm gen:api`) con la API sin las rutas de los reemplazos |
| `web/frontend/src/features/profile/...`, `routes/_app/profile.clips.tsx`, `routeTree.gen.ts` | Mi perfil › Clips |
| `web/frontend/src/features/player/...` | Pestaña Clips de la ficha |
| `web/frontend/src/features/admin/clips/...` | Rechazar, Rechazados, Recuperar y los topes |
| `docs/manual/...`, `terms/terminos.html`, `TermsPage.tsx` | Manual y términos |
| `PLAN.md` | Las decisiones del 2026-11-05 (modo automático y rechazo), antes de implementar |

## Despliegue (hecho el 2026-11-06)

La `76` desde `main` (antes, `probar_76.sh` contra producción: 31 comprobaciones y la inversa), y la API y la web `73d0e92edcb8`. La ficha devuelve los destacados en automático.

Los pasos:

1. **Base del VPS:** `76_clips_destacados_y_rechazo.sql`, después de la `75` (o antes, no dependen entre sí). Desde el archivo commiteado (LF): cargado desde Windows con CRLF, el `\r` queda dentro de las funciones (ver Incidentes). Antes, `probar_76.sh` contra la base por el túnel.
2. **API y web**, juntas: la web nueva llama a rutas que la API vieja no tiene.
3. Nada en el render: la papelera de los rechazados ya la vacía su vuelta de la noche.

## Pruebas

### Base (Supabase local con la copia de producción del 2026-11-05)

- `probar_76.sh docker`: **31 comprobaciones** y la inversa en una transacción con rollback. `match_clip_list` tiene las mismas filas al aplicar; la inversa deja `match_clip_list`, `clip_archive_due` y `manual_valores` idénticas (md5). Cubre: automático (los 3 mejores en el orden de la escala, en Mi Perfil y en la ficha), manual en su orden, el tope (`V3901`), un clip ajeno, uno repetido, VIP (tope 10) y sin VIP (se ven los 3 primeros), el archivo de la noche (no se lleva un destacado y sí uno que dejó de serlo), rechazar (solo admin, sale de la lista, el ranking de la partida no cambia ni entra otro, el video a la papelera, deja de ser destacado, no se puede reprocesar ni rechazar dos veces, no está para Discord), recuperar (sin demo no; con demo vuelve a la cola para revisar en su puesto), los topes (solo admin, de 1 a 50), el manual y los permisos.

### API

- `pnpm test`: 40 archivos, **543 pruebas** (12 nuevas). `pnpm typecheck` sin errores.

### Web

- `vitest run`: 101 archivos, **621 pruebas** (Mi Perfil › Clips: automático, elegir con tope y guardar, vacío; la ficha: la pestaña aparece y no; Administración: rechazar con motivo y Rechazados con Recuperar). `tsc -b`, `eslint` y Prettier sin errores.
- No se probó con datos reales en el navegador.

## En qué se apartó del plan

- **Modo automático** (pedido de Daniel con el diseño): el plan solo tenía los elegidos.
- **Rechazar un clip** (pedido de Daniel el 2026-11-05) entró en este mismo requerimiento.
- **Sin la vuelta a R2 desde Drive:** un destacado que ya salió de R2 se ve con el reproductor de Drive, como cualquier clip viejo. Solo se deja de archivar mientras esté destacado. No hay cambios en `render/` ni el "Preparando el video" del diseño.
- **La privacidad no cambia:** no menciona los 15 días en R2.
- **La ruta de la ficha es por id** (no por nick, como las demás de `/players/{id}`).
- **Rechazar lo hace un admin**, como reprocesar (no los moderadores).

## Incidentes durante las pruebas

- **Se corrió la suite de integración sobre la copia local** (`pnpm exec vitest run` sin `--project unit`): borró las temporadas, recalculó el ELO y sembró 49 partidas y 169 cuentas de prueba. Solo la base local. Se restauró con el respaldo que dejó la prueba con bots de los reemplazos (`/tmp/antes_e2e75.dump` en el contenedor), después de sacar la `76` con su inversa (si no, `pg_restore` falla entero por las dependencias de las vistas). Quedó anotado en la memoria del proyecto.
- **CRLF:** con `core.autocrlf=true`, los archivos están en CRLF en el disco de Windows. Cargados directo con `psql`, el `\r` queda en el cuerpo de las funciones nuevas (y el md5 de la inversa no coincide). Las pruebas lo sacan (`tr -d '\r'`); en la base local se volvieron a cargar la `75` y la `76` así, y no quedó ninguna función con `\r`.
- `grep $'\r'` de Git Bash no ve los `\r`: para revisarlo, `file`.

## Cómo revertir

- **Base:** la inversa de la `76` (se pierden las preferencias y los elegidos; los rechazados vuelven a mostrarse y a la cola del render).
- **API y web:** revert del commit y desplegar.
