import type { EventMatch, Standing } from "../types"
import { groupLetter, type Config, type Template } from "./model"

// Fases de la pestaña Llave y lo que dibuja cada una (ver docs/bitacora/2026-10-31-llave-por-formato).

export type PhaseKind = "tree" | "groups" | "swiss" | "groups_double"
export type PhaseStatus = "done" | "live" | "pending"

export type Phase = {
  /** Va en la URL (`?phase=`): `playoffs`, `bracket`, `groups`, `swiss-1`… */
  key: string
  label: string
  kind: PhaseKind
  status: PhaseStatus
  matches: EventMatch[]
  /** Suizo: número de fase. */
  swiss?: number
}

export type TeamRef = NonNullable<EventMatch["side1"]["team"]>

const num = (v: unknown) => (typeof v === "number" ? v : undefined)
const isOver = (m: EventMatch) =>
  m.status === "finished" || m.status === "cancelled"

function statusOf(ms: EventMatch[]): PhaseStatus {
  if (ms.some((m) => m.status === "live")) return "live"
  return ms.length > 0 && ms.every(isOver) ? "done" : "pending"
}

const DOUBLE_STAGES = ["upper", "lower", "grand", "third"]
const GROUP_DOUBLE_STAGES = ["group_upper", "group_lower"]
const PLAYOFF_STAGES = ["ko", "third"]

/** Fases de la plantilla, en orden. Playoffs aparece aunque todavía no tenga partidas. */
export function phasesOf(
  matches: EventMatch[],
  template: Template,
  config: Config
): Phase[] {
  const games = matches.filter((m) => !m.bye)
  const of = (stages: string[]) =>
    games.filter((m) => stages.includes(m.stage ?? ""))
  const phase = (
    key: string,
    label: string,
    kind: PhaseKind,
    ms: EventMatch[],
    swiss?: number
  ): Phase => ({ key, label, kind, status: statusOf(ms), matches: ms, swiss })
  const playoffs = phase("playoffs", "Playoffs", "tree", of(PLAYOFF_STAGES))

  switch (template) {
    case "single":
      return [playoffs]
    case "double":
      return [phase("bracket", "Llave", "tree", of(DOUBLE_STAGES))]
    case "groups":
      return [
        phase("groups", "Fase de grupos", "groups", of(["group"])),
        playoffs,
      ]
    case "groups_double":
      return [
        phase("groups", "Grupos", "groups_double", of(GROUP_DOUBLE_STAGES)),
        playoffs,
      ]
    case "swiss": {
      const swiss = of(["swiss"])
      const count = Math.max(
        num(config.stages) ?? 1,
        ...swiss.map((m) => m.phase ?? 1)
      )
      return [
        ...Array.from({ length: count }, (_, i) =>
          phase(
            `swiss-${i + 1}`,
            count === 1 ? "Fase suiza" : `Fase suiza ${i + 1}`,
            "swiss",
            swiss.filter((m) => (m.phase ?? 1) === i + 1),
            i + 1
          )
        ),
        playoffs,
      ]
    }
  }
}

/** La que se está jugando; si no, la primera con partidas por jugar; si no, la última jugada. */
export function defaultPhase(phases: Phase[]): Phase {
  return (
    phases.find((p) => p.status === "live") ??
    phases.find((p) => p.matches.some((m) => m.status === "upcoming")) ??
    phases.findLast((p) => p.matches.length > 0) ??
    phases[0]
  )
}

/** Aviso de una fase sin partidas. */
export function emptyPhaseText(phase: Phase, template: Template) {
  if (phase.key === "playoffs") {
    if (template === "swiss")
      return "Los playoffs se arman cuando termina el suizo."
    if (template === "groups" || template === "groups_double")
      return "Los playoffs se arman cuando termina la fase de grupos."
  }
  if (phase.kind === "swiss" && (phase.swiss ?? 1) > 1)
    return "Esta fase se arma cuando termina la anterior."
  return "La llave se arma cuando se cierran las inscripciones."
}

// ---- Origen y destino de cada lado (llaves) ----

/** Etapas de eliminación donde el ganador pasa a la ronda siguiente en la posición (pos + 1) / 2. */
const TREE_STAGES = ["ko", "upper", "group_upper"]

const sameBracket = (a: EventMatch, b: EventMatch) =>
  a.stage === b.stage && a.grp === b.grp && a.phase === b.phase

/** "Semifinal 1" si la ronda tiene varias partidas; "Final" si es una sola. */
function matchName(m: EventMatch, all: EventMatch[]) {
  const label = m.label?.replace(/^Grupo [A-Z] · /, "") ?? "la ronda anterior"
  const many =
    all.filter((x) => sameBracket(x, m) && x.round === m.round).length > 1
  return many && m.pos ? `${label} ${m.pos}` : label
}

