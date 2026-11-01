import { inputForProb, type BreakdownInput } from "./formula"

// Mixes de ejemplo para /demo/elo: cada uno muestra una regla distinta de la fórmula.

export interface DemoMix extends BreakdownInput {
  id: string
  date: string
  map: string
  score: [number, number]
  /** Qué regla muestra este mix (solo para la demo). */
  note: string
}

const mix = (
  id: string,
  date: string,
  map: string,
  score: [number, number],
  p: number,
  rest: Omit<
    BreakdownInput,
    "mu_team" | "mu_opp" | "c" | "total_rounds" | "elo_before"
  >,
  note: string
): Omit<DemoMix, "elo_before"> => ({
  id,
  date,
  map,
  score,
  ...inputForProb(p),
  total_rounds: score[0] + score[1],
  ...rest,
  note,
})

// Del más nuevo al más viejo. El ELO de antes se encadena desde START.
const RAW = [
  mix(
    "m10",
    "2026-10-29",
    "de_dust2",
    [13, 9],
    0.5,
    { result: 1, rating: 1.18, rounds: 22 },
    "Equipos parejos: se gana la base (30) más el bonus por rating."
  ),
  mix(
    "m9",
    "2026-10-28",
    "de_inferno",
    [8, 13],
    0.31,
    { result: 0, rating: 1.42, rounds: 21 },
    "Perder siendo el menos favorito resta poco, y el buen rating lo compensa."
  ),
  mix(
    "m8",
    "2026-10-28",
    "de_tuscan",
    [13, 4],
    0.86,
    { result: 1, rating: 0.82, rounds: 17 },
    "Ganar siendo muy favorito da poco, y el rating bajo resta."
  ),
  mix(
    "m7",
    "2026-10-27",
    "de_nuke",
    [13, 11],
    0.27,
    { result: 1, rating: 1.95, rounds: 24 },
    "Ganar siendo el menos favorito da mucho. El bonus llega al tope de +5."
  ),
  mix(
    "m6",
    "2026-10-26",
    "de_train",
    [11, 13],
    0.55,
    { result: 0, rating: 1.03, rounds: 15 },
    "Jugó 15 de 24 rondas (63 %): el cambio se multiplica por 0,63."
  ),
  mix(
    "m5",
    "2026-10-25",
    "de_cbble",
    [13, 6],
    0.5,
    { result: 1, rating: 1.2, rounds: 7 },
    "Jugó 7 de 19 rondas (37 %), apenas arriba del 35 %."
  ),
  mix(
    "m4",
    "2026-10-25",
    "de_dust2",
    [13, 10],
    0.6,
    { result: 1, rating: 1.1, rounds: 6 },
    "Jugó 6 de 23 rondas (26 %): menos del 35 %, el ELO no cambia."
  ),
  mix(
    "m3",
    "2026-10-24",
    "de_inferno",
    [13, 2],
    0.99,
    { result: 1, rating: 0.55, rounds: 15 },
    "Muy favorito y rating bajo: la cuenta da negativo, pero el ganador suma al menos 1."
  ),
  mix(
    "m2",
    "2026-10-23",
    "de_mirage",
    [12, 12],
    0.62,
    { result: 0.5, rating: 1.25, rounds: 24 },
    "Empate: siendo favorito se pierde un poco, el rating lo mejora."
  ),
  mix(
    "m1",
    "2026-10-22",
    "de_nuke",
    [5, 13],
    0.48,
    { result: 0, rating: 0.71, rounds: 18 },
    "Derrota normal con rating bajo: resta la base y también el bonus."
  ),
]

export const START_ELO = 1460

export { RAW as DEMO_MIXES_RAW }
