# Ver y levantar las sanciones automáticas del matchmaking: guía de implementación

## Estado

**Implementado y probado en local el 2026-11-02, sin commit y sin desplegar en staging.** El plugin no cambia: no hay nada que subir a los servidores #1, #2 (flow) ni #3.

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

## Despliegue en staging (pendiente)

Sin salas abiertas ni nadie en la cola:

1. **Base:** aplicar `61_mm_sanciones_admin.sql` en la Supabase de staging. Verificar:
   - existe `mm_penalty_log.lifted_at`;
   - `mm_admin_lift_penalty` es de `authenticated` y no de `anon`;
   - `select mm_admin_lists('penalties')` como moderador responde una lista.
2. **API:** desde `feat/mm-claim-en-sala`, con `deploy/vps/desplegar.sh`.
3. **Web:** desde una carpeta limpia de `feat/frontend-fase-1`, con `deploy/vps/desplegar.sh`.
4. **Prueba:** con una cuenta de prueba, buscar partida y no aceptar. Verla en la tarjeta, levantarla con `adminprueba` y comprobar que puede volver a buscar sin recargar.

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

- **El motivo del registro:** la respuesta anterior a Daniel decía que hacía falta una columna nueva. No hacía falta: el motivo ya estaba en `mm_penalty_log`. El plan ya lo corregía.
- **Orden de las faltas:** para tomar la última se ordena por `created_at` y después por `id`. Dos faltas en la misma transacción tienen la misma hora; se vio en las pruebas.
- **El aviso `penalty.lifted`:** es un tipo nuevo. La web ya pedía todo ante un aviso desconocido, pero se le agregó una rama propia para que quede claro.

## Cómo revertir

1. **Base:** aplicar `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/61_mm_sanciones_admin.sql`. Las sanciones ya levantadas quedan levantadas.
2. **API y web:** revertir los commits y volver a desplegar.
