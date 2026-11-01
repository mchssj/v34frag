# Plan: reclutar, salir del equipo siendo líder y la solicitud de equipo pendiente

> Planeación original. Estado: **aprobado** el 2026-10-29 (Esteban eligió la opción C del [artifact](https://claude.ai/artifact/629E53BhAtiwzCchkiq8zR) y pidió hacer visible la solicitud pendiente).

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Editar `looking_for` | Botón **"Reclutar"**, con contador, junto a "Invitar jugador". Abre un panel lateral (como el de invitar) con Activo, Suplente y Coach, una explicación de cada uno, el aviso de roster completo, y Guardar → `PATCH /teams/{id}` | Opción C: se edita poco, no merece un panel fijo, y el panel no empuja el layout aunque haya muchos pedidos |
| Qué busca el equipo, a la vista | Etiquetas "Busca activo…" bajo la línea del líder, solo lectura, en Mi equipo y en la vista pública | Compensa que el editor esté detrás de un clic |
| "Salir del equipo" del líder | En un menú **⋯ (Más acciones)** de la cabecera. El miembro común lo sigue viendo como botón | Tres botones juntos pesan; salir es raro y destructivo |
| El líder sale | Diálogo **"Antes de salir, elige quién queda como líder"**: el roster sin él, deshabilitados los que no tienen SteamID; "Ceder a {nombre} y salir" hace `POST /teams/{id}/captain` y después `POST /teams/{id}/leave` | El backend exige ceder antes, y un equipo sin líder queda huérfano |
| Nadie puede ser líder | Diálogo "No hay quién quede como líder" con "Invitar jugador" y "Disolver equipo" **deshabilitado con "Próximamente"** | No existe "disolver equipo" en la API (pedido al backend) |
| Solicitud de equipo pendiente | En "Sin equipo", una **tarjeta** con el escudo (logo o sigla), el nombre, el chip "Pendiente de aprobación", el texto de qué pasa al aprobarse, y "Editar solicitud" y "Cancelar solicitud". Mientras está pendiente, "Crear equipo" cambia por la tarjeta. Rechazada: la tarjeta lo dice y ofrece "Enviar otra" | Hoy es una línea de texto que pasa desapercibida |
| Cancelar la solicitud | **Deshabilitado con "Próximamente"** | No existe `DELETE /me/team-request` (pedido al backend) |

## Pedidos al backend

1. `DELETE /me/team-request`: cancelar la solicitud pendiente.
2. `created_at` (y el motivo, si se rechaza) en `TeamRequest`, para mostrar "Enviada hace 2 días".
3. **Disolver equipo** por el líder: el equipo queda archivado con su historial, para el líder que es el único miembro o que no tiene a quién cederle el liderazgo.

## Archivos (`web/frontend/src/features/teams/`)

- `Recruit.tsx` (nuevo): el panel "Reclutar jugadores" y las etiquetas de qué busca.
- `queries.ts`: `useSetLookingFor`.
- `TeamView.tsx`: los botones, el menú ⋯ y el diálogo de salir del líder.
- `NoTeam.tsx`: la tarjeta de la solicitud.
- `model.ts`: las etiquetas de `looking_for` (hoy en `FindTeam.tsx`).

## Pruebas

- **e2e con los datos simulados:**
  - Reclutar marca opciones y manda `PATCH { looking_for }`;
  - las etiquetas aparecen;
  - el líder sale cediendo (`POST /captain` y después `/leave`);
  - sin nadie con SteamID, el diálogo de "no hay quién";
  - la tarjeta de la solicitud pendiente, con "Editar" que abre Crear equipo con los datos.
- **Unitarias:** las etiquetas y quién puede quedar como líder.
