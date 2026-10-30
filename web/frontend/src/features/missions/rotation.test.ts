import { describe, expect, it } from "vitest"

import {
  COOLDOWN_WEEKS,
  FIRST_STEPS,
  isReady,
  METRICS,
  MISSIONS,
  SLOTS,
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
