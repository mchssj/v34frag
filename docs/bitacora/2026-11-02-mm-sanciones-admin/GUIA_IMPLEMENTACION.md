# Ver y levantar las sanciones automáticas del matchmaking: guía de implementación

## Estado

**En staging desde el 2026-11-02, con commit** (base, API y web). El plugin no cambia: no hay nada que subir a los servidores #1, #2 (flow) ni #3.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/61_mm_sanciones_admin.sql` (`feat/mm-claim-en-sala`) | Nuevo: columnas del registro, `mm_admin_lists('penalties')` y `mm_admin_lift_penalty` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/61_mm_sanciones_admin.sql` (misma rama) | Nuevo: la inversa |
| `supabase/replanteo/README.md` (misma rama) | Fila de la `61` |
| `web/backend/src/routes/mm.ts` (misma rama) | `GET /admin/mm/penalties` y `POST /admin/mm/penalties/{id}/lift` (esquema `MmPenaltyLift`) |
| `web/backend/test/unit/mm-penalties.test.ts` (misma rama) | Nuevo: 8 pruebas |
| `web/frontend/src/features/matchmaking/types.ts` | `MmAdminPenalty` |
| `web/frontend/src/features/matchmaking/source.ts` | `adminPenalties` y `liftPenalty` |
| `web/frontend/src/features/matchmaking/demo.ts` | Las dos en la demo, con una sanción de ejemplo |
| `web/frontend/src/features/matchmaking/queries.ts` | `adminPenaltiesOptions` y `penalty.lifted` en `applyMmEvent` |
| `web/frontend/src/features/matchmaking/admin/ReportsPanel.tsx` | Tarjeta **Sanciones de la cola** con el diálogo de motivo |
| `web/frontend/src/features/matchmaking/admin/AdminMatchmaking.test.tsx` | 2 pruebas nuevas. La de exclusiones ahora busca **Levantar** dentro de su fila |
| `web/frontend/src/features/matchmaking/queries.test.tsx` | 1 prueba nueva |
| `docs/manual/moderador/sanciones-matchmaking.md` | Nueva |
| `docs/manual/jugador/buscar-partida.md` | Un párrafo en "Sanciones" |

## Despliegue en staging (hecho el 2026-11-02)

Commits: `c85500d6` en `feat/mm-claim-en-sala` (base y API) y `98d9eb1d` en `feat/frontend-fase-1` (web).

1. **Base:** `61` aplicada en staging con `psql -v ON_ERROR_STOP=1`. Verificado:
   - existen las 3 columnas de `mm_penalty_log`;
   - `mm_admin_lift_penalty` es de `authenticated` y no de `anon`;
   - `mm_admin_lists` tiene la rama `penalties`.
2. **API `7e5ab1c44a48`:** merge temporal "tmp: API de staging", armado en el worktree limpio `v34frag-deploy`, igual que el anterior (`42250685`): `feat/mm-claim-en-sala` (`eea18213`) con `feat/backend-api-fase-1` (`240e2694`).
   - Los conflictos estaban todos fuera de `web/backend` (bitácora, HUD y plugin) y se tomaron como en `42250685`.
   - `web/backend` quedó igual al desplegado más `mm.ts` y su prueba.
   - Pasaron 437 pruebas.
3. **Web `3d24324f0998`:** desde un checkout limpio de `feat/frontend-fase-1` en `v34frag-deploy`. Pasaron 518 pruebas.
   - En el primer intento falló por tiempo "en la sala: chat, reportar y desconexión de un compañero" (`PlayPage.test.tsx`): pasó de los 5 s con toda la suite en paralelo.
   - Sola tarda 2,7 s. En el segundo intento pasó.
4. **Prueba de punta a punta** con la cuenta `kyan` (sanción de prueba con `mm_penalize`) y `adminprueba` por la API:
   - la lista la muestra con nivel 2 de 4 y el motivo;
   - sin motivo responde 400;
   - levantar responde 200, deja el nivel en 1 y anota el motivo;
   - levantar otra vez responde 404 ("No tiene una sanción vigente").
   - Después se dejó a `kyan` como estaba: se borró la falta de prueba y se restauraron el nivel y las fechas.
   - **No se probó** el aviso `penalty.lifted` con `kyan` conectado a la web.

## Producción

Con el corte, junto con el resto del matchmaking.

## Pruebas (2026-11-02)

- **Base:** `bash pruebas/correr_local.sh "E:/Css V34 Web/v34frag-mmclaim"`, en una transacción que se deshace. Resultado: 20 comprobaciones y la inversa:
  - la lista trae solo las vigentes, con el motivo de la última falta, el nivel y el largo de la escalera;
  - un jugador común no lista ni levanta;
  - sin motivo, no se levanta;
  - levantar corta la espera, baja el nivel (2 → 1), anota esa falta y no otra, avisa solo al jugador, lo deja volver a la cola y lo saca de la lista;
  - la próxima falta sube desde el nivel nuevo (1 → 2);
  - sin sanción vigente, `P0002`;
  - un admin también puede, y el nivel no baja de 0;
  - `anon` no puede ejecutar la función.
- **API:** 448 pruebas (8 nuevas) y el typecheck. Las rutas se probaron con PostgREST simulado: permisos, motivo y el 404.
- **Web:** 533 pruebas, typecheck y lint.
- **No se probó contra staging** ni con el socket real.

## En qué se apartó del plan

- **Dónde se levantan (Daniel, 2026-11-02, después del primer despliegue):** el plan las ponía en Matchmaking › Reportes, pero Daniel las buscó en Administración › Baneos. Se movieron las dos tarjetas (sanciones de la cola y exclusiones) a una pestaña **Matchmaking** de Baneos (`SanctionsPanel.tsx`, `STATUS_TABS` con `mm`), con el contador de las vigentes. En Reportes queda un link. Solo cambia la web: 534 pruebas, typecheck y lint. Commit `b5ce9088` y **web `b5ce90880886` en staging (2026-11-02)**, desde un checkout limpio en `v34frag-deploy` (519 pruebas). Antes del cambio, `kyantares` ya había levantado la sanción de prueba de `daniloev` desde Reportes (03:06 UTC, nivel 2 → 1): el primer uso real.

- **El motivo del registro:** la respuesta anterior a Daniel decía que hacía falta una columna nueva. No hacía falta: el motivo ya estaba en `mm_penalty_log`. El plan ya lo corregía.
- **Orden de las faltas:** para tomar la última se ordena por `created_at` y después por `id`. Dos faltas en la misma transacción tienen la misma hora; se vio en las pruebas.
- **El aviso `penalty.lifted`:** es un tipo nuevo. La web ya pedía todo ante un aviso desconocido, pero se le agregó una rama propia para que quede claro.

## Cómo revertir

1. **Base:** aplicar `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/61_mm_sanciones_admin.sql`. Las sanciones ya levantadas quedan levantadas.
2. **API y web:** revertir los commits y volver a desplegar.
