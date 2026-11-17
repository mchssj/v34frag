import { describe, expect, it } from "vitest"

import {
  DAY,
  MIN,
  ME,
  blockedUntil,
  codeState,
  createCodes,
  displayOf,
  normalize,
  redeem,
  revertRedemption,
  seed,
  vipOf,
  type CreateInput,
  type Sim,
} from "./sim"

const NOW = Date.UTC(2026, 10, 17, 18)
let n = 0
const rand = (k: number) => (n = (n * 7 + 3) % 9973) % k
const base = () => seed(NOW, rand)
const make = (s: Sim, i: Partial<CreateInput>) => {
  const r = createCodes(
    s,
    {
      reward: "points",
      amount: 100,
      maxUses: 1,
      count: 1,
      label: "Prueba",
      ...i,
    },
    rand
  )
  if (!r.ok) throw new Error(r.error)
  return { sim: r.sim, code: r.codes[0]! }
}

describe("formato", () => {
  it("ignora guiones, espacios y confusiones", () => {
    expect(normalize("cml-7k2m qx9p-4htd")).toBe("CML7K2MQX9P4HTD")
    expect(normalize("CMLOOII")).toBe("CML0011")
    expect(displayOf("CML7K2MQX9P4HTD")).toBe("CML-7K2M-QX9P-4HTD")
  })
})

describe("canje", () => {
  it("da los puntos una vez por cuenta", () => {
    const { sim, code } = make(base(), { maxUses: 5 })
    const r = redeem(sim, ME, code.display.toLowerCase())
    expect(r.ok).toBe(true)
    expect(r.sim.accounts.find((a) => a.id === ME)!.points).toBe(1340)
    const again = redeem(r.sim, ME, code.display)
    expect(again.ok || again.error).toBe("code_already_redeemed")
  })

  it("se agota y vence", () => {
    const { sim, code } = make(base(), { expiresInDays: 1 })
    const r = redeem(sim, "u-nacho", code.key)
    expect(redeem(r.sim, "u-luchi", code.key)).toMatchObject({
      error: "code_used_up",
    })
    const { sim: s2, code: c2 } = make(base(), { expiresInDays: 1 })
    expect(redeem({ ...s2, now: s2.now + 2 * DAY }, ME, c2.key)).toMatchObject({
      error: "code_expired",
    })
  })

  it("un revocado responde igual que uno que no existe", () => {
    const s = base()
    const rev = s.codes.find((c) => codeState(c, s.now) === "revocado")!
    expect(redeem(s, ME, rev.key)).toMatchObject({ error: "code_invalid" })
  })

  it("VIP: se suma al final del período vigente", () => {
    const { sim, code } = make(base(), { reward: "vip", days: 7, amount: null })
    const before = vipOf(sim, "u-nacho").until!
    const r = redeem(sim, "u-nacho", code.key)
    expect(vipOf(r.sim, "u-nacho").until).toBe(before + 7 * DAY)
  })

  it("artículo para siempre que ya tiene: no gasta el código", () => {
    const { sim, code } = make(base(), {
      reward: "item",
      itemId: "marco-fuego",
      amount: null,
    })
    const r = redeem(sim, ME, code.key)
    expect(r).toMatchObject({ ok: false, error: "code_already_owned" })
    expect(r.sim.codes.find((c) => c.id === code.id)!.uses).toBe(0)
  })

  it("artículo temporal: suma días y al revertir vuelve como estaba", () => {
    let { sim, code } = make(base(), {
      reward: "item",
      itemId: "marco-neon",
      days: 10,
      amount: null,
    })
    const r1 = redeem(sim, ME, code.key)
    expect(r1.ok).toBe(true)
    ;({ sim, code } = make(r1.sim, {
      reward: "item",
      itemId: "marco-neon",
      days: 5,
      amount: null,
    }))
    const r2 = redeem(sim, ME, code.key)
    const own = () =>
      r2.sim.owned.find((o) => o.user === ME && o.itemId === "marco-neon")!
    expect(own().expiresAt).toBe(NOW + 15 * DAY)
    if (!r2.ok) throw new Error()
    const back = revertRedemption(r2.sim, r2.redemption.id, "error")
    expect(
      back.owned.find((o) => o.user === ME && o.itemId === "marco-neon")!
        .expiresAt
    ).toBe(NOW + 10 * DAY)
  })

  it("para otra cuenta", () => {
    const s = base()
    const mine = s.codes.find((c) => c.forUser === ME)!
    expect(redeem(s, "u-nacho", mine.key)).toMatchObject({
      error: "code_not_for_you",
    })
    expect(redeem(s, ME, mine.key).ok).toBe(true)
  })
})

describe("fuerza bruta", () => {
  it("5 fallos bloquean 15 minutos", () => {
    let s = base()
    for (let i = 0; i < 4; i++) {
      const r = redeem(s, ME, `CMLAAAA${i}`)
      expect(r).toMatchObject({ error: "code_invalid" })
      s = { ...r.sim, now: r.sim.now + MIN }
    }
    const fifth = redeem(s, ME, "CMLZZZZ")
    expect(fifth).toMatchObject({ error: "code_rate_limited" })
    s = fifth.sim
    const valid = s.codes.find((c) => c.forUser === ME)!
    expect(redeem(s, ME, valid.key)).toMatchObject({
      error: "code_rate_limited",
    })
    expect(blockedUntil({ ...s, now: s.now + 15 * MIN }, ME)).toBeNull()
  })

  it("20 fallos en el día bloquean hasta el día siguiente", () => {
    let s = base()
    for (let i = 0; i < 20; i++)
      s = { ...redeem(s, ME, `X${i}XXXXXXX`).sim, now: s.now + 16 * MIN }
    const until = blockedUntil(s, ME)
    expect(until).not.toBeNull()
    expect(until! - s.now).toBeLessThanOrEqual(DAY)
  })

  it("los errores que no son 'no existe' no cuentan", () => {
    const s = base()
    const mine = s.codes.find((c) => c.forUser === ME)!
    let t = s
    for (let i = 0; i < 6; i++) t = redeem(t, "u-nacho", mine.key).sim
    expect(blockedUntil(t, "u-nacho")).toBeNull()
  })
})

describe("crear", () => {
  it("lote de códigos distintos y personalizado de a uno", () => {
    const r = createCodes(
      base(),
      { reward: "points", amount: 10, maxUses: 1, count: 100, label: "Lote" },
      rand
    )
    expect(r.ok && new Set(r.codes.map((c) => c.key)).size).toBe(100)
    const c = createCodes(base(), {
      reward: "points",
      amount: 10,
      maxUses: 1,
      count: 2,
      custom: "NAVIDAD2026",
      label: "x",
    })
    expect(c.ok).toBe(false)
  })
})
