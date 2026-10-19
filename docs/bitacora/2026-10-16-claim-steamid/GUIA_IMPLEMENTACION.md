# Perfiles sin reclamar, `!claim` y varios SteamID por ficha: guía de implementación

## Estado

Daniel aprobó el plan el 2026-10-16, con todo en el ambiente local.

| Parte | Estado |
|---|---|
| Base (migración `15`) | Hecha y probada en local. **Sin commit y sin desplegar**: se aplica en el corte, después de la `14` y de la migración de ajustes de ELO |
| Backend | Hecho y probado en local. Sin commit |
| Plugin 2.1.0 (`!claim`) | **Hecho el 2026-10-18 como 2.2.0** (el 2.1.0 quedó para los mixes en vivo): ver [`2026-10-18-plugin-claim`](../2026-10-18-plugin-claim/GUIA_IMPLEMENTACION.md). Sale en la misma tanda del corte (servidor real y RBK) |
| Frontend | Contrato listo (sección 5b y "SteamID y `!claim` (admin)") |

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/15_claim.sql` | Nuevo |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/15_claim.sql` | Nuevo. `link_steam_id` se copió de la base antes de la `15`, para que la estructura vuelva idéntica |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/15_claim.sql` | Nuevo |
| `web/backend/src/routes/claim.ts`, `src/schemas/claim.ts` | Nuevos |
| `web/backend/src/app.ts` | Registra `claim` antes que `players` (`/players/unclaimed` no es un `{id}`) |
| `web/backend/src/routes/players.ts`, `src/schemas/players.ts` | `steam_ids` en la ficha |
| `web/backend/src/routes/matches.ts`, `src/schemas/matches.ts` | `steam_id` de los jugadores sin ficha en el detalle de partida |
| `web/backend/src/routes/admin-players.ts` | Sin reclamos viejos; descripción nueva de `steam/link` |
| `web/backend/src/routes/me.ts`, `src/schemas/admin.ts`, `src/schemas/profile.ts` | Sin reclamos viejos |
| `web/backend/src/db/types.ts` | Tipos regenerados |
| `web/backend/vitest.config.ts` | Integración de a un archivo por vez (ver "Incidentes") |
| `web/backend/test/...` | Nuevas `unit/claim-routes.test.ts` e `integration/claim.test.ts`; sin las pruebas de reclamos viejos |
| `docs/frontend/contract.md` | Sección 5b, admin, listados, registro y registro de decisiones |
| `supabase/replanteo/README.md`, `docs/bitacora/2026-10-14-replanteo-modelo-datos/DOCUMENTACION.md`, `docs/PENDIENTES.md`, `docs/bitacora/README.md` | Fila de la `15`, corte con 01 a 15, plan viejo marcado como reemplazado |

## Despliegue (pendiente: va en el corte)

1. **Antes:** la migración de ajustes de ELO (`20261015210000_elo_ajustes.sql`) aplicada en producción. La `15` aborta si no está.
2. **Base:** `supabase/replanteo/15_claim.sql` después de la `14`. Los reclamos viejos aprobados pasan a `claim_log`, y la tabla `profile_requests` se borra (está en el respaldo previo).
3. **Backend:** sale con el primer despliegue. Sin variables nuevas.
4. **Plugin 2.2.0** (hecho; pasos en `2026-10-18-plugin-claim`): `.smx` genérico al servidor real y build licenciado a RBK, en la misma tanda.
5. **Prueba real:**
   - Una cuenta nueva, sin mixes, usa `!claim` en el servidor real.
   - Después pide un SteamID desde otra PC y un admin lo aprueba.

## Pruebas

- **`correr.sh`** pasa con 01 a 15: aplicar, segunda aplicación que aborta, inversa con la estructura idéntica y reaplicar.
- **`pruebas/15_claim.sql`**, con dos mixes de 10 SteamID cada uno:
  - Perfil sin reclamar, sus stats y su historial.
  - Formato del código y que el anterior deje de valer.
  - Los casos de la tabla de la documentación.
  - Pedido de adicional, reserva, rechazo por partida compartida y rechazo con motivo.
  - Aprobar un adicional sin partidas compartidas: el adicional pierde su ELO propio y la ficha queda con 2 partidas de ELO.
  - Tope configurable.
  - Cambiar el principal y quitar un SteamID (el historial y el ELO se separan).
  - Unicidad, vínculo directo del admin y vencimiento a los 30 días.
  - **`!match` de punta a punta:** un torneo de grupos con 4 equipos, donde un jugador inscrito tiene un SteamID adicional aprobado y otro jugador tiene un pedido pendiente. Se pide la partida con su código, como el plugin, y la lista del plantel trae exactamente 6 SteamID: los 5 principales y el adicional aprobado, sin el pendiente.
  - La ingesta con la función nueva.
  - Servidor sin licencia, SteamID inválido, demasiados intentos y tope de 5 códigos por hora.
  - Permisos y que `profile_requests` ya no exista.
- **Ensayo del ELO** con la copia de producción en la base local (`ensayo_elo.sh`):
  - Resultado **idéntico** (32 SteamID, 135 filas de mixes y stats de 32 jugadores).
  - La migración pasó los 28 reclamos viejos al registro y encontró 1 perfil sin reclamar.
  - Después se reseteó la base local.
- **Backend:**
  - `pnpm typecheck` sin errores.
  - 239 pruebas unitarias (5 nuevas; se sacaron 7 de los reclamos viejos).
  - 73 de integración (5 nuevas; se sacaron 3):
    - Perfil sin reclamar, fuera del ranking y enlazado desde la partida.
    - `!claim` contra `claim_with_code` como el plugin: primer SteamID, ficha con historial, estado del código, pedidos, rechazo por partida compartida, aprobación con ELO unido, principal, quitar y registro.
    - Rechazos, tope, permisos y servidor sin licencia.
- **Cobertura:** 97,7 % de líneas en total. Dos corridas seguidas pasaron completas.

## En qué se apartó del plan

- **Tablas:** `players.steam_id` sigue siendo el principal, y la tabla nueva (`player_extra_steam_ids`) guarda solo los adicionales. La vista `player_steam_all` los junta. Así no cambia nada de lo que usa `players.steam_id` (equipos, torneos, pruebas anteriores). El plan proponía una sola tabla con `is_primary`.
- **Tope de 1 a 4** (el plan decía de 1 a 10): la lista de SteamID que recibe el plugin para `!match` entra en 1024 caracteres con hasta 4 por jugador.
- **Vencimiento de los pedidos:** se aplica al reclamar, al aprobar y al listar (`steam_requests_expire`), porque todavía no existe la tarea periódica (la misma que falta para las PCW vencidas).
- **Reclamos viejos:** antes de borrar la tabla, los existentes pasan a `claim_log` como historia.
- **`steam_unlinked` (admin) se mantiene** igual. El perfil sin reclamar tiene sus propias vistas públicas.
- **`link_steam_id`** (vínculo directo del admin) ahora **suma** el SteamID en vez de reemplazar el anterior.

## Incidentes durante las pruebas

- **Un comentario `--` dentro de una línea** reemplazada en `csstv_match_lookup` dejó comentado el resto de la expresión. Se cambió por un comentario de bloque.
- **Tope de 5 códigos por hora en la prueba SQL:** la prueba generaba más códigos para la misma cuenta. El tope se prueba aparte, y el helper envejece los códigos anteriores.
- **Pruebas de integración que se pisaban:**
  - La del ELO cambia la configuración y recalcula mientras la del reclamo aprueba SteamID, que también recalcula. En paralelo, una veía el ELO de la otra (1040 en vez de 1030).
  - Ahora los archivos de integración corren de a uno (`fileParallelism: false`). La suite pasó de unos 12 a 48 segundos.
  - Además, las aserciones del reclamo comparan contra el ELO que tenía el perfil antes de reclamar, no contra un número fijo.

## Cómo revertir

- **En local:**
  1. Quitar los SteamID adicionales (`admin_remove_steam`).
  2. Aplicar `reversas/15_claim.sql`. Los reclamos viejos no vuelven: la tabla se recrea vacía.
- **Backend:** revertir el commit de esta entrega.
- **En producción:** no aplica todavía.
