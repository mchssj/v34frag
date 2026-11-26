# Aviso de partida encontrada: guía de implementación

## Estado

Implementado y probado con Vitest el 2026-11-23. Todavía no se probó en un navegador real ni se desplegó.

## Archivos

| Archivo | Cambio |
|---|---|
| `web/frontend/src/features/matchmaking/alert.ts` | `useMatchFoundRepeat`; `notify` con `document.hasFocus()`, `requireInteraction` y clic que enfoca; `notificationsBlocked`; pitido más fuerte; corta el sonido anterior |
| `web/frontend/src/features/matchmaking/alert.test.ts` | Nuevo: repite a los 7 s, alterna el título y lo devuelve al aceptar |
| `web/frontend/src/features/matchmaking/AcceptDialog.tsx` | Prop `sound` y el hook mientras no aceptaste |
| `web/frontend/src/features/matchmaking/MatchAlerts.tsx` | Le pasa el sonido al diálogo; el título solo cambia mientras buscas |
| `web/frontend/src/features/matchmaking/PlayPage.tsx` | Le pasa el sonido al diálogo |
| `web/frontend/src/features/matchmaking/PlayPage.test.tsx` | Mock de las funciones nuevas de `alert` |
| `web/frontend/src/features/matchmaking/PlayBar.tsx` | Aviso de notificaciones bloqueadas |
| `docs/manual/jugador/buscar-partida.md` | Sonido que se repite, notificación y pantalla completa |

## Despliegue

Pendiente: es solo la web (build del frontend). No toca la API, la base ni los servidores.

## Pruebas

### Frontend (Vitest)

`pnpm typecheck`, `eslint src/features/matchmaking` y `vitest run src/features/matchmaking`: 13 archivos y 110 pruebas en verde, con la nueva `alert.test.ts`.

Falta una prueba a mano en el navegador: aceptar con la ventana en otro monitor, con otra pestaña y con un juego abierto.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

`git revert` del commit. No hay datos ni migraciones.