/**
 * De dónde sale un lado sin equipo: lo que mande el backend (`side.name`), la partida que apunta
 * a este lado con `next_win`/`next_lose` (E22) o, si no vienen, el ganador de la partida anterior
 * deducido por ronda y posición. Si no se puede saber, null ("Por definir").
 */
export function originOf(
  m: EventMatch,
  side: 1 | 2,
  all: EventMatch[]
): string | null {
  const s = side === 1 ? m.side1 : m.side2
  if (s.team) return null
  if (s.name) return s.name
  const winner = all.find(
    (x) => x.next_win === m.id && x.next_win_slot === side
  )
  if (winner) return winner.bye ? null : `Ganador de ${matchName(winner, all)}`
  const loser = all.find(
    (x) => x.next_lose === m.id && x.next_lose_slot === side
  )
  if (loser) return `Perdedor de ${matchName(loser, all)}`
  const round = m.round ?? 1
  if (m.stage === "third") {
    const semis = all.filter(
      (x) => x.stage === "ko" && x.phase === m.phase && x.grp === m.grp
    )
    const last = Math.max(0, ...semis.map((x) => x.round ?? 1))
    const semi = semis.find((x) => x.round === last - 1 && x.pos === side)
    return semi ? `Perdedor de ${matchName(semi, all)}` : null
  }
  if (!TREE_STAGES.includes(m.stage ?? "") || round === 1 || !m.pos) return null
  const prev = all.find(
    (x) =>
      sameBracket(x, m) &&
      x.round === round - 1 &&
      x.pos === m.pos! * 2 - (side === 1 ? 1 : 0)
  )
  return prev && !prev.bye ? `Ganador de ${matchName(prev, all)}` : null
}

export type Dest = { text: string; tone: "up" | "down" | "out" }

/**
 * Marca junto al resultado de cada lado: a qué ronda del lower baja el que pierde en el upper,
 * quién pasa a la gran final o a playoffs y quién queda eliminado (con su puesto si lo hay).
 */
export function destinationsOf(
  all: EventMatch[],
  template: Template,
  standings: Standing[] = []
): Map<string, [Dest | null, Dest | null]> {
  const out = new Map<string, [Dest | null, Dest | null]>()
  const lastRound = (m: EventMatch) =>
    Math.max(
      0,
      ...all.filter((x) => sameBracket(x, m)).map((x) => x.round ?? 1)
    )
  const placeOf = (teamId: string, grp: number | null) =>
    standings.find(
      (s) =>
        s.stage === "group_double" &&
        s.team.id === teamId &&
        (grp == null || s.grp === grp)
    )
  const byId = new Map(all.map((x) => [x.id, x]))
  const next = (teamId: string, m: EventMatch, stages: string[]) =>
    all.find(
      (x) =>
        stages.includes(x.stage ?? "") &&
        x.grp === m.grp &&
        x.phase === m.phase &&
        (x.round ?? 1) >= 1 &&
        x.id !== m.id &&
        [x.side1.team?.id, x.side2.team?.id].includes(teamId) &&
        // Solo lo que se juega después: en el lower, rondas posteriores al cruce.
        (x.stage !== m.stage || (x.round ?? 1) > (m.round ?? 1))
    )

  for (const m of all) {
    if (m.status !== "finished" || !m.winner_side) continue
    const stage = m.stage ?? ""
    const groupStage = stage === "group_upper" || stage === "group_lower"
    if (!["upper", "lower", ...GROUP_DOUBLE_STAGES].includes(stage)) continue
    const sides = [m.side1, m.side2]
    const marks: [Dest | null, Dest | null] = [null, null]
    const isLast = (m.round ?? 1) === lastRound(m)

    sides.forEach((s, i) => {
      const id = s.team?.id
      if (!id) return
      const won = m.winner_side === i + 1
      const st = groupStage ? placeOf(id, m.grp) : undefined
      if (won) {
        if (!isLast) return
        if (groupStage) {
          if (st?.state === "qualified") marks[i] = { text: "→ PO", tone: "up" }
        } else if (template === "double") {
          marks[i] = { text: "→ GF", tone: "up" }
        }
        return
      }
      if (stage === "upper" || stage === "group_upper") {
        // Con el enlace de la base (E22) se sabe antes de que el equipo aparezca en el lower.
        const linked = m.next_lose ? byId.get(m.next_lose) : undefined
        const lower =
          linked ?? next(id, m, [groupStage ? "group_lower" : "lower"])
        if (lower) marks[i] = { text: `↓ L${lower.round ?? 1}`, tone: "down" }
        return
      }
      // Perdió en el lower.
      if (st?.state === "qualified") marks[i] = { text: "→ PO", tone: "up" }
      else
        marks[i] = {
          text: st?.place ? `✕ ${st.place}.º` : "✕",
          tone: "out",
        }
    })
    if (marks[0] || marks[1]) out.set(m.id, marks)
  }
  return out
}

