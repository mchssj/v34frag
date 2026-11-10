# Esperar 1 min 30 s antes de poder pedir un reemplazo: guía de implementación

## Cambios respecto del plan

- Ninguno en lo que se hace. El plan decía commitear también en `feat/mm-claim-en-sala`; desde el 2026-11-10 solo importa `main` (Daniel), así que va solo ahí.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/109_mm_reemplazo_espera.sql` | Nuevo: la columna, `mm_set_config`, `csstv_mm_poll` y `csstv_mm_report` (reemplazos de texto que abortan si el fragmento no está o aparece dos veces) |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/109_mm_reemplazo_espera.sql` | Nuevo: la inversa |
| `supabase/replanteo/README.md` | Fila de la `109` |
| `web/frontend/src/features/matchmaking/admin/GeneralForm.tsx`, `types.ts` y `demo.ts` | El campo nuevo en Reemplazos |
| `terms/terminos.html` y `web/frontend/src/features/legal/pages/TermsPage.tsx` | El voto, pasado 1 min 30 s |
| `docs/manual/jugador/buscar-partida.md`, `jugador/comandos-en-el-servidor.md` y `admin/matchmaking.md` | Los 90 s y el campo |

## Pruebas

### Base local (`pruebas/probar_109.sh`, en una transacción que se deshace)

| # | Prueba | Resultado |
|---|---|---|
| 1 | `replace_min_away_s` es 90 por defecto | ok |
| 2 | Desconectado hace 30 s: no está en `away=`, `callreplace` devuelve `false` y no queda abandonado | ok |
| 3 | Desconectado hace 95 s: está en `away=`, `callreplace` lo da por abandonado y abre el reemplazo `vote` | ok |
| 4 | Un admin lo pone en 0 con `mm_set_config` y el que se fue recién aparece; 601 falla por el `check` | ok |
| 5 | La inversa deja las tres funciones idénticas y saca la columna | ok |

Sin servidor real: el plugin no cambia y arma el menú con `away=` como antes.

### Web

`pnpm typecheck`, `vitest` de `features/admin` y `features/matchmaking` (189), `eslint` y `prettier` sin errores en lo que se tocó.

## Despliegue

1. Base primero (la web nueva manda `replace_min_away_s` al guardar la configuración). `probar_109.sql` contra producción, que se deshace solo, y la `109` de verdad con `notify pgrst, 'reload schema'`. Se puede aplicar con salas en vivo: solo cambia qué desconectados se listan.
2. Web: `deploy/vps/desplegar.sh web` desde `main`.
3. El plugin no se toca: no hay que subir nada a los servidores ni esperar un cambio de mapa.

## Cómo deshacerlo

La inversa (`reversas/109_mm_reemplazo_espera.sql`) y, si se quiere, revertir la web. Con la web nueva y la base sin la `109`, guardar la configuración del matchmaking falla porque el campo no existe: revertir las dos juntas. Para apagarlo sin deshacer nada, poner el campo en 0.

**Estado: desplegado el 2026-11-10** (commit `64b6ffab`; a las 21:17 UTC, sin salas abiertas, la API y la web `64b6ffab9855`, con el manual nuevo en `/help`).

Antes, sin commit: `probar_109.sql` contra producción, 5 de 5 y deshecho; la `109` aplicada a las 20:28 UTC con una sala en vivo en el #1 (dust2_ob, 10-8), que siguió consultando la base sin errores; `replace_min_away_s` en 90. Web `c77b49e01d7c-local11102029`. **Falta:** desplegar la API para que `/help` muestre el manual nuevo (reinicia `cmleague-api`: sin mixes en curso), el commit en `main` y publicar el changelog.
