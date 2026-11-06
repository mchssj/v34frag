import {
  ACCENTS,
  METALS,
  METAL_LEVEL,
  type Metal,
  type MedalLook,
  type Template,
  type Tone,
} from "./templates"

// Aplica el diseño de una medalla sobre el SVG de su plantilla (plan, sección 3). Los SVG de Kyan tienen capas con id
// fijo (metal, pasador, resplandor-marco, filete-claro, cinta, cara, filete-acento, etiqueta, numero, texto-banda,
// puntos-nivel, icono). Reglas del generador (generar_medallas_nuevas.py): tamaño del número por largo, ancho de la
// píldora de la etiqueta y rombos de nivel encendidos según el metal.

const NUMBER_SIZE: Record<number, number> = {
  1: 74,
  2: 66,
  3: 58,
  4: 50,
  5: 42,
}
const OFF = "#24262D" // rombo apagado
const LOCKED_TEXT = "#A9ADB7"
const COLOR_ATTRS = ["fill", "stroke", "stop-color"] as const
// Capas del marco: llevan el color del metal. El resto lleva el del acento.
const METAL_IDS = new Set([
  "metal",
  "metal-vertical",
  "pasador",
  "resplandor-marco",
  "filete-claro",
  "laureles",
  "remaches",
])
// Textos blancos que no cambian con la paleta.
const KEEP_IDS = new Set(["numero", "texto-banda"])

export type Options = {
  look: MedalLook
  template: Template
  locked?: boolean
  uid: string
  title?: string
}

const up = (c: string | null) => (c ?? "").trim().toUpperCase()

function tones(t: Tone | undefined): string[] {
  return t ? [t.light, t.mid, t.dark, ...(t.face ? [t.face] : [])].map(up) : []
}

function within(el: Element, ids: Set<string>): boolean {
  for (let e: Element | null = el; e; e = e.parentElement) {
    const id = e.getAttribute("id")
    if (id && ids.has(id)) return true
  }
  return false
}

/** Reemplaza los colores de un elemento según el mapa (un solo paso, sin encadenar). */
function recolor(el: Element, map: Map<string, string>) {
  for (const a of COLOR_ATTRS) {
    const v = el.getAttribute(a)
    const next = v ? map.get(up(v)) : undefined
    if (next) el.setAttribute(a, next)
  }
}

function mapOf(
  from: Tone | undefined,
  to: Tone | undefined
): Map<string, string> {
  const m = new Map<string, string>()
  if (!from || !to) return m
  const a = tones(from)
  const b = tones(to)
  a.forEach((c, i) => b[i] && c !== b[i] && m.set(c, b[i]!))
  return m
}

function setText(el: Element | null, text: string | null | undefined) {
  if (!el || text === null || text === undefined) return
  el.textContent = text
}

