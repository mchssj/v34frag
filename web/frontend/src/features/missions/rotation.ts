import {
  COOLDOWN_WEEKS,
  isReady,
  READY_SOURCES,
  SLOTS,
  type Difficulty,
  type MetricSource,
  type Mission,
} from "./catalog"

// Rotación de las misiones semanales (docs/bitacora/2026-10-29-misiones-semanales en kyan/pruebas).
// Cada semana se eligen al azar, con una semilla por semana para que siempre den lo mismo, y una misión que
// salió no vuelve a salir en las COOLDOWN_WEEKS semanas siguientes. Las de Primeros pasos (`once`) no rotan.
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

/** Dos misiones miden lo mismo (misma métrica, y mismo mapa o arma si los tienen). */
export const sameStat = (a: Mission, b: Mission) =>
  a.metric === b.metric && a.map === b.map && a.weapon === b.weapon

export interface Week {
  week: number
  missions: Mission[]
  /** Avisos si hubo que aflojar una regla porque el catálogo no alcanzaba. */
  warnings: string[]
}

/**
 * Las misiones de la semana `w`. `recent[0]` son los ids de la semana anterior, `recent[1]` los de dos
 * semanas antes, y así. Primero respeta la espera y que no se repita la misma stat en la semana; si no
 * alcanza, deja repetir la stat, y recién después afloja la espera (empezando por las más viejas).
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
  const repeatsStat = (m: Mission) => picked.some((p) => sameStat(p, m))

  for (const group of ["normal", "vip"] as const) {
    const label = group === "vip" ? "VIP " : ""
    // De la más difícil a la más fácil: las difíciles tienen menos opciones, así que eligen primero.
    for (const diff of ["dificil", "media", "facil"] as Difficulty[]) {
      const need = SLOTS[group][diff]
      const pool = shuffle(
        catalog.filter(
          (m) =>
            !m.once &&
            isReady(m, ready) &&
            m.vip === (group === "vip") &&
            m.difficulty === diff
        ),
        w * 7919 + (group === "vip" ? 104729 : 0) + diff.length
      )
      const have = () =>
        picked.filter(
          (p) => p.vip === (group === "vip") && p.difficulty === diff
        ).length
      const take = (ok: (m: Mission) => boolean) => {
        for (const m of pool) {
          if (have() >= need) return
          if (!picked.includes(m) && ok(m)) picked.push(m)
        }
      }
      take((m) => !blocked(m, COOLDOWN_WEEKS) && !repeatsStat(m))
      if (have() >= need) continue
      take((m) => !blocked(m, COOLDOWN_WEEKS))
      if (have() >= need) {
        warnings.push(`Se repitió una stat en las ${label}${diff}.`)
        continue
      }
      for (let k = COOLDOWN_WEEKS - 1; k >= 0 && have() < need; k--)
        take((m) => !blocked(m, k))
      warnings.push(
        have() < need
          ? `Faltan ${need - have()} misiones ${label}${diff}: el catálogo no alcanza.`
          : `Se repitió una misión ${label}${diff} antes de las ${COOLDOWN_WEEKS} semanas.`
      )
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
