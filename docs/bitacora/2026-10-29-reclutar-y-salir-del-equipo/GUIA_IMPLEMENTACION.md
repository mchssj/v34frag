# Reclutar, salir del equipo siendo líder y la solicitud pendiente: guía de implementación

## Estado

Implementado y probado en local el 2026-10-29, en la rama `feat/frontend-fase-1`, sin commit y sin desplegar. Cancelar la solicitud y disolver el equipo quedan con "Próximamente" hasta que el backend los tenga.

## Archivos

Todos dentro de `web/frontend/`.

| Archivo | Cambio |
|---|---|
| `src/features/teams/Recruit.tsx` | Nuevo: panel "Reclutar jugadores" y etiquetas "Busca …" |
| `src/features/teams/queries.ts` | `useSetLookingFor` (`PATCH /teams/{id}`) |
| `src/features/teams/model.ts` | `LOOKING_FOR`, `lookingForText`, `heirsOf` |
| `src/features/teams/TeamView.tsx` | "Reclutar" con contador, menú ⋯ con "Salir del equipo", etiquetas en la cabecera y el diálogo `LeaderLeaveDialog` (ceder y salir, o "no hay quién") |
| `src/features/teams/NoTeam.tsx` | Tarjeta de la solicitud (pendiente o rechazada); con una pendiente, reemplaza a "Crear equipo" |
| `src/features/teams/CreateTeam.tsx`, `src/routes/_app/myteam.tsx` | `?view=create&edit=true` abre la solicitud pendiente directo en el formulario |
| `src/features/teams/FindTeam.tsx` | Usa las etiquetas compartidas de `looking_for` |
| `e2e/team.spec.ts` | 3 pruebas nuevas y la del capitán ajustada |

## Despliegue

No se desplegó.

## Pruebas

- **Typecheck y lint:** limpios.
- **Unitarias:** 360 en verde.
- **e2e de Equipo:** las 10 en verde:
  - Reclutar manda `PATCH { looking_for: ["sub", "coach"] }`, en el orden de las opciones;
  - el líder elige a Tormenta (nacho, sin SteamID, deshabilitado) y se hacen `POST /captain` con `{ player_id: "p-torm" }` y después `POST /leave`;
  - la tarjeta de la solicitud pendiente: sin "Crear equipo", "Cancelar solicitud" deshabilitado, y "Editar solicitud" abre el formulario con el nombre y la sigla.
- **Visual:** la tarjeta de la solicitud, el panel de reclutar y el diálogo de salir, en oscuro.

## En qué se apartó del plan

- **El contenido inicial del panel de reclutar:** con el roster completo, el backend devuelve `looking_for` vacío aunque esté guardado, así que el panel parte vacío en ese caso. El aviso del panel lo explica.

## Pedidos al backend

1. `DELETE /me/team-request`: cancelar la solicitud pendiente.
2. `created_at` (y el motivo, si se rechaza) en `TeamRequest`.
3. **Disolver equipo** por el líder (queda archivado con su historial), para cuando es el único miembro o nadie más tiene SteamID.

## Cómo revertir

Todavía no hay commit: alcanza con descartar los cambios de los archivos de la tabla y borrar `src/features/teams/Recruit.tsx`.

## Cambios posteriores

- **Editar equipo (2026-10-30, variante A del [artifact](https://claude.ai/artifact/629E53BhAtiwzCchkiq8zR), aprobada por Esteban):**
  - El menú ⋯ suma "Editar equipo" sobre "Salir del equipo".
  - El escudo del líder ya no tiene la cámara en la esquina: al pasar el mouse dice "Modificar logo" y al hacer clic abre el mismo panel.
  - **Panel lateral "Editar equipo"** (`EditTeamSheet` en `TeamLogo.tsx`):
    - **Logo:** "Cambiar" (abre el recorte) y "Eliminar". Se guarda al instante.
    - **Nombre y sigla:** solo lectura, con el aviso de que los cambia un admin.
  - "Reclutar" sigue como botón propio, con su contador.
- **Buscar equipo junto a Mis equipos:** como se puede estar en varios equipos, el selector lleva al lado un botón "Buscar equipo" (`?view=find`).
- **Solicitud pendiente compacta:** escudo, nombre y chip en una fila. El texto pasó al tooltip del chip, y "Editar" y "Cancelar" quedaron como botones de solo ícono con tooltip.
- **Alineación de "Cambiar" y "Eliminar":** la etiqueta "Logo" (`text-[13px]`) heredaba un alto de línea de 18,57 px y dejaba los botones en y = 148,56. Chrome dibuja el SVG en la posición fraccionaria pero ajusta el texto al píxel, así que el ícono quedaba 1-2 px más bajo. Las etiquetas del panel pasaron a `leading-5` (20 px): el botón cae en un píxel entero y el ícono queda centrado con el texto.
- **Pruebas:** 11 e2e de Equipo (1 nueva: Editar equipo desde ⋯ y desde el escudo, y Buscar equipo) y 360 unitarias, en verde.
