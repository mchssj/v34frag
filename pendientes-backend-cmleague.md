# Pendientes del backend para el frontend de CM League

Fecha: 2026-10-30. De: frontend (rama `feat/frontend-fase-1`, al `68909fc`). Para: backend.

Lista completa de lo que el frontend todavía necesita del backend. Todo lo que figura acá ya está implementado del lado del frontend con lo que la API tiene hoy: lo que falta se muestra deshabilitado con "Próximamente", o se resuelve con un rodeo que queremos quitar.

Convenciones, las mismas de la API actual:
- listas paginadas `{ items, total, page, per }`;
- errores `{ error: { code, message, details? } }` con `code` en mayúsculas.

## Ya resuelto (no hace falta nada)

La primera tanda del contrato (E1 a E8 y T1 a T4) está completa en la API, y el frontend ya la usa:
- **Roster:** estado editable, rol de cada jugador y `GET /me/teams` con `my_role`.
- **Equipo:** logo, `looking_for`, historial de torneos, `founded_at` y datos de las invitaciones.
- **Torneos:** BO, etapa y progreso en el listado, banner, cierre de inscripciones y partida en vivo.

También quedaron confirmados los dos puntos "para confirmar": el aviso `event_lineup` al inscribir y el código `400 PLAYER_NOT_LINKED` con `details.aliases`.

## Resumen de lo pendiente

| # | Pedido | Módulo | Prioridad | Hoy en el frontend |
|---|---|---|---|---|
| E9 | Cancelar la solicitud de equipo nuevo | Equipo | **Para cerrar** | "Cancelar solicitud" deshabilitado |
| E10 | Disolver equipo por el líder | Equipo | **Para cerrar** | "Disolver equipo" deshabilitado; un líder sin a quién ceder no puede salir |
| E11 | Nombre y sigla editables por el líder | Equipo | Mejora | Campos de solo lectura en "Editar equipo" |
| E12 | Biografía editable por el jugador | Perfil público | **Para cerrar** | "Escribir biografía" deshabilitado |
| E13 | `logo_url` en el historial de equipos y los títulos de un jugador | Perfil público | Mejora | Una consulta extra por equipo para sacar el logo |
| E14 | Varios estados en `status` de `/matches` | Partidas | **Para cerrar** | Solo se ven las jugadas; "Ocultar canceladas" deshabilitado |
| E15 | `mine=true` en `/matches` | Partidas | **Para cerrar** | "Solo donde jugué" deshabilitado |
| E16 | Contadores por tipo en `/matches` | Partidas | Mejora | Los chips Todas, Mix, PCW y Torneo van sin número |
| E17 | MVP en las filas de mix de `/matches` | Partidas | Mejora | La columna Detalle queda vacía en los mixes |
| E18 | Buscar por nick en `/matches` | Partidas | Mejora | La búsqueda no encuentra partidas por jugador |
| E20 | Total de jugadores y fecha de cierre en las temporadas de un jugador | Perfil público | Opcional | La tarjeta dice "Puesto final" en vez de "#3 de 214" |

"Para cerrar" = sin eso, la función queda a medias para el usuario. "Mejora" = funciona, pero el frontend hace un rodeo o muestra menos.

---

## Equipo

### E9. Cancelar la solicitud de equipo nuevo

**Hoy:** `GET`/`PUT /me/team-request` existen, pero no hay forma de retirar una solicitud pendiente. La tarjeta de la solicitud (en "Sin equipo") tiene "Editar" y "Cancelar"; "Cancelar" está deshabilitado.

**Pedimos:**
- **`DELETE /api/v1/me/team-request`**, que devuelve `204`:
  - solo si la solicitud está `pending`; si no, `409 CONFLICT` con el mensaje;
  - borra el logo que se haya subido con la solicitud.
- **En `TeamRequest`:** `created_at` y, si fue rechazada, `reject_reason: string | null`. Así mostramos "Enviada hace 2 días" y el motivo del rechazo.

**Cuando llegue:** se activa "Cancelar solicitud" (con confirmación) y se muestran la fecha y el motivo.

### E10. Disolver equipo por el líder

**Hoy:** el líder tiene que ceder el liderazgo antes de salir (`POST /teams/{id}/leave` lo exige), y eso está bien. Pero si es el **único miembro**, o **nadie más tiene SteamID**, no hay a quién cedérselo y no puede salir. El único borrado es el del admin (`DELETE /admin/teams/{id}`), que falla si el equipo tiene partidas o inscripciones.

