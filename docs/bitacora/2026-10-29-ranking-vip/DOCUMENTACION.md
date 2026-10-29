# Marcas VIP en el ranking y Top VIP del mes (prototipo)

Está en `/demo/ranking-vip` del frontend nuevo (`repo-mm-ejemplo`, rama `kyan/ejemplo-matchmaking`), solo con `pnpm dev`.

## Qué hace

- **Ranking:** es la misma tabla de `PlayersRanking` (`HistoricRow`).
  - Los VIP tienen el aro dorado en el avatar, el nick en dorado, la medalla VIP al lado y la fila apenas dorada.
  - Los verificados tienen el tilde azul.
  - Un switch de la barra Demo deja mostrar solo los VIP.
- **Top VIP de octubre:** el podio del ranking (`Podium`) con los 3 VIP que más ELO ganaron en el mes, con al menos 10 mixes. Debajo están los puestos 4 a 10.

## Archivos (en `web/frontend/src/`)

| Archivo | Qué tiene |
|---|---|
| `features/vip/VipName.tsx` | `VipName` (nick con verificado y medalla) y `VipAvatar` (avatar con aro). Sirven para cualquier lista |
| `features/vip/RankingVip.tsx` | El Top VIP (`topVip()`) y la tabla |
| `features/vip/demo.ts` | Los jugadores del buscador con puesto, verificado, ELO del mes, tendencia y meses de VIP. Lo usan también las favoritas, los créditos y las stats del torneo |
| `routes/demo.ranking-vip.tsx` | La ruta |

## Lo que falta para la versión real

- **Daniel:**
  - `vip` y `verified` en `RankingPlayer`, y en cualquier lista de jugadores.
  - Una ruta para el Top VIP del mes con el ELO ganado y los mixes del mes.
  - Decidir qué es "verificado": en el prototipo es Steam vinculado y mail confirmado, y todos los VIP están verificados.
- **Esteban:** usar `VipName` y `VipAvatar` en el ranking y en las demás listas.

## Pruebas (2026-10-29)

- En el navegador se ven el podio, los puestos 4 a 10 y la tabla con las marcas.
- No hubo errores en la consola.
- No se revisó en modo claro.