// ---- Suizo ----

export type SwissBucket = {
  record: string
  wins: number
  losses: number
  /** null en una ronda que todavía no se armó. */
  bo: number | null
  /** null: partida por armar. */
  matches: (EventMatch | null)[]
}

export type SwissRound = { round: number; buckets: SwissBucket[] }

export type SwissResult = {
  record: string
  wins: number
  losses: number
  /** Cuántos equipos terminan con ese récord. */
  slots: number
  teams: TeamRef[]
}

export type SwissGrid = {
  wins: number
  rounds: SwissRound[]
  qualified: SwissResult[]
  eliminated: SwissResult[]
}

const recKey = (w: number, l: number) => `${w}:${l}`

/** Récords que juegan en una ronda: los equipos de cada uno se reparten por mitades. */
function projectCounts(start: Map<string, number>, wins: number) {
  const next = new Map<string, number>()
  for (const [k, c] of start) {
    const [w, l] = k.split(":").map(Number)
    if (w >= wins || l >= wins) continue
    const add = (key: string, n: number) =>
      next.set(key, (next.get(key) ?? 0) + n)
    add(recKey(w + 1, l), c / 2)
    add(recKey(w, l + 1), c / 2)
  }
  return next
}

const byRecord = (a: string, b: string) => {
  const [aw, al] = a.split(":").map(Number)
  const [bw, bl] = b.split(":").map(Number)
  return bw - aw || al - bl
}

/**
 * Grilla del suizo: el récord de cada partida se calcula repitiendo las rondas terminadas; las
 * rondas que el sistema todavía no armó se proyectan con partidas por armar.
 */
export function swissGrid(
  matches: EventMatch[],
  opts: { wins: number; size?: number; bo?: number; boDecisive?: number }
): SwissGrid {
  const { wins } = opts
  const games = matches.filter((m) => !m.bye && m.stage === "swiss")
  const first = games.filter((m) => (m.round ?? 1) === 1)
  const size = opts.size ?? first.length * 2
  const rec = new Map<string, { w: number; l: number }>()
  const recOf = (id: string | undefined) =>
    (id && rec.get(id)) || { w: 0, l: 0 }
  const teams = new Map<string, TeamRef>()

  // Equipos por récord al empezar cada ronda, según lo jugado (o proyectado).
  let counts = new Map([[recKey(0, 0), size]])
  const rounds: SwissRound[] = []
  const totalRounds = wins * 2 - 1
  const lastExisting = Math.max(0, ...games.map((m) => m.round ?? 1))

  for (let r = 1; r <= totalRounds; r++) {
    const list = games
      .filter((m) => (m.round ?? 1) === r)
      .toSorted((a, b) => (a.pos ?? 0) - (b.pos ?? 0))
    const buckets = new Map<string, SwissBucket>()
    const bucket = (k: string) => {
      let b = buckets.get(k)
      if (!b) {
        const [w, l] = k.split(":").map(Number)
        const decisive = w === wins - 1 || l === wins - 1
        // En una ronda que todavía no existe, el BO sale de la configuración.
        const bo =
          r > lastExisting ? (decisive ? opts.boDecisive : opts.bo) : null
        b = { record: k, wins: w, losses: l, bo: bo ?? null, matches: [] }
        buckets.set(k, b)
      }
      return b
    }
    for (const m of list) {
      const a = recOf(m.side1.team?.id)
      const b = bucket(recKey(a.w, a.l))
      b.matches.push(m)
      b.bo ??= m.best_of
    }
    // Lo que falta armar en cada récord (rondas futuras o una ronda a medio generar).
    for (const [k, c] of counts) {
      const [w, l] = k.split(":").map(Number)
      if (w >= wins || l >= wins) continue
      const b = bucket(k)
      const missing = Math.floor(c / 2) - b.matches.length
      for (let i = 0; i < missing; i++) b.matches.push(null)
    }
    rounds.push({
      round: r,
      buckets: [...buckets.values()].sort((x, y) =>
        byRecord(x.record, y.record)
      ),
    })
    // Resultados jugados: actualizan el récord real de cada equipo.
    for (const m of list) {
      for (const s of [m.side1, m.side2])
        if (s.team) {
          teams.set(s.team.id, s.team)
          if (!rec.has(s.team.id)) rec.set(s.team.id, { w: 0, l: 0 })
        }
      if (m.status !== "finished" || !m.winner_side) continue
      const win = (m.winner_side === 1 ? m.side1 : m.side2).team?.id
      const lose = (m.winner_side === 1 ? m.side2 : m.side1).team?.id
      if (win) rec.get(win)!.w++
      if (lose) rec.get(lose)!.l++
    }
    counts = projectCounts(counts, wins)
  }

  // Cuántos terminan con cada récord: proyección desde el 0:0 (exacta con 8 o 16 equipos).
  const finals = new Map<string, number>()
  let c = new Map([[recKey(0, 0), size]])
  for (let r = 1; r <= totalRounds; r++) {
    c = projectCounts(c, wins)
    for (const [k, n] of c) {
      const [w, l] = k.split(":").map(Number)
      if (w === wins || l === wins) finals.set(k, (finals.get(k) ?? 0) + n)
    }
  }
  const result = (w: number, l: number): SwissResult => ({
    record: recKey(w, l),
    wins: w,
    losses: l,
    slots: finals.get(recKey(w, l)) ?? 0,
    teams: [...rec.entries()]
      .filter(([, x]) => x.w === w && x.l === l)
      .map(([id]) => teams.get(id)!)
      .filter(Boolean),
  })
  return {
    wins,
    rounds,
    qualified: Array.from({ length: wins }, (_, l) => result(wins, l)),
    eliminated: Array.from({ length: wins }, (_, w) => result(w, wins)),
  }
}

