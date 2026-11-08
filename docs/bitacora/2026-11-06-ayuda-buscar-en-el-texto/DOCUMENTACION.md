# Buscar en el texto de la ayuda y la página de comandos del jugador: documentación

## Qué hace

El buscador de **Ayuda** (`/help`) busca también dentro del texto de cada página, no solo en el título y el resumen. Si escribes `!pause` o `calladmin`, aparecen las páginas que los nombran, con un pedazo del texto donde está lo que buscaste resaltado.

Además, el jugador tiene su página **Comandos del jugador en el servidor**, igual que los otros roles. "Jugar en el servidor" queda para explicar cómo se juega una partida.

```mermaid
sequenceDiagram
  participant W as Web (Ayuda)
  participant A as API
  W->>A: GET /api/v1/manual
  A-->>W: secciones del rol; cada página con titulo, resumen y texto
  Note over W: escribes en el buscador
  W->>W: 1) coincide en titulo o resumen
  W->>W: 2) si no, coincide en el texto → fragmento
```

## El texto de cada página (API)

- `GET /api/v1/manual` suma `texto` en cada página del índice: el cuerpo en texto plano, armado por `textoPlano()` (`web/backend/src/lib/manual.ts`).
- Saca encabezados, negritas, citas, viñetas, filas de separación de las tablas y capturas. Los links quedan con su texto y el código en línea con su contenido (`` `!pause` `` → `!pause`).
- Saca los marcadores (`{{mm.aceptar}}`): el índice no lee la base, así que no los puede reemplazar. Quien busca un valor (por ejemplo "20 segundos") no lo encuentra en el texto; sí la palabra de alrededor.
- El filtro por rol no cambia: el texto va dentro de las páginas que el rol ya ve.

## El buscador (web)

- Sin tildes ni mayúsculas, como antes (`normalize`).
- Orden dentro de cada sección: primero las páginas que coinciden en el título o el resumen, después las que coinciden solo en el texto.
- En las segundas, un fragmento de unos 60 caracteres a cada lado, cortado en espacios, con `…` en los cortes y lo buscado en `<mark>` (`features/help/lib/fragmento.ts`).
- Si la API no manda `texto` (una versión vieja), busca solo en el título y el resumen.

## Qué cambia para cada rol

| Rol | Qué cambia | Página del manual |
|---|---|---|
| Todos | El buscador de Ayuda encuentra lo que está dentro de las páginas | — |
| Jugador | Página nueva con todos sus comandos; "Jugar en el servidor" enlaza a ella | [Comandos del jugador en el servidor](/help/jugador/comandos-en-el-servidor), [Jugar en el servidor](/help/jugador/jugar-en-el-servidor) |
| Capitán, organizador, moderador, admin, streamer y dueño de un servidor externo | Solo el buscador | — |

## Términos y privacidad

Sin cambios.

## Dónde está cada cosa

| Qué | Archivo / ubicación |
|---|---|
| Texto plano del índice | `web/backend/src/lib/manual.ts` (`textoPlano`, `indiceDe`) |
| Esquema del índice | `web/backend/src/routes/manual.ts` (`ManualIndice`) |
| Buscador | `web/frontend/src/features/help/pages/HelpIndex.tsx` |
| Fragmento | `web/frontend/src/features/help/lib/fragmento.ts` |
| Página de comandos del jugador | `docs/manual/jugador/comandos-en-el-servidor.md` |
| La regla de los comandos | `CLAUDE.md` y `docs/manual/README.md`, ahora con la página del jugador |
