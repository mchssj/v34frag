# Vista previa del próximo recálculo de ranking (prototipo VIP)

Prototipo de Kyan para que lo terminen Daniel (backend) y Esteban (frontend). Está en el frontend nuevo (`repo-mm-ejemplo`, rama `kyan/ejemplo-matchmaking`), en `/demo/recalculo`, solo con `pnpm dev`.

## Qué hace

"El recálculo" es el **cierre de la temporada** (replanteo `24_temporadas.sql`). Ahí pasan tres cosas:

- Se guarda la foto del ranking.
- Los 20 primeros con al menos 20 mixes reciben su medalla.
- Los que pasan 2001 de ELO se reinician.

| Parte | Qué muestra |
|---|---|
| Encabezado | Cuenta regresiva al cierre y la fecha (06:00 de Argentina) |
| Si cerrara ahora | Tu puesto, la medalla que te tocaría, tu ELO después del reinicio y tus mixes contra el mínimo |
| Objetivos (VIP) | Cuántos mixes te faltan, cuánto ELO para el tramo siguiente y para el puesto de arriba, y cuánto le llevás al de abajo |
| Proyección (VIP) | Con sliders de victorias y derrotas: ELO, puesto y medalla proyectados con tu promedio por mix (+27 y −25 en la demo) |
| Alrededor tuyo | 7 puestos alrededor tuyo con su ELO después del cierre y su medalla |

La barra Demo tiene tres casos:

- **Me faltan mixes:** 17 de 20, sin puesto.
- **Estoy en el top:** #11, Top 20.
- **Fuera del top.**

## Reglas

`features/season/preview.ts` copia las reglas de la base. **Si cambian en la base, hay que cambiarlas acá.**

| Regla | Igual que |
|---|---|
| Reinicio: `piso + round((ELO − piso) × %)` solo si el ELO pasa el piso (2001 y 10 %) | `season_reset_elo` |
| Puesto solo con el mínimo de mixes. Orden: ELO, después más mixes, después la última partida más vieja | `season_rank` |
| Tramos: Campeón, Subcampeón, Tercer puesto, Top 10 y Top {top} | `season_tier` y los valores por defecto de `season_config` |

`preview.test.ts` controla el reinicio, los tramos, el desempate y los "te faltan".

## Archivos (en `web/frontend/src/`)

- `features/season/preview.ts`
- `features/season/preview.test.ts`
- `features/season/demo.ts`
- `features/season/RecalcPreview.tsx`
- `routes/demo.recalculo.tsx`

## Lo que falta para la versión real

- **Daniel:**
  - Una ruta con la fila del jugador logueado en `season_live_standings`, sus 3 vecinos de arriba y de abajo, y las reglas de la temporada activa (`top_n`, `min_matches`, `reset_pct`, `reset_floor`, `tiers`, `ends_at`).
  - Para la proyección hace falta el cambio promedio del jugador por victoria y por derrota en la temporada. Sale de `match_player_elo`.
- **Esteban:** el panel en el perfil o arriba del ranking de la temporada.
- **Aproximación:** la proyección mueve solo tu ELO y deja a los demás como están. Lo dice en pantalla.

## Pruebas (2026-10-29)

- Los 4 tests pasan.
- **Me faltan mixes:** "Te faltan 3 mixes" y ELO después del cierre de `2041 → 2005`. Con 3 victorias y 1 derrota proyecta el #16 y la medalla Top 20.
- **Estoy en el top:** el #11 con "+3 de ELO entrás a Top 10". Con la proyección pasa al #7 (Top 10).