/** Récords del suizo a partir de la configuración del torneo (por defecto 16 equipos a 3). */
export function swissOptions(config: Config) {
  const playoffs = (config.playoffs ?? {}) as Config
  return {
    wins: num(config.wins) ?? 3,
    size: num(config.size),
    bo: num(config.bo) ?? 1,
    boDecisive: num(config.bo_decisive) ?? num(playoffs.bo) ?? 3,
  }
}

// ---- Fase de grupos ----

export type GroupRound = { round: number; matches: EventMatch[] }

export type GroupView = {
  grp: number
  title: string
  rounds: GroupRound[]
  /** Equipos en el orden de la tabla (o de aparición si no hay posiciones). */
  teams: TeamRef[]
  rows: Standing[]
}

/** Grupos con sus fechas, los equipos en el orden de la tabla y sus posiciones. */
export function groupsOf(
  matches: EventMatch[],
  standings: Standing[]
): GroupView[] {
  const map = new Map<number, EventMatch[]>()
  for (const m of matches)
    if (m.stage === "group" && !m.bye)
      map.set(m.grp ?? 1, [...(map.get(m.grp ?? 1) ?? []), m])
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([grp, list]) => {
      const rows = standings
        .filter((s) => s.stage === "group" && s.grp === grp)
        .toSorted((a, b) => a.place - b.place)
      const seen = new Map<string, TeamRef>()
      for (const r of rows) seen.set(r.team.id, r.team)
      for (const m of list)
        for (const s of [m.side1, m.side2])
          if (s.team && !seen.has(s.team.id)) seen.set(s.team.id, s.team)
      const rounds = new Map<number, EventMatch[]>()
      for (const m of list)
        rounds.set(m.round ?? 1, [...(rounds.get(m.round ?? 1) ?? []), m])
      return {
        grp,
        title: `Grupo ${groupLetter(grp)}`,
        rows,
        teams: [...seen.values()],
        rounds: [...rounds.entries()]
          .sort(([a], [b]) => a - b)
          .map(([round, ms]) => ({
            round,
            matches: ms.toSorted((a, b) => (a.pos ?? 0) - (b.pos ?? 0)),
          })),
      }
    })
}

/** Partidas entre dos equipos de un grupo (dos si es a ida y vuelta). */
export function crossOf(group: GroupView, a: string, b: string) {
  return group.rounds
    .flatMap((r) => r.matches)
    .filter((m) => {
      const ids = [m.side1.team?.id, m.side2.team?.id]
      return ids.includes(a) && ids.includes(b)
    })
}

/** Resultado de una partida desde el lado de `teamId`: "13:7" o la serie "2:1". */
export function scoreFrom(m: EventMatch, teamId: string) {
  const mine = m.side1.team?.id === teamId
  const [a, b] = [m.side1.score ?? 0, m.side2.score ?? 0]
  return mine ? `${a}:${b}` : `${b}:${a}`
}

export function wonBy(m: EventMatch, teamId: string): boolean | null {
  if (m.status !== "finished" || !m.winner_side) return null
  return (m.winner_side === 1 ? m.side1 : m.side2).team?.id === teamId
}
