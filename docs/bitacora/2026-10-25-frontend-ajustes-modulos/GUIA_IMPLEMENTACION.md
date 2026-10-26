# Ajustes del frontend en los módulos que ya existen: guía de implementación

## Estado

Implementado y probado en local el 2026-10-25, sin commit ni despliegue. Hay 286 pruebas unitarias y de componentes en verde, y el lint y el typecheck pasan. Las pantallas se revisaron con capturas contra la API local. **Faltan las pruebas de Playwright** (ver "Pruebas").

## Archivos

| Archivo | Cambio |
|---|---|
| `src/features/maps/queries.ts` (+ prueba) | Catálogo desde la API, `mixMapNames` y `mapImage` por versión |
| `src/features/mixes/MixesList.tsx` (+ prueba) | Select con `mixMapNames` |
| `src/features/mixes/stats.ts` (+ prueba) | Nuevo. Columnas, fórmulas, mejor valor y orden |
| `src/features/mixes/StatsTabs.tsx` | Nuevo. Selector de pestañas |
| `src/features/mixes/MixRoom.tsx` (+ prueba) | Tablas por pestaña, ancho fijo, primera columna fija, cabeceras con ayuda y orden, y textos de Clutch |
| `src/features/mixes/room.ts` | `RoomPlayer` suma `hsKills`, `rounds`, `k2`–`k5`, `fk`, `fd`, `plants`, `defuses` y `clutches`; `Room` suma `clutchData` |
| `src/features/mixes/MixRoomPages.tsx`, `search.ts` | `tab` y `onTab`; `roomSearchSchema` |
| `src/routes/_app/match.$id.tsx`, `mixes.live.$uid.tsx` | `validateSearch` con `stats` |
| `src/features/ranking/PlayersRanking.tsx`, `search.ts` (+ pruebas) | Temporada con Equipo, Rating, K/D, pico debajo del ELO, `LevelFilter` y orden |
| `src/features/player/KeyPlays.tsx` (+ prueba), `tabs.tsx` | "Jugadas clave" en Resumen |
| `src/features/player/PlayerProfile.test.tsx` | Pestaña Mapas con dos versiones y la foto |
| `src/features/shell/notifications/model.ts`, `queries.ts`, `NotificationsMenu.tsx`, `InviteDialog.tsx`, `mock.ts` (+ pruebas) | Campana conectada a la API |
| `src/features/shell/Topbar.tsx`, `src/routes/_app.tsx`, `src/auth/permissions.ts` | Sin la prop `captain`; `seesCaptainNotifications` → `getsAdminNotifications` |
| `src/features/profile/sections/NotificationPrefsCard.tsx` (+ prueba), `PreferencesSection.tsx` | Preferencias de notificaciones |
| `src/test/setup.ts` | `hasPointerCapture`, `releasePointerCapture` y `scrollIntoView` para el `Select` de Radix en jsdom |
| `e2e/shell.spec.ts` | La campana contra la API (cuenta nueva: "Estás al día.") y Preferencias que persiste al recargar |
| `web/frontend/CLAUDE.md` | Pendiente de la maestra de mapas actualizado |

## Despliegue

Ninguno todavía. Sale con la web nueva, después del corte del replanteo `30` (`docs/PENDIENTES.md`, punto 1.5).

## Pruebas

### Unitarias y de componentes (Vitest con MSW)

`pnpm test`: 39 archivos y 286 pruebas en verde. Las nuevas cubren:
- el catálogo (select y foto por versión);
- las fórmulas de cada pestaña, con los divisores en 0;
- el mejor valor (empates, menos es mejor, todos en 0) y el orden;
- las cuatro pestañas, Clutch sin datos y en vivo;
- la tabla de la temporada (equipos con "+2", rating, K/D, pico y filtros);
- "Jugadas clave", con datos y vacía;
- la campana: contador, lista, aceptar y marcar todo;
- el texto de los 43 tipos de notificación;
- las preferencias, para usuario y admin, y la vuelta atrás si la API falla.

### Capturas

Con un script de Playwright del scratchpad, contra la API local (`pnpm dev:node` en el puerto 8788) y un Vite propio en el 5174, a 1440 y 390 px en oscuro. Se revisaron:
- el listado de Mixes con el select abierto;
- la sala en General, Entrada y Clutch;
- el ranking de la temporada BETA;
- el perfil (Resumen y Mapas);
- la campana;
- Preferencias.

**No se guardaron en el repo:** muestran datos de la copia de producción.

### Playwright (`e2e/`): sin correr

En esta máquina, `localhost:8787` y `localhost:5173` estaban ocupados por un `node` y un Vite de otra sesión, con una API vieja, sin el replanteo `30`. Playwright reusa el Vite que encuentra (`reuseExistingServer`), así que el resultado no hubiera sido válido.

Para correrlas, con la API de esta rama en el 8787 y nada en el 5173:

```bash
cd web/frontend
pnpm test:e2e
```

Cambió `shell.spec.ts`: la prueba de la campana con datos de ejemplo pasó a ser contra la API, más la de Preferencias. Las demás (`mixes`, `player` y `ranking`) no se tocaron. Siguen sin cubrir de punta a punta las pestañas de la sala y "Jugadas clave", que sí están cubiertas por las pruebas de componentes.

## En qué se apartó del plan

- **`docs/PENDIENTES.md`:** no se tocó. El `CLAUDE.md` del frontend limita los cambios a `web/frontend/` y la bitácora. Lo pendiente queda acá y en `web/frontend/CLAUDE.md`.
- **Tablas de la sala:** son de ancho fijo (`table-fixed`, jugador de 210 px), para que las columnas de los dos bandos queden alineadas. El plan no lo decía; salió de las capturas.
- **Campana:** se quitaron la prop `captain` y `seesCaptainNotifications`. Las notificaciones de capitán ya llegan solo a quien corresponde (la base decide los destinatarios).
- **Solicitudes:** la pestaña muestra también las resueltas, con su estado. El número de la pestaña cuenta solo las pendientes.
- **Formato de los decimales:** "Jugadas clave" usa punto, como el resto de la app ("1.9 por partida"). El mockup tenía coma.
- **Playwright:** sin correr (ver "Pruebas").
- **Avanzado (pedido de Daniel después de ver la sala):**
  - sin la columna RP: las rondas jugadas solo se muestran, debajo del nombre, cuando alguien jugó menos que el mix;
  - "Plantadas" y "Defuses" pasan a "Bombas plantadas" y "Bombas desactivadas", también en "Jugadas clave".

  En la copia local, 26 de 491 líneas de jugador tienen menos rondas que el marcador y ninguna tiene más. Pruebas: 286 en verde.

## Pendiente

- **Playwright:** correr `pnpm test:e2e` con la API de esta rama.
- **Bloqueado por el backend** (pedidos del frontend de Mixes en `docs/PENDIENTES.md`, sección 6):
  - el nivel de cada jugador en la sala (`level` en `PlayerLine`);
  - "ELO pendiente" en el listado (`review` en `MixItem`);
  - el salto de la sala en vivo a la sala final (`match_id` en el `404`).
- **Módulos nuevos que quedaron afuera:**
  - Administración › Mapas (marcas y foto);
  - el selector del pool de mapas en Torneos y PCW;
  - el perfil sin reclamar.
- **Fotos de los mapas:** el admin todavía no cargó ninguna; sin foto, la franja queda lisa.

## Cómo revertir

Revertir el commit del frontend. No hay cambios de base ni de API.
