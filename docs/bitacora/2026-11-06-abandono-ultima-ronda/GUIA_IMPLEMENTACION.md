# Irse en la última ronda no es abandono: guía de implementación

## Estado

Hecho y probado en local el 2026-11-06 (base local con la copia de producción). Commiteado el 2026-11-06 en `main` (la rama principal, por decisión de Daniel) y en `feat/frontend-fase-1`, y la base en `feat/mm-claim-en-sala`. **Desplegado el 2026-11-06 (14:56-15:02 UTC)** desde `main` (`8670768b`), sin salas, cola ni mixes en vivo, después del respaldo `20261106T145627Z` (también en R2)**, en la misma tanda que la `78`: `probar_77.sh` contra producción (5 de 5 y la inversa), la `77` desde `main` y la web `8670768b56ef`.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/77_mm_abandono_ultima_ronda.sql` | Nuevo: `mm_left_last_round` y el bucle de `csstv_link_game` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/77_mm_abandono_ultima_ronda.sql` | Nueva: inversa |
| `docs/bitacora/2026-11-06-abandono-ultima-ronda/pruebas/` | `prueba_77.sql` y `probar_77.sh` |
| `supabase/replanteo/README.md` | Fila de la `77` |
| `docs/manual/jugador/buscar-partida.md`, `elo-y-estadisticas.md` | La regla nueva |
| `web/frontend/src/features/legal/pages/TermsPage.tsx`, `terms/terminos.html` | Sección 7: irse en la última ronda no es abandono |
| `docs/bitacora/README.md`, `docs/PENDIENTES.md` | Fila e ítem |

## Despliegue (hecho el 2026-11-06, salvo el changelog)

1. **Ramas (hecho el 2026-11-06):** `main` es la principal (Daniel); el mismo commit en `feat/frontend-fase-1`, y el replanteo, su inversa y las pruebas en `feat/mm-claim-en-sala`. La web (términos) no va en `feat/mm-claim-en-sala`.
2. **Base del VPS:** respaldo, `./probar_77.sh "<conexión por el túnel>"` (corre todo en una transacción que se deshace), y después la `77` desde el archivo commiteado (LF), por el túnel o con `sudo sb psql`. Va después de la `75` y la `76`, que ya están. No necesita parar el matchmaking: solo reemplaza una función y suma otra.
3. **Web:** el build con los términos nuevos.
4. Publicar `CHANGELOG_DISCORD.txt`.

No toca el plugin ni los servidores de juego.

## Pruebas

- `probar_77.sh docker` (copia de producción del 2026-11-05): **5 de 5**. Partida 16-7 con cuatro desconectados al terminar: el que se fue en la última ronda (22 de 23), el del marcador final (23 de 23) y uno del rival en la última ronda quedan sin abandono, sin sanción y con ELO normal; el que se fue 3 rondas antes (20 de 23) queda como abandono, con su sanción y el ELO de abandono. La sala termina normal.
- La inversa deja `csstv_link_game` exactamente como estaba (mismo `md5`) y borra la función.
- Con la `77` aplicada, `mm_left_last_round` da `true` para los dos abandonos reales de producción (mew 18 de 19 y musul 22 de 23).
- `pnpm build` de la API (valida los links del manual) y `pnpm typecheck` de la web, sin errores.

## En qué se apartó del plan

Ninguno.

## Cómo revertir

La inversa (`reversas/77_mm_abandono_ultima_ronda.sql`) y revertir el manual y los términos.
