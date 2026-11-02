import type { Schemas } from "@/api/client"
import type { matchDetailOptions } from "@/features/shell/api/queries"

// Página de una serie de torneo o PCW (bitácora 2026-11-01-pagina-serie). Funciones puras sobre
// GET /matches/{id}.

/** El tipo que devuelve la consulta (los `team` nulables vienen corregidos ahí). */
export type SeriesDetail = NonNullable<
  Awaited<
    ReturnType<NonNullable<ReturnType<typeof matchDetailOptions>["queryFn"]>>
  >
>
type Game = SeriesDetail["games"][number]
type Clip = Schemas["Clip"]

export type SeriesMap = {
  /** 1, 2, 3… en el orden en que se juegan. */
  n: number
  map: string | null
  r1: number | null
  r2: number | null
  /** Quién lo eligió en el veto (1 o 2), null si es el decisivo o no hubo veto. */
  pick: 1 | 2 | null
  decider: boolean
  /** Ganador del mapa (1 o 2), null si no se terminó. */
  winner: 1 | 2 | null
  game: Game | null
  /** Resultado cargado a mano, sin juego vinculado: no hay stats. */
  manual: boolean
  /** Se está jugando ahora: el uid de la sala en vivo. */
  live: boolean
  liveUid: string | null
  /** Era del veto pero la serie se definió antes. */
  leftOver: boolean
}

const sideOfTeam = (d: SeriesDetail, team: string | null): 1 | 2 | null =>
  team && team === d.side1.team?.id
    ? 1
    : team && team === d.side2.team?.id
      ? 2
      : null

/** Los mapas de la serie: los jugados (o a mano), el que está en vivo y los que faltan del veto. */
export function seriesMaps(d: SeriesDetail): SeriesMap[] {
  const planned = d.veto?.maps_to_play ?? []
  const played = d.maps_detail.filter((x) => x.r1 != null || x.r2 != null)
  const names: (string | null)[] = played.map((x) => x.map)
  for (const p of planned) if (!names.includes(p.map)) names.push(p.map)
  if (d.live?.map && !names.includes(d.live.map)) names.push(d.live.map)
  const decided = d.status === "finished" || d.status === "cancelled"

  return names.map((map, i) => {
    const detail = played.find((x) => x.map === map) ?? null
    const game = detail?.game_id
      ? (d.games.find((g) => g.id === detail.game_id) ?? null)
      : null
    const pickAction = d.veto?.actions.find(
      (a) => a.action === "pick" && a.map === map
    )
    const live = !detail && !!d.live && d.live.map === map
    // En vivo, el marcador de rondas del mapa que se está jugando.
    const r1 = detail?.r1 ?? (live ? d.live!.score1 : null)
    const r2 = detail?.r2 ?? (live ? d.live!.score2 : null)
    return {
      n: i + 1,
      map,
      r1,
      r2,
      pick: pickAction ? sideOfTeam(d, pickAction.team_id) : null,
      decider: planned.some((p) => p.map === map && p.decider),
      winner:
        !live && r1 != null && r2 != null && r1 !== r2
          ? r1 > r2
            ? 1
            : 2
          : null,
      game,
      manual: !!detail && !detail.game_id,
      live,
      liveUid: live ? d.live!.uid : null,
      leftOver: !detail && !live && decided,
    }
  })
}

/** El veto en texto: "Tormenta sacó de_nuke", "Kraken eligió de_dust2", "de_inferno quedó como decisivo". */
export function vetoLines(d: SeriesDetail): string[] {
  if (!d.veto) return []
  const name = (team: string | null) => {
    const s = sideOfTeam(d, team)
    return s === 1
      ? (d.side1.team?.name ?? d.side1.name ?? "Equipo 1")
      : s === 2
        ? (d.side2.team?.name ?? d.side2.name ?? "Equipo 2")
        : "Sorteo"
  }
  const lines = [...d.veto.actions]
    .sort((a, b) => a.seq - b.seq)
    .map(
      (a) =>
        `${name(a.team_id)} ${a.action === "ban" ? "sacó" : "eligió"} ${a.map}`
    )
  const decider = d.veto.maps_to_play.find((m) => m.decider)
  if (decider) lines.push(`${decider.map} quedó como decisivo`)
  return lines
}

export type LineupPlayer = { name: string; rating: number | null }

/**
 * Alineaciones: con mapas jugados, los que jugaron con el rating de la serie; si no, los
 * inscritos con el de las últimas 4 semanas en 5v5.
 */
export function lineups(d: SeriesDetail): {
  sides: [LineupPlayer[], LineupPlayer[]]
  source: "series" | "recent" | null
} {
  if (d.series_players.length > 0) {
    const of = (n: 1 | 2) =>
      d.series_players
        .filter((p) => p.side === n)
        .map((p) => ({
          name: p.alias ?? p.game_nick ?? "Jugador",
          rating: p.rating,
        }))
    return { sides: [of(1), of(2)], source: "series" }
  }
  const of = (r: SeriesDetail["roster1"]) =>
    r.map((p) => ({ name: p.alias, rating: p.rating ?? null }))
  const sides: [LineupPlayer[], LineupPlayer[]] = [of(d.roster1), of(d.roster2)]
  const rated = [...sides[0], ...sides[1]].some((p) => p.rating != null)
  return { sides, source: rated ? "recent" : null }
}

export type SeriesClip = Clip & { map: string | null; mapN: number }

/** Los clips del carrusel: por mapa y por puesto. Los que nunca van a tener video no van. */
export function carouselClips(
  maps: SeriesMap[],
  byGame: Map<string, Clip[]>
): SeriesClip[] {
  return maps.flatMap((m) =>
    m.game
      ? (byGame.get(m.game.id) ?? [])
          .filter((c) =>
            ["pending", "processing", "done"].includes(c.video.status)
          )
          .sort((a, b) => a.position - b.position)
          .map((c) => ({ ...c, map: m.map, mapN: m.n }))
      : []
  )
}

/** Si el carrusel tiene que decir "Procesando clips…" aunque todavía no haya ninguno. */
export function clipsPending(maps: SeriesMap[], now = Date.now()): boolean {
  return maps.some(
    (m) =>
      !!m.game &&
      m.game.demo_status === "pending" &&
      !!m.game.played_at &&
      now - Date.parse(m.game.played_at) < 6 * 3600_000
  )
}

/** Etiqueta del clip: ACE, 4K, 3K o 1v3. */
export const clipKind = (type: string) =>
  type === "ace"
    ? "ACE"
    : type.startsWith("clutch_")
      ? `1v${type.slice(7)}`
      : type.toUpperCase()
