import type { ClipConfig, ClipConfigPatch, ClipType } from "./queries"

// Reglas de la sección Clips que no dependen de React.

export const CLIP_TYPES: { type: ClipType; label: string; desc: string }[] = [
  { type: "ace", label: "Ace", desc: "5 kills en la ronda" },
  { type: "clutch_5", label: "1v5", desc: "Ganó solo contra 5" },
  { type: "clutch_4", label: "1v4", desc: "Ganó solo contra 4" },
  { type: "4k", label: "4K", desc: "4 kills en la ronda" },
  { type: "clutch_3", label: "1v3", desc: "Ganó solo contra 3" },
  { type: "3k", label: "3K", desc: "3 kills en la ronda" },
  { type: "clutch_2", label: "1v2", desc: "Ganó solo contra 2" },
  { type: "clutch_1", label: "1v1", desc: "Ganó solo contra 1" },
]

export const clipLabel = (t: ClipType) =>
  CLIP_TYPES.find((c) => c.type === t)?.label ?? t

/** Escala de fábrica (contrato admin.md). */
export const FACTORY_PRIORITIES: ClipConfig["priorities"] = {
  ace: 1,
  clutch_5: 2,
  clutch_4: 2,
  "4k": 3,
  clutch_3: 4,
  "3k": 5,
  clutch_2: 6,
  clutch_1: 7,
}

export const CAPS = [
  {
    key: "per_player",
    label: "Clips por jugador",
    help: "En cada partida. Una ficha con varios SteamID cuenta como uno.",
    min: 1,
    max: 10,
  },
  {
    key: "per_match",
    label: "Clips por partida",
    help: "El top de cada partida.",
    min: 1,
    max: 50,
  },
  {
    key: "vip_per_match",
    label: "Clips por VIP",
    help: "Aparte del top, de cada VIP. 0 los apaga.",
    min: 0,
    max: 10,
  },
] as const

const inRange = (v: number, min: number, max: number) =>
  Number.isInteger(v) && v >= min && v <= max

/** Por qué no se puede guardar, o null. */
export function clipConfigError(c: ClipConfig): string | null {
  if (!Object.values(c.priorities).every((v) => inRange(v, 1, 99)))
    return "Cada prioridad va de 1 a 99."
  for (const k of CAPS)
    if (!inRange(c[k.key], k.min, k.max))
      return `${k.label}: de ${k.min} a ${k.max}.`
  return null
}

/** Solo lo que cambió (en `priorities`, solo los tipos que cambiaron), como pide el PATCH. */
export function clipPatch(
  saved: ClipConfig,
  draft: ClipConfig
): ClipConfigPatch {
  const patch: ClipConfigPatch = {}
  const prio: NonNullable<ClipConfigPatch["priorities"]> = {}
  for (const { type } of CLIP_TYPES)
    if (draft.priorities[type] !== saved.priorities[type])
      prio[type] = draft.priorities[type]
  if (Object.keys(prio).length) patch.priorities = prio
  for (const k of CAPS)
    if (draft[k.key] !== saved[k.key]) patch[k.key] = draft[k.key]
  return patch
}

export type SamplePlay = {
  type: ClipType
  player: string
  roundWon: boolean
  round: number
  vip: boolean
}

/** Jugadas inventadas de un mix, para el ejemplo "Así quedaría un mix". */
export const SAMPLE_PLAYS: SamplePlay[] = [
  { type: "3k", player: "Sapo", roundWon: true, round: 4, vip: false },
  { type: "clutch_2", player: "Rulo", roundWon: true, round: 9, vip: false },
  { type: "4k", player: "Chispa", roundWon: true, round: 12, vip: false },
  { type: "3k", player: "Sapo", roundWon: false, round: 15, vip: false },
  { type: "clutch_1", player: "Halcón", roundWon: true, round: 18, vip: true },
  { type: "ace", player: "Tiza", roundWon: true, round: 21, vip: false },
  { type: "3k", player: "Rulo", roundWon: true, round: 23, vip: false },
  { type: "clutch_3", player: "Sapo", roundWon: true, round: 25, vip: false },
]

/**
 * Qué clips se mostrarían: por prioridad, después la ronda ganada y después la más tardía, con el
 * tope por jugador y por partida; y aparte, los de cada VIP que quedaron afuera.
 */
export function pickClips(plays: SamplePlay[], c: ClipConfig) {
  const sorted = [...plays].sort(
    (a, b) =>
      c.priorities[a.type] - c.priorities[b.type] ||
      Number(b.roundWon) - Number(a.roundWon) ||
      b.round - a.round
  )
  const per = new Map<string, number>()
  const top: SamplePlay[] = []
  const rest: SamplePlay[] = []
  for (const p of sorted) {
    const n = per.get(p.player) ?? 0
    if (top.length < c.per_match && n < c.per_player) {
      top.push(p)
      per.set(p.player, n + 1)
    } else rest.push(p)
  }
  const vipCount = new Map<string, number>()
  const vip = rest.filter((p) => {
    if (!p.vip) return false
    const n = vipCount.get(p.player) ?? 0
    if (n >= c.vip_per_match) return false
    vipCount.set(p.player, n + 1)
    return true
  })
  return { top, vip }
}
