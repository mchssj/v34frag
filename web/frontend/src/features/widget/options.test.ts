import { describe, expect, it } from "vitest"

import {
  DEFAULT_OPTIONS,
  mergeOptions,
  optionsQuery,
  parseOptions,
  savedWidgetUrl,
  widgetUrl,
  type WidgetOptions,
} from "./options"

const ID = "00000000-0000-0000-0000-000000000000"

describe("opciones del widget en la URL", () => {
  it("sin cambios, la URL solo lleva el id", () => {
    expect(widgetUrl("https://cmleague.lat", ID, DEFAULT_OPTIONS)).toBe(
      `https://cmleague.lat/widget?id=${ID}`
    )
  })

  it("ida y vuelta: lo que se escribe se lee igual", () => {
    const o: WidgetOptions = {
      design: "stats",
      period: "temporada",
      top: ["elo_delta", "kd", "hs"],
      chips: ["clutches", "sniper"],
      accent: "1ce400",
      opacity: 55,
      scale: 125,
      hidden: ["photo", "tag", "progress"],
      phrase: "¡Vamos que se puede!",
      last: 10,
    }
    const url = new URL(widgetUrl("https://cmleague.lat", ID, o))
    expect(parseOptions(url.search)).toEqual(o)
  })

  it("los valores inválidos vuelven a los de por defecto", () => {
    const o = parseOptions(
      "?d=gigante&v=ayer&a=zzz&o=900&s=10&t=adr,nada,adr&h=foo&n=7"
    )
    expect(o.design).toBe(DEFAULT_OPTIONS.design)
    expect(o.period).toBe(DEFAULT_OPTIONS.period)
    expect(o.accent).toBe(DEFAULT_OPTIONS.accent)
    expect(o.opacity).toBe(100)
    expect(o.scale).toBe(75)
    expect(o.top).toEqual(["adr"])
    expect(o.hidden).toEqual([])
    expect(o.last).toBe(5)
  })

  it("respeta los topes de stats y de largo de la frase", () => {
    const o = parseOptions(`?t=adr,kd,kr,hs,rating,aces&f=${"x".repeat(80)}`)
    expect(o.top).toHaveLength(4)
    expect(o.phrase).toHaveLength(40)
  })

  it("lo que se guarda es la URL sin el id, y la URL fija es solo el id", () => {
    expect(optionsQuery(DEFAULT_OPTIONS)).toBe("")
    expect(optionsQuery({ ...DEFAULT_OPTIONS, design: "barra" })).toBe(
      "d=barra"
    )
    expect(savedWidgetUrl("https://cmleague.lat", ID)).toBe(
      `https://cmleague.lat/widget?id=${ID}`
    )
  })

  it("lo guardado con lo de la URL encima, opción por opción", () => {
    const o = mergeOptions(
      "d=stats&v=historico&a=00b4ff",
      new URLSearchParams(`id=${ID}&v=hoy&bg=1`)
    )
    expect(o.design).toBe("stats")
    expect(o.period).toBe("hoy")
    expect(o.accent).toBe("00b4ff")
    expect(mergeOptions(null, new URLSearchParams(`id=${ID}`))).toEqual(
      DEFAULT_OPTIONS
    )
  })
})
