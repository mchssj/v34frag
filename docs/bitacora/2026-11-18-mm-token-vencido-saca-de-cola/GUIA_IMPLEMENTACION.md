# El token vencido del socket saca de la cola: guía de implementación

## Qué se hizo

1. `socket.ts`: `sendAuth` pasa a ser asíncrono y usa `freshToken()`; `mmSocket` lo implementa con `tokenStore` y `refreshSession`.
2. `socket.test.ts`: una prueba de la reconexión tras un `4001` con el token renovado.

## Cómo se probó

- `pnpm exec vitest run src/features/matchmaking/socket.test.ts`: 5 de 5.
- `tsc` y `eslint` sin errores.

## Lo que no se verificó

- **La causa no se confirmó con datos de producción**: no hubo acceso a la base desde la PC (SSH sin clave). Para confirmarla, las salidas de yue en `mm_queue_log` con `outcome = 'disconnected'` deberían caer alrededor de una hora después de su último pedido a la API.
- No se probó en un navegador real con la pestaña oculta más de una hora.

## Despliegue

Solo la web. **Desplegada el 2026-11-18**: `deploy/vps/desplegar.sh web`, versión `fbb852abb6fe` (commit `fbb852ab`), con las pruebas. Los cambios sin commit de otros (páginas legales) se guardaron en un stash durante el build y se devolvieron. Vuelta atrás: desplegar `4bd96203`. No toca la API, la base ni los servidores.
