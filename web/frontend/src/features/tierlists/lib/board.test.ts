import { describe, expect, it } from "vitest"

import {
  addItem,
  addTier,
  BANK,
  boardError,
  countItems,
  fromTierlist,
  MAX_ITEMS,
  moveItem,
  removeTier,
  shiftItem,
  shiftTier,
  toSave,
  type Board,
} from "./board"

const player = (id: string) =>
  ({ kind: "player", id, name: `p${id}`, tag: null, image_url: null }) as const
const ext = (name: string) =>
  ({ kind: "external", id: null, name, tag: null, image_url: null }) as const

const base = (): Board =>
  fromTierlist({
    name: "Mi lista",
    tiers: [
      { id: "a", label: "S", items: [player("1"), player("2")] },
      { id: "b", label: "A", items: [] },
    ],
    bank: [ext("Otro")],
  } as never)

const keys = (l: { key: string }[]) => l.map((e) => e.key)

describe("tablero de la tierlist", () => {
  it("no repite una ficha y deja repetir externos", () => {
    let b = addItem(base(), player("1"))
    expect(countItems(b)).toBe(3)
    b = addItem(b, ext("Otro"))
    expect(countItems(b)).toBe(4)
  })

  it("respeta el tope de ítems", () => {
    let b = base()
    for (let i = 0; i < MAX_ITEMS + 5; i++) b = addItem(b, player(`n${i}`))
    expect(countItems(b)).toBe(MAX_ITEMS)
  })

  it("mueve entre tiers, al banco y dentro del mismo tier", () => {
    const b = base()
    const [s, a] = b.tiers
    let n = moveItem(b, "p:1", a!.key)
    expect(keys(n.tiers[0]!.items)).toEqual(["p:2"])
    expect(keys(n.tiers[1]!.items)).toEqual(["p:1"])
    n = moveItem(n, "p:1", BANK, 0)
    expect(n.bank[0]!.key).toBe("p:1")
    // Soltar el primero delante del lugar 2 (después del segundo) lo deja último.
    n = moveItem(b, "p:1", s!.key, 2)
    expect(keys(n.tiers[0]!.items)).toEqual(["p:2", "p:1"])
    expect(keys(shiftItem(n, "p:1", -1).tiers[0]!.items)).toEqual([
      "p:1",
      "p:2",
    ])
    expect(keys(shiftItem(b, "p:1", 1).tiers[0]!.items)).toEqual(["p:2", "p:1"])
    expect(shiftItem(b, "p:1", -1)).toBe(b)
  })

  it("al borrar un tier sus ítems vuelven al banco; siempre queda uno", () => {
    const b = base()
    const n = removeTier(b, b.tiers[0]!.key)
    expect(n.tiers).toHaveLength(1)
    expect(keys(n.bank).slice(1)).toEqual(["p:1", "p:2"])
    expect(removeTier(n, n.tiers[0]!.key)).toBe(n)
  })

  it("hasta 10 tiers y se reordenan", () => {
    let b = base()
    for (let i = 0; i < 12; i++) b = addTier(b)
    expect(b.tiers).toHaveLength(10)
    const c = base()
    expect(shiftTier(c, c.tiers[0]!.key, 1).tiers.map((t) => t.label)).toEqual([
      "A",
      "S",
    ])
    expect(shiftTier(c, c.tiers[0]!.key, -1)).toBe(c)
  })

  it("arma el cuerpo para guardar", () => {
    expect(toSave(base())).toEqual({
      name: "Mi lista",
      tiers: [
        { label: "S", items: [{ player: "1" }, { player: "2" }] },
        { label: "A", items: [] },
      ],
      bank: [{ name: "Otro" }],
    })
    expect(boardError({ ...base(), name: " " })).toMatch(/nombre/)
    expect(boardError(base())).toBeNull()
  })
})
