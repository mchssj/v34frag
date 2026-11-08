# Ajustes después del primer matchmaking: guía de implementación

## Estado

**Implementado y probado en local, y desplegado en staging el 2026-11-02, sin commit** (ver "Despliegue en staging"). No se miró en el navegador.

| Parte | Pruebas |
|---|---|
| Base (`53`, `54` y `55`) | 15 comprobaciones SQL y las inversas, en una transacción que se deshace (`pruebas/correr_local.sh`). La base local quedó intacta |
| API | Typecheck limpio; 403 pruebas unitarias en verde, 7 nuevas (`mm-mvp-image.test.ts`) |
| Web | Typecheck y lint limpios; 485 pruebas en verde, 14 nuevas (`BackButton`, `MixHighlights`, `queries.test.tsx` y la imagen en `AdminMatchmaking.test.tsx`) |

## Ramas

- **Base y API:** `feat/mm-claim-en-sala`, en el worktree `E:\Css V34 Web\v34frag-mmclaim`. Se instalaron las dependencias del backend ahí (`pnpm install --frozen-lockfile`).
- **Web y bitácora:** `feat/frontend-fase-1`.

## Cambios respecto del plan

- **Rendimiento:** el plan decía "no repetir el pedido justo después de una acción propia". La primera versión usaba una ventana fija de 800 ms, que también demoraba los cambios del otro jugador (lo detectaron las pruebas de `PlayPage`). Quedó una regla sin tiempos: si la respuesta de la acción llegó después del último aviso, ya lo trae. El aviso sale al confirmar en la base, antes de que la API arme el estado.
- **`BackButton`** no usa `useCanGoBack` del router: lee el índice del historial con `useRouter({ warn: false })`, porque las pruebas existentes simulan `Link` sin montar un router.
- **`/match/<serie mm>`** redirige al mapa jugado, para los links viejos (notificaciones). No estaba en el plan.
- **Foto de cada jugador (replanteo `55`):** pedido por Daniel después del plan, en la misma tanda.
- **Las vistas sin cambios:** `FindTeam` (su flecha es un paso interno) y la sala del matchmaking (tiene su botón de cerrar).

## Pasos de despliegue

1. **Staging, base:** aplicar `53`, `54` y `55` en `edaljnirzvisiaathitt`, con `psql -v ON_ERROR_STOP=1 -f`. La `53` aborta si la vista no termina como se espera.
2. **Staging, API:** la API de staging se arma juntando la línea del matchmaking con `feat/backend-api-fase-1`. Hay que volver a armarla con `feat/mm-claim-en-sala` (bitácora `2026-11-01-pagina-serie`) y `deploy/vps/desplegar.sh api`.
3. **Staging, web:** `deploy/vps/desplegar.sh web`.
4. **Imagen:** subirla en Administración › Matchmaking › General.
5. **Producción:** con el corte, junto con la `48`.

## Despliegue en staging (2026-11-02, pedido por Daniel)

1. **Base** (`edaljnirzvisiaathitt`): `53`, `54` y `55` aplicadas sin errores, con `psql -v ON_ERROR_STOP=1 -f`. Verificado:
   - `match_list` sin filas `mm`, con `security_invoker` y con el mix del 1v1.
   - `mm_config.mvp_image_url` creada, y `mm_lobby_json`, `mm_player_card` y `mm_my_state` con sus cambios.
   - `mm_admin_set_mvp_image` para `authenticated` y `mm_mvp_image` no para `anon`.
   - Las tarjetas de kyan y kyantares ya traen foto.
2. **API `8e78f7650291-local11021850`:**
   - **Cómo se armó:** una rama temporal local (`tmp/staging-api-1102`) con `feat/mm-claim-en-sala` (`7338f865`) más `feat/backend-api-fase-1` (`240e2694`), y encima `mm.ts` y su prueba, sin commit.
   - **Qué entró de `feat/backend-api-fase-1`:** desde la versión anterior de staging solo trae la migración `vip_dias`, sin código de la API.
   - **Conflictos:** documentación, relay del HUD y plugin. Se resolvieron con la versión del matchmaking; ninguno es de la API.
   - **Pruebas:** typecheck limpio y 404 pruebas unitarias.
   - **Después:** se borraron la rama y la carpeta temporales.
   - **Verificado en la API pública:**
     - `GET /api/v1/mm/mvp-image` responde `{"url": null}`.
     - `/mm/state` trae la foto de kyan y `mvp_image_url` en la sala.
     - Partidas solo tiene `mix` (43).
     - `PUT /api/v1/admin/mm/mvp-image` da 403 a un usuario común.
3. **Web `7f7ca3e0f8f4-local11021851`:** desde `feat/frontend-fase-1` con los cambios sin commit, que incluyen también [`2026-11-02-ocultar-palmares-pcw`](../2026-11-02-ocultar-palmares-pcw/). En el VPS, el bundle tiene "Imagen del MVP", "Lo más destacado de la partida", "Pronto" y `mm/mvp-image`, y no tiene `hall-of-fame`.
4. **Falta:** subir la imagen del MVP en Administración › Matchmaking › General, mirarlo en el navegador y hacer el commit.

**Contexto de kyan (en `kyan/pruebas`, 2026-11-02):** puso la 2.7.4 en el #1 (MVZG) en lugar de la 2.8.2 y apagó el matchmaking ahí y en flow. Desde ahora el matchmaking se prueba en `aurav34` (el #3), con la 2.8.4 (la 2.8.2 más la charla nueva del medio tiempo; bitácora `2026-11-02-servidor-pruebas-mm` en su rama).

## Incidentes

- **La imagen del MVP no se guardaba en staging (2026-11-02, código de seguimiento `fe373ca6-…`).** La API la validaba y la subía bien, pero `mm_admin_set_mvp_image` respondía "UPDATE requires a WHERE clause": staging carga `pg_safeupdate` para PostgREST y la función hacía un `UPDATE mm_config` sin `WHERE`. La API borraba la imagen subida y respondía 500 ("Algo salió mal"). Es el mismo error que tuvo `mm_set_config` el 2026-11-01. Las pruebas locales no lo vieron porque la base local no carga `pg_safeupdate`. Corrección: replanteo `62` (`where id = 1`), probado con `pruebas/62_correr_local.sh`, que sí lo carga. **Aplicado en staging el 2026-11-02** con `psql -v ON_ERROR_STOP=1`. Verificado: la función tiene el `where id = 1`, es de `authenticated` y no de `anon`, y `DELETE /api/v1/admin/mm/mvp-image` con `adminprueba` responde 200 (pasa por el mismo `UPDATE`). La API y la web no cambian.
