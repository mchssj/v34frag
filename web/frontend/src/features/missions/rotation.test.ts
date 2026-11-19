import { describe, expect, it } from "vitest"

import {
  COOLDOWN_WEEKS,
  FIRST_STEPS,
  isReady,
  METRICS,
  MISSIONS,
  REWARDS,
  SLOTS,
  titleOf,
  WEEK_BONUS,
  type Mission,
} from "./catalog"
import {
  EPOCH,
  minimumPool,
  pickWeek,
  rotation,
  sameStat,
  weekIndex,
} from "./rotation"

const WEEKS = 26 // medio año

describe("rotación de misiones semanales", () => {
  const weeks = rotation(MISSIONS, WEEKS - 1)

  it("cada semana tiene 6 para todos y 3 VIP, con las dificultades del plan", () => {
    for (const w of weeks) {
      expect(w.warnings).toEqual([])
      for (const group of ["normal", "vip"] as const)
        for (const diff of ["facil", "media", "dificil"] as const)
          expect(
            w.missions.filter(
              (m) => m.vip === (group === "vip") && m.difficulty === diff
            )
          ).toHaveLength(SLOTS[group][diff])
    }
  })

  it(`ninguna misión vuelve antes de ${COOLDOWN_WEEKS} semanas`, () => {
    weeks.forEach((w, i) => {
      for (let k = 1; k <= COOLDOWN_WEEKS && i - k >= 0; k++) {
        const prev = weeks[i - k]!.missions.map((m) => m.id)
        expect(w.missions.filter((m) => prev.includes(m.id))).toEqual([])
      }
    })
  })

  it("en una semana no se repite la misma stat (ganá 1 y ganá 3, por ejemplo)", () => {
    for (const w of weeks)
      w.missions.forEach((a, i) =>
        w.missions
          .slice(i + 1)
          .forEach((b) => expect(sameStat(a, b)).toBe(false))
      )
  })

  it("las de Primeros pasos nunca entran en la rotación", () => {
    const once = new Set(FIRST_STEPS.map((m) => m.id))
    expect(MISSIONS.every((m) => !m.once)).toBe(true)
    expect(FIRST_STEPS.every((m) => m.once)).toBe(true)
    for (const w of rotation([...MISSIONS, ...FIRST_STEPS], WEEKS - 1))
      expect(w.missions.filter((m) => once.has(m.id))).toEqual([])
  })

  it("las de la web son todas de Primeros pasos", () => {
    expect(MISSIONS.filter((m) => METRICS[m.metric].source === "web")).toEqual(
      []
    )
  })

  it("en 2 meses sale la mayoría de las semanales que se pueden medir", () => {
    const seen = new Set(
      weeks.slice(0, 9).flatMap((w) => w.missions.map((m) => m.id))
    )
    expect(
      seen.size / MISSIONS.filter((m) => isReady(m)).length
    ).toBeGreaterThan(0.8)
  })

  it("no salen misiones con datos que el plugin todavía no manda", () => {
    for (const w of weeks)
      for (const m of w.missions)
        expect(METRICS[m.metric].source).toBe("plugin")
  })

  it("con el plugin nuevo entran las misiones de schema 2 y sigue respetando la espera", () => {
    const v2 = rotation(MISSIONS, WEEKS - 1, 0, ["plugin", "plugin_v2", "web"])
    expect(
      v2
        .flatMap((w) => w.missions)
        .some((m) => METRICS[m.metric].source === "plugin_v2")
    ).toBe(true)
    v2.forEach((w, i) => {
      expect(w.warnings).toEqual([])
      const prev = v2
        .slice(Math.max(0, i - COOLDOWN_WEEKS), i)
        .flatMap((x) => x.missions.map((m) => m.id))
      expect(w.missions.filter((m) => prev.includes(m.id))).toEqual([])
    })
  })

  it("da siempre lo mismo para la misma semana", () => {
    expect(
      rotation(MISSIONS, 5).map((w) => w.missions.map((m) => m.id))
    ).toEqual(weeks.slice(0, 6).map((w) => w.missions.map((m) => m.id)))
  })

  it("el catálogo alcanza el mínimo para la espera", () => {
    const min = minimumPool()
    for (const group of ["normal", "vip"] as const)
      for (const diff of ["facil", "media", "dificil"] as const)
        expect(
          MISSIONS.filter(
            (m) =>
              isReady(m) && m.vip === (group === "vip") && m.difficulty === diff
          ).length
        ).toBeGreaterThanOrEqual(min[group][diff])
  })

  it("si el catálogo no alcanza, avisa en lugar de romperse", () => {
    const few: Mission[] = MISSIONS.filter(
      (m) => m.vip && m.difficulty === "dificil" && isReady(m)
    ).slice(0, 1)
    const w = pickWeek(1, few, [[few[0]!.id]])
    expect(w.missions).toHaveLength(1)
    expect(w.warnings.length).toBeGreaterThan(0)
  })

  it("la semana cambia los lunes a las 06:00 de Argentina", () => {
    expect(weekIndex(EPOCH)).toBe(0)
    expect(weekIndex(EPOCH - 1)).toBe(-1)
    expect(weekIndex(Date.UTC(2026, 10, 2, 8, 59))).toBe(0)
    expect(weekIndex(Date.UTC(2026, 10, 2, 9))).toBe(1)
  })
})

describe("textos de las misiones", () => {
  it("los mapas se muestran sin prefijo", () => {
    const withMap = [...MISSIONS, ...FIRST_STEPS].filter((m) => m.map)
    expect(withMap.length).toBeGreaterThan(0)
    for (const m of withMap) expect(titleOf(m)).not.toMatch(/\b[a-z]{2,4}_/)
    expect(titleOf(MISSIONS.find((m) => m.map === "de_dust2")!)).toBe(
      "Jugá 3 mixes en Dust2"
    )
  })
})

describe("economía de las misiones", () => {
  // Lo que paga un mix en la tienda (START_CONFIG de features/shop/demo.ts): 10 y 5 más si ganás.
  const PER_MIX = 10
  const PER_WIN = 5

  it("la semana completa no paga más que unos 12 mixes ganados", () => {
    const week = (["facil", "media", "dificil"] as const).reduce(
      (t, d) => t + SLOTS.normal[d] * REWARDS.normal[d],
      WEEK_BONUS
    )
    expect(week).toBeLessThanOrEqual(12 * (PER_MIX + PER_WIN))
  })

  it("las VIP de la semana no pagan más monedas que 6 mixes ganados", () => {
    const vip = (["facil", "media", "dificil"] as const).reduce(
      (t, d) => t + SLOTS.vip[d] * REWARDS.vip[d],
      0
    )
    expect(vip).toBeLessThanOrEqual(6 * (PER_MIX + PER_WIN))
  })
})
