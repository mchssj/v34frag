import {
  AREA_MAX,
  COOLDOWN_WEEKS,
  isReady,
  READY_SOURCES,
  SLOTS,
  type Area,
  type Difficulty,
  type MetricSource,
  type Mission,
} from "./catalog"

// Rotación de las misiones semanales (docs/bitacora/2026-10-29-misiones-semanales en kyan/pruebas).
// Cada semana se eligen al azar, con una semilla por semana para que siempre den lo mismo, y una misión que
// salió no vuelve a salir en las COOLDOWN_WEEKS semanas siguientes.
//
// En la versión real el cron del lunes corre `pickWeek` una vez y guarda el resultado en `mission_weeks`:
// así, si después se edita el catálogo, las semanas pasadas no cambian.

const WEEK_MS = 7 * 24 * 3_600_000
/** Semana 0: lunes 26 de octubre de 2026 a las 06:00 de Argentina (09:00 UTC). */
export const EPOCH = Date.UTC(2026, 9, 26, 9)

export const weekIndex = (at: number) => Math.floor((at - EPOCH) / WEEK_MS)
export const weekStart = (w: number) => EPOCH + w * WEEK_MS
export const weekEnd = (w: number) => weekStart(w + 1)

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(xs: T[], seed: number) {
  const r = seeded(seed)
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export interface Week {
  week: number
  missions: Mission[]
  /** Avisos si hubo que aflojar una regla porque el catálogo no alcanzaba. */
  warnings: string[]
}

/**
 * Las misiones de la semana `w`. `recent[0]` son los ids de la semana anterior, `recent[1]` los de dos
 * semanas antes, y así. Primero respeta la espera y el tope por área; si no alcanza, afloja el tope por
 * área, y recién después la espera (empezando por las que salieron hace más tiempo).
 */
export function pickWeek(
  w: number,
  catalog: Mission[],
  recent: string[][],
  ready: MetricSource[] = READY_SOURCES
): Week {
  const warnings: string[] = []
  const picked: Mission[] = []
  const blocked = (m: Mission, weeks: number) =>
    recent.slice(0, weeks).some((ids) => ids.includes(m.id))

  for (const group of ["normal", "vip"] as const) {
    const areaCount: Record<Area, number> = { juego: 0, web: 0, comunidad: 0 }
    // De la más difícil a la más fácil: las difíciles tienen menos opciones y casi todas son de juego, así
    // que eligen primero y las fáciles completan las áreas que faltan.
    for (const diff of ["dificil", "media", "facil"] as Difficulty[]) {
      const need = SLOTS[group][diff]
      const pool = shuffle(
        catalog.filter(
          (m) =>
            isReady(m, ready) &&
            m.vip === (group === "vip") &&
            m.difficulty === diff
        ),
        w * 7919 + (group === "vip" ? 104729 : 0) + diff.length
      )
      const take = (ok: (m: Mission) => boolean) => {
        for (const m of pool) {
          if (
            picked.filter((p) => p.vip === m.vip && p.difficulty === diff)
              .length >= need
          )
            return
          if (picked.includes(m) || !ok(m)) continue
          picked.push(m)
          areaCount[m.area]++
        }
      }
      take(
        (m) =>
          !blocked(m, COOLDOWN_WEEKS) && areaCount[m.area] < AREA_MAX[m.area]
      )
      const have = () =>
        picked.filter(
          (p) => p.vip === (group === "vip") && p.difficulty === diff
        ).length
      if (have() < need) {
        take((m) => !blocked(m, COOLDOWN_WEEKS))
        if (have() < need) {
          for (let k = COOLDOWN_WEEKS - 1; k >= 0 && have() < need; k--)
            take((m) => !blocked(m, k))
          if (have() < need)
            warnings.push(
              `Faltan ${need - have()} misiones ${group === "vip" ? "VIP " : ""}${diff}: el catálogo no alcanza.`
            )
          else
            warnings.push(
              `Se repitió una misión ${group === "vip" ? "VIP " : ""}${diff} antes de las ${COOLDOWN_WEEKS} semanas.`
            )
        } else
          warnings.push(
            `Se pasó el tope por área en las ${group === "vip" ? "VIP " : ""}${diff}.`
          )
      }
    }
  }
  return { week: w, missions: picked, warnings }
}

/** Las semanas `from` a `to` (inclusive), calculadas en orden desde la semana 0. */
export function rotation(
  catalog: Mission[],
  to: number,
  from = 0,
  ready: MetricSource[] = READY_SOURCES
): Week[] {
  const out: Week[] = []
  const history: string[][] = []
  for (let w = 0; w <= to; w++) {
    const week = pickWeek(
      w,
      catalog,
      [...history].reverse().slice(0, COOLDOWN_WEEKS),
      ready
    )
    history.push(week.missions.map((m) => m.id))
    if (w >= from) out.push(week)
  }
  return out
}

/** Cuántas misiones de cada grupo y dificultad hacen falta como mínimo para respetar la espera. */
export function minimumPool() {
  const need = (n: number) => n * (COOLDOWN_WEEKS + 1)
  return {
    normal: {
      facil: need(SLOTS.normal.facil),
      media: need(SLOTS.normal.media),
      dificil: need(SLOTS.normal.dificil),
    },
    vip: {
      facil: need(SLOTS.vip.facil),
      media: need(SLOTS.vip.media),
      dificil: need(SLOTS.vip.dificil),
    },
  }
}