**Pedimos:** `POST /api/v1/teams/{id}/dissolve` (capitán o admin), que devuelve `204`:
- **Archivado, no borrado:** el equipo sale del listado, de Buscar equipo y del ranking actual, pero conserva su historial, sus partidas, sus títulos y la vista pública, con un aviso "Equipo disuelto".
- **Miembros:** quedan como ex integrantes y reciben una notificación.
- **Torneos:** falla con `409` si el equipo está inscripto en un torneo en inscripciones o en curso (que primero lo dé de baja).
- **Opcional:** permitirlo solo cuando no hay a quién ceder el liderazgo, si prefieren que un equipo con miembros elegibles no se pueda disolver sin pasarlo.

**Cuando llegue:** se activa "Disolver equipo" en el diálogo de salir del líder, con confirmación.

### E11. Nombre y sigla editables por el líder (mejora)

**Hoy:** `PATCH /teams/{id}` solo acepta `looking_for`; el nombre y la sigla los cambia un admin. En el panel "Editar equipo" se muestran bloqueados, con ese aviso.

**Pedimos:** que `PATCH /teams/{id}` acepte también `name` y `tag` del capitán, con las mismas reglas que la solicitud (nombre de 2 a 40 caracteres, sigla de 1 a 6), y además:
- **Un cambio cada 30 días:** si no se puede, `409` con la fecha del próximo cambio permitido (por ejemplo en `details.next_change_at`). Sumar `name_changed_at` al detalle del equipo para avisarlo antes de intentar.
- **Únicos:** que no repitan el nombre ni la sigla de otro equipo activo (`409`).
- **El filtro de palabras** que ya usa el backend.
- **Bloqueado** mientras el equipo juega un torneo en curso, para que no cambie de nombre en medio de la llave (`409`).

**Cuando llegue:** se activan los campos de nombre y sigla en "Editar equipo", con "Guardar" y el aviso de cuándo se puede volver a cambiar.

---

## Perfil público

### E12. Biografía editable por el jugador

**Hoy:** `bio` de la ficha solo la cambia un admin (`PATCH /admin/players/{id}`). El jugador no tiene dónde escribir su biografía, y en su perfil público "Escribir biografía" aparece deshabilitado con "Próximamente".

**Pedimos:** que `PATCH /api/v1/me/profile` acepte `bio` y la guarde en la ficha vinculada:
- con el mismo largo máximo que usa el admin, saltos de línea y el filtro de palabras;
- sin jugador vinculado, `409`.

**Nota:** `achievements` ya no se muestra en el perfil, porque lo escribe un admin y aparecía como "Escrito por el jugador". El palmarés sale de los títulos de torneo y las medallas. No hace falta hacerlo editable por el jugador.

**Cuando llegue:** se activa "Escribir biografía" en el perfil propio y se suma el campo en Mi perfil.

### E13. `logo_url` en el historial de equipos y los títulos (mejora)

**Hoy:** `GET /players/{id}/teams` y `GET /players/{id}/titles` devuelven el equipo (`TeamRef`) sin `logo_url`. Para no mostrar la sigla cuando el equipo tiene logo, el frontend pide el detalle de cada equipo (`GET /teams/{id}`): una consulta más por equipo en cada perfil.

**Pedimos:** sumar `logo_url` al equipo en esas dos respuestas, como ya viene en los listados de equipos.

**Cuando llegue:** el frontend deja de pedir el detalle (`useTeamLogos` no pide nada cuando el campo llega).

### E20. Total de jugadores y fecha de cierre por temporada (opcional)

**Hoy:** `GET /players/{id}/seasons` trae el puesto (`rank`), pero no cuántos jugadores clasificaron en la temporada ni cuándo cerró. La tarjeta dice "#3 · Puesto final".

**Pedimos (si es barato):** en cada fila, `season.ended_at` y `season.players` (cuántos jugadores entraron en el ranking final).

**Cuando llegue:** la tarjeta dice "#3 de 214" y "cerró el 15 sep 2026".

---

## Partidas

En el frontend, "Partidas" y "Mixes" ahora son un solo listado (`/matches`). La tabla sale de `GET /api/v1/matches`, y `GET /api/v1/mixes` se sigue usando solo para los mixes en vivo. Las partidas programadas no van en ese listado: se ven en Torneos y en PCW. Para que los filtros funcionen sin resolverlos en el frontend, pedimos lo siguiente.

### E14. Varios estados en `status`

