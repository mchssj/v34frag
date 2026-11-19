// Recap de la temporada (bitácora 2026-11-19-estadisticas-de-temporada). La API manda `SeasonRecap`; el visor
// trabaja con personas con `nick` y `photo`, como el resto del perfil.

import type { Schemas } from "@/api/client"

export type ApiRecap = Schemas["SeasonRecap"]
export type EloPoint = Schemas["EloPoint"]
export type RecapClip = Schemas["FeaturedClip"]

/** Lo que muestra el globo de una persona: su temporada en pocas cifras. */
export type RecapPlayer = {
  nick: string
  photo: string | null
  level: number
  elo: number
  kd: number
  matches: number
}
type Mate = RecapPlayer & { together: number; won: number }

export type Compare = ApiRecap["compare"]
export type StatKey = keyof Compare

export type SeasonRecap = Omit<ApiRecap, "player" | "mates" | "rivals"> & {
  player: RecapPlayer
  mates: { most_played: Mate; most_wins: Mate } | null
  rivals: {
    victim: (RecapPlayer & { you_killed: number; killed_you: number }) | null
    nemesis: (RecapPlayer & { you_killed: number; killed_you: number }) | null
  } | null
}

type ApiPerson = ApiRecap["player"]
const person = (p: ApiPerson): RecapPlayer => ({
  nick: p.alias,
  photo: p.photo_url,
  level: p.level ?? 1,
  elo: p.elo,
  kd: p.kd,
  matches: p.matches,
})

export function fromApi(a: ApiRecap): SeasonRecap {
  return {
    ...a,
    player: person(a.player),
    mates: a.mates
      ? {
          most_played: {
            ...person(a.mates.most_played),
            together: a.mates.most_played.together,
            won: a.mates.most_played.won,
          },
          most_wins: {
            ...person(a.mates.most_wins),
            together: a.mates.most_wins.together,
            won: a.mates.most_wins.won,
          },
        }
      : null,
    rivals: a.rivals
      ? {
          victim: a.rivals.victim
            ? {
                ...person(a.rivals.victim),
                you_killed: a.rivals.victim.you_killed,
                killed_you: a.rivals.victim.killed_you,
              }
            : null,
          nemesis: a.rivals.nemesis
            ? {
                ...person(a.rivals.nemesis),
                you_killed: a.rivals.nemesis.you_killed,
                killed_you: a.rivals.nemesis.killed_you,
              }
            : null,
        }
      : null,
  }
}

/** Hasta cuándo cuenta: el cierre o, en vivo, el momento de la consulta. */
export const recapEnd = (r: {
  season: { closed_at: string | null; until: string }
}) => r.season.closed_at ?? r.season.until

/** "5 de noviembre" para una fecha (`AAAA-MM-DD`) o un instante ISO, en la hora de Argentina. */
export const dateLabel = (iso: string, month: "long" | "short" = "long") =>
  new Date(
    iso.length === 10 ? `${iso}T12:00:00-03:00` : iso
  ).toLocaleDateString("es-AR", {
    day: "numeric",
    month,
    timeZone: "America/Argentina/Buenos_Aires",
  })

// Sin recortar sufijos: dust2 y dust2_ob son mapas distintos.
export const mapLabel = (m: string) =>
  m.replace(/^(de|cs)_/, "").replace(/_/g, " ")
