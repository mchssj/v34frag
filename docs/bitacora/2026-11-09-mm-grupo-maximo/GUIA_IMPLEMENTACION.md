# Bajar el tamaño máximo del grupo desarma los grupos que no entran: guía de implementación

## Estado

Probado en local el 2026-11-09: la `105` está aplicada en la base local (copia de producción) y pasó 5 de 5. La web pasó typecheck, lint y 712 pruebas. **Falta el commit, aplicar la `105` en producción y desplegar la web.**

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/105_mm_grupo_maximo.sql` | Nuevo: `mm_party_trim` y los bloques en `mm_set_config`, `mm_tick` y `mm_join` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/105_mm_grupo_maximo.sql` | Nueva: la inversa |
| `supabase/replanteo/README.md` | Fila de la `105` |
| `web/frontend/src/features/matchmaking/PartyMenu.tsx` | `noticePartyDisbanded`: el aviso y callar el "salió del grupo" |
| `web/frontend/src/features/matchmaking/PartyMenu.test.ts` | Nueva: 2 pruebas del aviso |
| `web/frontend/src/features/matchmaking/PlayPage.tsx`, `MatchAlerts.tsx` | Muestran el aviso con `party.disbanded` |
| `web/frontend/src/features/matchmaking/admin/GeneralForm.tsx` | El texto de la sección **Grupos** |
| `docs/manual/admin/matchmaking.md`, `docs/manual/jugador/buscar-partida.md` | Qué pasa al bajar el máximo |
| `docs/bitacora/2026-11-09-mm-grupo-maximo/` | Esta carpeta, con `pruebas/probar_105.sql` y `CHANGELOG_DISCORD.txt` |

La API no cambia: el socket reenvía cualquier tipo de aviso.

## Despliegue (pendiente)

1. **Commit** en `main`. Es base del matchmaking: la `105`, su inversa y la fila del README van también en `feat/frontend-fase-1` y `feat/mm-claim-en-sala`; la web, solo en `feat/frontend-fase-1`.
2. **Base:** aplicar la `105` en el VPS. No depende de ningún replanteo sin aplicar: se probó sin el `104` y sus anclas no son las del `104`, así que van en cualquier orden. Al aplicarla no se desarma nada (no llama a `mm_party_trim`), pero la primera vuelta de `mm_tick` sí: con el máximo en 2, no hay grupos de más de 2 (la invitación ya lo impedía), así que no cambia nada. No reinicia nada ni toca las salas.
3. **Web:** `deploy/vps/desplegar.sh web`, sin mixes en curso. Sin la web nueva, la base igual desarma los grupos; solo falta el aviso (el jugador ve "salió del grupo").

## Pruebas

### Base (`pruebas/probar_105.sql`, en la base local, en una transacción que se deshace)

5 de 5:

1. Con el máximo en 2 no cambia nada.
2. Un admin baja el máximo a 1 con `mm_set_config`:
   - desarma el grupo que no buscaba y el que estaba en la cola;
   - los de la cola salen con `closed`;
   - deja el grupo con alguien en una sala;
   - vence la invitación pendiente;
   - manda `party.disbanded` a los que corresponde, con `queued` bien, y no al de la sala.
3. `mm_join` rechaza el grupo de 2 con el máximo en 1.
4. Cuando la sala termina, `mm_party_trim` (lo que hace `mm_tick`) desarma ese grupo y le avisa.
5. Subir el máximo no desarma nada, y con 2 el chequeo nuevo de `mm_join` no frena a un dúo.

Los avisos se anotaron en una tabla temporal, reemplazando `mm_emit` dentro de la transacción.

También se probó la inversa: deja las tres funciones sin restos y borra `mm_party_trim`. La `105` se volvió a aplicar y no se deja aplicar dos veces.

### Web

- `PartyMenu.test.ts`: 2 de 2.
- Toda la web: typecheck, lint y 712 pruebas en verde.
- El manual: `test/unit/manual.test.ts` de la API, 21 de 21.

**Sin probar:** el aviso en un navegador con un grupo de verdad.

## En qué se apartó del plan

Ninguno.

## Incidentes durante las pruebas

La prueba 4 falló la primera vez porque esperaba exactamente un grupo desarmado y hubo dos. En la copia de producción hay un grupo real de 2 cuyos integrantes estaban en la sala que se usó para simular la partida en curso. El paso 2 lo dejó armado, que es lo correcto, y el 4 lo desarmó junto con el de la prueba. La prueba ahora pide "al menos uno".

## Cómo revertir

1. Base: `reversas/105_mm_grupo_maximo.sql`. Los grupos que se desarmaron no vuelven.
2. Web: revertir el commit y desplegar. La web vieja ignora `party.disbanded`.
