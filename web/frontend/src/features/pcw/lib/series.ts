import type { BestOf, PcwBooking, VetoAction, VetoKind } from "../types"

// Reglas de la serie de una PCW después de "los dos listos" (replanteo 56). Puras: las usa la demo y las prueba
// series.test.ts. El orden del veto es el de la demo; el real lo decide veto_act en la base.

/** Turno del veto en segundos. */
export const VETO_TURN_S = 30
/** Espera para entrar: 15 min el primer mapa, 5 los siguientes. */
export const waitMinutes = (mapNo: number) => (mapNo === 1 ? 15 : 5)
/** Jugadores que tiene que tener adentro cada equipo (los stand-ins cuentan). */
export const NEEDED = 5
/** Sanción por abandonar: 3 días, 7 si se repite en 30 días. */
export const banDays = (repeat: boolean) => (repeat ? 7 : 3)

export type VetoStep = { kind: VetoKind; by: "us" | "them" }

/**
 * Orden del veto hasta que queda un mapa (el decisivo): dos bans, los picks (bo − 1) y bans hasta el final.
 * Empieza el equipo que publicó la PCW ("us" en la demo) y se alternan.
 */
export function vetoOrder(bo: BestOf, poolSize: number): VetoStep[] {
  if (poolSize < bo) throw new Error("El pool tiene menos mapas que el formato")
  const steps = poolSize - 1
  const picks = bo - 1
  const bans = steps - picks
  const first = Math.min(2, bans)
  const kinds: VetoKind[] = [
    ...Array<VetoKind>(first).fill("ban"),
    ...Array<VetoKind>(picks).fill("pick"),
    ...Array<VetoKind>(bans - first).fill("ban"),
  ]
  return kinds.map((kind, i) => ({ kind, by: i % 2 === 0 ? "us" : "them" }))
}

/** Cómo va el veto: el próximo paso, los mapas libres y, al terminar, los mapas de la serie en orden. */
export function vetoState(pool: string[], bo: BestOf, actions: VetoAction[]) {
  const order = vetoOrder(bo, pool.length)
  const used = new Set(actions.map((a) => a.map))
  const remaining = pool.filter((m) => !used.has(m))
  const next = order[actions.length] ?? null
  const picked = actions.filter((a) => a.kind === "pick").map((a) => a.map)
  return {
    next,
    remaining,
    done: next === null,
    maps: next === null ? [...picked, ...remaining] : picked,
  }
}

/** Mapas ganados por cada lado. */
export function seriesScore(scores: [number, number][]): [number, number] {
  return scores.reduce<[number, number]>(
    (acc, [a, b]) => (a > b ? [acc[0] + 1, acc[1]] : [acc[0], acc[1] + 1]),
    [0, 0]
  )
}

/** Quién ganó la serie, o null si sigue. */
export function seriesWinner(
  bo: BestOf,
  scores: [number, number][]
): "us" | "them" | null {
  const need = Math.ceil(bo / 2)
  const [a, b] = seriesScore(scores)
  return a >= need ? "us" : b >= need ? "them" : null
}

/** Al vencer la espera: abandona el lado que no llegó a 5 (los dos si ninguno). */
export function abandonSide(
  present: [number, number]
): "us" | "them" | "both" | null {
  const usShort = present[0] < NEEDED
  const themShort = present[1] < NEEDED
  return usShort && themShort
    ? "both"
    : usShort
      ? "us"
      : themShort
        ? "them"
        : null
}

/** El texto del paso de la serie, para la etiqueta de Mis PCW. */
export function stepLabel(b: PcwBooking): string {
  switch (b.step) {
    case "veto":
      return "Veto de mapas"
    case "queued":
      return b.queue_ahead > 0
        ? `En la fila del servidor · ${b.queue_ahead} antes`
        : "Buscando servidor"
    case "wait":
      return `Servidor listo · entren al mapa ${b.map_no}`
    case "live":
      return `En vivo · mapa ${b.map_no}`
    case "abandoned":
      return "Abandonada"
    case "finished":
      return "Terminada"
  }
}
