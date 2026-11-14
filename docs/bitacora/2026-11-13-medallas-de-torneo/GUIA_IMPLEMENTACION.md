# Medallas de campeón y finalista de torneo automáticas: guía de implementación

## Estado

Implementado, probado y **desplegado el 2026-11-13**: la `114` en producción, y la API y la web `d77f142f6972` (commit `d77f142f`). No toca los servidores de juego ni el plugin.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/114_medallas_de_torneo.sql` | Columnas, `event_result`, `event_medals_sync`, `medal_title_key`, triggers diferidos, avisos silenciables y retroactivo |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/114_medallas_de_torneo.sql` | Inversa |
| `web/backend/src/routes/players.ts`, `schemas/players.ts` | `event` y `source = 'event'` en las medallas del perfil |
| `web/backend/src/routes/admin-players.ts` | Dar a mano también `event_result`; no quitar las `source = 'event'` |
| `web/backend/src/routes/medals.ts`, `schemas/medals.ts`, `db/types.ts` | Tipo `event_result` |
| `web/frontend/src/features/admin/medals/` | El tipo nuevo en el editor y el listado |
| `web/frontend/src/features/admin/players/components/FichasTab.tsx` | Dar estas dos a mano y no quitar las de torneo |
| `web/frontend/src/features/player/` | Enlace al torneo en Logros |
| `web/frontend/src/features/medals/templates.json` | Las dos plantillas con `event_result` |
| `docs/manual/…` | `admin/medallas.md`, `admin/usuarios-y-fichas.md`, `jugador/logros.md`, `organizador/resultados-y-llave.md`, `organizador/subir-torneo-historico.md` |

## Despliegue (hecho el 2026-11-13)

1. **Lista previa**: se sacó solo leyendo de producción, en una transacción de solo lectura. Se mostró a Daniel y la aprobó.
   - El único torneo terminado era «Torneo Mercy 2020», aprobado y sin testing. Daría 3 medallas nuevas: Campeón a Venom y Finalista a flinkssd y a notionszera.
   - No se adoptaba ninguna de las 18 medallas de campeón dadas a mano (TITAN, TITAN 2, FDX CSSO y las 13 de Slendy), porque ninguna coincide con un torneo de la plataforma.
2. **Base**: se aplicó la `114` por el túnel (`psql -f`) y después `notify pgrst, 'reload schema'`. Dio exactamente esas 3 medallas, sin avisos.
3. **API**: `deploy/vps/desplegar.sh api` desde `main`, sin lobbies del matchmaking en las últimas 6 horas y con la cola vacía. Por error se corrió dos veces seguidas, con la misma versión y sin consecuencias (un reinicio de más).
4. **Web**: `deploy/vps/desplegar.sh web`.

Orden obligatorio: la base antes que la API, porque la API nueva pide `event:events(id, name)` y eso necesita `player_medals.event_id`.

## Pruebas

### Producción

- `/api/health` con `d77f142f6972`.
- `GET /api/v1/players/<Venom>/medals` devuelve «Campeón · Torneo Mercy 2020» con `source: "event"` y `event: { name: "Torneo Mercy 2020" }`.
- Antes de subir, el script corrió las pruebas: 596 de la API (unitarias) y 747 de la web.

### Local

- `pruebas/probar_114.sh` sobre la copia de producción, en la sesión de implementación. Cubre terminar, corregir, reiniciar, testing, aprobar, histórico con y sin ficha, y retroactivo con medallas a mano. Al cerrar no se pudo volver a correr: la copia local ya tiene la `114` y el script se frena con «ya se aplicó».
- Integración de la API (`medals.test.ts` y `mixes-perfil-ranking.test.ts`): 25 de 25.

### En el navegador

No se probó en producción.

## En qué se apartó del plan

- **Retroactivo sin duplicar.** El plan emparejaba las medallas a mano con los títulos por orden de fecha. Se cambió por emparejarlas por el **nombre del torneo** (`medal_title_key`), para no convertir una medalla de un torneo de fuera en la de otro torneo de la plataforma. La adoptada guarda su título en `admin_title` y, si deja de corresponder, vuelve a ser manual.
- **Triggers diferidos.** Se usan triggers diferidos (`constraint trigger … initially deferred`), y también en `insert` y `update` de `tournament_registrations`, para que borrar y volver a cargar un plantel no quite y vuelva a dar.
- **Medallas de torneo en la ficha.** Desde la ficha no se pueden quitar las medallas de torneo: el botón está apagado y la API responde 400.

## Incidentes

Ninguno. La API se desplegó dos veces sin querer, con la misma versión.

## Cómo revertir

1. La web y la API a la versión anterior (`92ea3367f5c8`), porque la API nueva necesita `event_id`.
2. La inversa de la `114`. Vuelve a `admin` las medallas adoptadas, borra las dadas por torneos y devuelve las dos definiciones a `manual`.
