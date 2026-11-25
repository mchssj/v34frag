# Comparador de hasta 5 jugadores y partidas favoritas para VIP: guía de implementación

## Estado

Hecho y probado en local (2026-11-24), en el worktree de `main`, **sin commit ni despliegue**. Se despliega junto con [`2026-11-24-exportar-stats-y-buscador-vip`](../2026-11-24-exportar-stats-y-buscador-vip/) y [`2026-11-24-desglose-elo-vip`](../2026-11-24-desglose-elo-vip/): comparten rutas y archivos.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/140_partidas_favoritas.sql` y su inversa en `reversas/` | Nuevos |
| `web/backend/src/routes/vip-extras.ts` | Nuevo: las rutas de los tres requerimientos |
| `web/backend/src/app.ts` | Monta `vipExtras` |
| `web/backend/src/services/vip.ts` | `requireVip` |
| `web/backend/src/routes/ranking.ts`, `schemas/players.ts` | Comparador de hasta 5 |
| `web/backend/src/routes/matches.ts`, `schemas/matches.ts` | `favorites`, `favorite` y los filtros avanzados |
| `web/backend/test/integration/vip-extras.test.ts` | Nuevo: 15 pruebas |
| `web/frontend/src/api/schema.d.ts`, `routeTree.gen.ts` | Regenerados |
| `web/frontend/src/features/ranking/**` | Comparador y sus pruebas |
| `web/frontend/src/features/matches/**` | Estrella, filtro **Favoritas** y sus pruebas |
| `web/frontend/src/features/vip/useVip.ts`, `VipLock.tsx` | Nuevos |
| `docs/manual/jugador/comparar-jugadores.md`, `partidas-favoritas.md` | Nuevas |
| `terms/*.html`, `web/frontend/src/features/legal/**` | Lo de "Términos y privacidad" de los tres |

## Despliegue (pendiente)

Los tres requerimientos juntos, en este orden. No toca los servidores de juego (#1, #2 y #3).

1. Base: `140`, `141` y `142`, en ese orden, con `lock_timeout`. Solo crean cosas nuevas.

   ```bash
   for f in 140_partidas_favoritas 141_buscador_y_tarjeta 142_desglose_de_elo; do
     (echo "set lock_timeout = '5s';"; cat supabase/replanteo/$f.sql) | ssh ubuntu@<VPS> "sudo docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 -q" || break
   done
   ```

2. API y después web (`deploy/vps/desplegar.sh api` y `desplegar.sh web`), desde un worktree limpio en el commit. La API va antes: la web nueva usa `others` y `favorite`.
3. Publicar `terms/terminos.html`, `terms/privacidad.html` y los changelog.

**Ojo con el commit:** hay cambios sin commit de otros requerimientos en los mismos archivos (legales, `docs/PENDIENTES.md`, `docs/bitacora/README.md` y `supabase/replanteo/README.md`).

## Pruebas

### Base (copia local de producción)

[`pruebas/vip_140_142.sql`](pruebas/vip_140_142.sql), con rollback: 30 de 30, para las tres migraciones. Cada una se aplicó, se deshizo con su inversa y se volvió a aplicar. Quedaron aplicadas en la base local.

### API

- `test/integration/vip-extras.test.ts`: 15 de 15 contra la Supabase local.
- Unitarias: 684 de 684. `tsc` sin errores.

### Web

- Vitest: 871 de 871 (antes de los últimos ajustes de textos y colores; después se repitieron las 201 de los módulos tocados). `tsc` y `eslint` sin errores.
- **Navegador** (Playwright, web y API locales, cuenta VIP de la copia):
  - Comparador con 5, agregar con clic y sacar: la URL y los colores quedan bien. En claro, oscuro y a 390 px.
  - Estrella: marca sin abrir la partida, aparece en **Favoritas** y se saca.
  - Sin VIP (la respuesta del perfil, cambiada en la prueba): se comparan los dos primeros y el candado abre "Cómo ser VIP".
  - Sin errores en la consola ni de la API.
- La base local quedó sin favoritas ni búsquedas de la prueba.

## En qué se apartó del plan

- **Con 3 a 5 jugadores**, la barra del que no gana va en gris claro y no en el color oscuro de las filas de dos lados: en modo claro pesaba más que la del ganador.

## Cómo revertir

1. Volver la web y después la API a la versión anterior.
2. Inversas, en orden: `142`, `141` y `140` (`docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/`). La `140` borra las favoritas y la `141` las búsquedas guardadas.