**Hoy:** `status` acepta un solo valor, y sin él vienen también las programadas. El frontend pide `status=finished`, así que las canceladas no se ven.

**Pedimos:** que `status` acepte una lista separada por comas (`status=finished,cancelled`). El listado pide las jugadas y las canceladas; con "Ocultar canceladas", solo `finished`.

**Cuando llegue:** se ven las canceladas y se activa "Ocultar canceladas".

### E15. `mine=true` en `/matches`

**Hoy:** "Solo donde jugué" se podría resolver con `player=<id de la ficha>`, pero eso obliga al frontend a mandar el id en cada consulta.

**Pedimos:** `mine=true`, como ya existe en `/mixes`: usa la sesión, pide estar logueado y, sin ficha vinculada, devuelve la lista vacía.

**Cuando llegue:** se activa "Solo donde jugué" (deshabilitado con una explicación si la cuenta no tiene jugador vinculado).

### E16. Contadores por tipo (mejora)

**Pedimos:** que la respuesta de `/matches` traiga `counts: { all, mix, pcw, official }`, calculados con los mismos filtros de la consulta salvo `kind`.

**Cuando llegue:** cada chip (Todas, Mix, PCW, Torneo) muestra su número.

### E17. MVP en las filas de mix (mejora)

**Hoy:** `MatchSummary` no trae el MVP; `MixItem` sí (`mvp`).

**Pedimos:** el mismo `mvp` (alias, nombre en el juego y rating; `null` si no hay) en las filas de `/matches` con `kind = mix`.

**Cuando llegue:** la columna Detalle muestra "MVP {alias} · {rating}" en los mixes.

### E18. Buscar por nick en `/matches` (mejora)

**Hoy:** `q` busca en equipos, bandos y torneo.

**Pedimos:** que también busque en los nombres de los jugadores (alias y nombre en el juego), como el `q` de `/mixes`.

**Cuando llegue:** la búsqueda encuentra partidas por el nick de un jugador, y el texto de ayuda pasa a "Equipo, bando, torneo o nick".

---

## Para más adelante (no entra en esta tanda)

### E19. Búsqueda global del buscador ⌘K

Queda anotada, sin apuro: no hace falta para cerrar lo que está hecho.

**Hoy:** el buscador ⌘K solo busca páginas del sitio. El campo ya invita a escribir "un nick, equipo, torneo o página".

**Pedimos:** `GET /api/v1/search?q=…` (sin sesión también, mínimo 2 caracteres), con pocos resultados por grupo:

```json
{
  "players": [{ "id": "…", "alias": "Zeta", "photo_url": null, "level": 8 }],
  "teams": [{ "id": "…", "name": "Furia Sur", "tag": "FUR", "logo_url": null }],
  "events": [{ "id": "…", "name": "Copa Invierno 2026", "status": "in_progress" }]
}
```

- **Coincidencia:** por prefijo y por palabra, sin distinguir mayúsculas ni tildes.
- **Tamaño:** hasta 5 resultados por grupo.
- **Privacidad:** los jugadores con perfil privado aparecen solo con su alias.

**Cuando llegue:** ⌘K muestra los grupos Jugadores, Equipos y Torneos arriba de Páginas, y cada resultado abre su página.

---

## Datos, no código

- **Versiones de mapas:** juanma jugó en `nuke_old_blue_ep`, que no figura entre las versiones de `de_nuke_old_blue` en el catálogo. En su perfil se ve como un mapa aparte, y `nuke_old_blue` aparece en cero. Se arregla sumando la versión en Administración › Mapas. Conviene revisar si hay otros mapas jugados que no estén en el catálogo.

## Orden sugerido

1. **E14 y E15:** sin ellos, Partidas no muestra las canceladas ni deja filtrar por lo propio.
2. **E12 y E9:** son botones que el usuario ya ve deshabilitados.
3. **E10:** para que ningún líder quede atrapado en su equipo.
4. **E13, E16, E17, E18:** quitan rodeos o suman datos a lo que ya funciona.
5. **E11 y E20:** mejoras.

E19 (búsqueda global) queda para más adelante.

Cuando llegue cada uno, el frontend regenera los tipos de la API (`src/api/schema.d.ts`) y activa lo suyo. El detalle de cada vista está en `docs/bitacora/` (2026-10-29-reclutar-y-salir-del-equipo, 2026-10-30-perfil-publico-tabs-y-sesion y 2026-10-30-partidas-unificadas).