/** El SVG listo para insertar: sin scripts ni eventos, con el diseño aplicado y los id prefijados. */
export function applyDesign(svgText: string, o: Options): SVGSVGElement {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml")
  const svg = doc.documentElement as unknown as SVGSVGElement
  if (svg.nodeName !== "svg") throw new Error("No es un SVG")

  // Solo dibujo: fuera scripts, objetos externos y atributos de eventos.
  svg
    .querySelectorAll("script, foreignObject, title, desc")
    .forEach((e) => e.remove())
  svg.querySelectorAll("*").forEach((e) => {
    for (const a of [...e.attributes])
      if (/^on/i.test(a.name)) e.removeAttribute(a.name)
  })

  const t = o.template
  const locked = !!o.locked
  const look = o.look
  const byId = (id: string) => svg.querySelector(`[id="${id}"]`)

  // ---------- colores ----------
  const fromMetal: Tone | undefined = t.metal
    ? METALS[t.metal as Metal]
    : t.metalColors
      ? {
          light: t.metalColors[0]!,
          mid: t.metalColors[1]!,
          dark: t.metalColors[2]!,
        }
      : undefined
  const metalId = (
    look.metal && look.metal in METAL_LEVEL ? look.metal : (t.metal ?? "oro")
  ) as Metal
  const toMetal = locked ? METALS.bloqueada : METALS[metalId]
  const fromAccent = t.accent ? ACCENTS[t.accent] : undefined
  const accentId =
    t.editable.accent && look.accent && ACCENTS[look.accent]
      ? look.accent
      : t.accent
  const toAccent = locked
    ? ACCENTS.bloqueada
    : accentId
      ? ACCENTS[accentId]
      : undefined
  const metalMap = mapOf(fromMetal, toMetal)
  const accentMap = mapOf(fromAccent, toAccent)
  // Sin acento propio (mixes jugados) o con el acento igual al metal (podio), el metal colorea toda la medalla.
  const metalEverywhere =
    !fromAccent ||
    (!t.editable.accent &&
      !!fromMetal &&
      up(fromAccent.mid) === up(fromMetal.mid))

  svg.querySelectorAll("*").forEach((el) => {
    if (within(el, KEEP_IDS)) return
    if (metalEverywhere || within(el, METAL_IDS)) recolor(el, metalMap)
    else recolor(el, accentMap)
  })

  // ---------- rombos de nivel ----------
  const pips = byId("puntos-nivel")
  if (pips) {
    const list = [...pips.children]
    const on = locked ? 0 : Math.min(list.length, METAL_LEVEL[metalId])
    list.forEach((p, i) => p.setAttribute("fill", i < on ? toMetal.mid : OFF))
  }

  // ---------- número ----------
  const num = byId("numero")
  if (num) {
    if (t.editable.number && look.number) {
      const oldText = num.textContent ?? ""
      const oldFs = Number(num.getAttribute("font-size")) || 58
      const k =
        oldFs / (NUMBER_SIZE[Math.min(5, Math.max(1, oldText.length))] ?? oldFs)
      const cy = Number(num.getAttribute("y")) - oldFs * 0.35
      const fs = Math.round(
        (NUMBER_SIZE[Math.min(5, Math.max(1, look.number.length))] ?? 42) * k
      )
      num.setAttribute("font-size", String(fs))
      num.setAttribute("y", String(Math.round(cy + fs * 0.35)))
      setText(num, look.number)
    }
    if (locked) num.setAttribute("fill", LOCKED_TEXT)
  }

  // ---------- etiqueta ----------
  const label = look.label?.toUpperCase()
  const pill = byId("etiqueta")
  if (pill && label && (t.editable.label || t.aggregation === "season_rank")) {
    const rect = pill.querySelector("rect")
    const text = pill.querySelector("text")
    const fs = label.length <= 3 ? 15 : 11.5
    const w = Math.max(52, label.length * fs * 0.78 + 22)
    if (rect) {
      const y = Number(rect.getAttribute("y"))
      rect.setAttribute("x", (130 - w / 2).toFixed(1))
      rect.setAttribute("width", w.toFixed(1))
      text?.setAttribute("y", String(y + (fs === 15 ? 16.5 : 15.3)))
    }
    text?.setAttribute("font-size", String(fs))
    setText(text, label)
  }
  const season = byId("temporada")
  if (season && label && (t.editable.label || t.aggregation === "season_rank"))
    setText(season.querySelector("text"), label)

  // ---------- banda ----------
  const band = byId("texto-banda")
  if (band && look.band && t.editable.band) {
    const b = look.band.toUpperCase()
    band.setAttribute("font-size", b.length <= 8 ? "15" : "11.5")
    setText(band, b)
  }
  if (band && locked) band.setAttribute("fill", LOCKED_TEXT)

  // ---------- bloqueada ----------
  if (locked) {
    byId("icono")?.setAttribute("opacity", ".6")
    // Lo que no está en ninguna paleta (detalles de las "mejoradas") también va en gris.
    svg.setAttribute("style", "filter: grayscale(1)")
  }

  // ---------- id únicos por instancia ----------
  const ids = new Set<string>()
  svg.querySelectorAll("[id]").forEach((e) => {
    const id = e.getAttribute("id")!
    ids.add(id)
    e.setAttribute("id", `${o.uid}-${id}`)
  })
  svg.querySelectorAll("*").forEach((e) => {
    for (const a of [...e.attributes]) {
      if (a.value.includes("url(#"))
        e.setAttribute(
          a.name,
          a.value.replace(/url\(#([^)]+)\)/g, (m, id: string) =>
            ids.has(id) ? `url(#${o.uid}-${id})` : m
          )
        )
      else if (
        (a.name === "href" || a.name === "xlink:href") &&
        a.value.startsWith("#") &&
        ids.has(a.value.slice(1))
      )
        e.setAttribute(a.name, `#${o.uid}-${a.value.slice(1)}`)
    }
  })

  // ---------- accesible ----------
  svg.setAttribute("role", "img")
  svg.setAttribute(
    "aria-label",
    (o.title ?? "Medalla") + (locked ? " (bloqueada)" : "")
  )
  svg.setAttribute("focusable", "false")
  return svg
}
