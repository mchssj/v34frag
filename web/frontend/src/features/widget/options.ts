// Personalización del widget para OBS (docs/bitacora/2026-11-08-widget-streamers-stats en kyan/pruebas).
// Todo viaja en la URL de la fuente de navegador: OBS solo guarda la URL, así que no hace falta cuenta.
// Los valores por defecto no se escriben, para que la URL quede corta.

export type WidgetDesign =
  "mini" | "compacto" | "completo" | "stats" | "barra" | "vertical"
export type WidgetPeriod = "hoy" | "24h" | "temporada" | "historico"

export const DESIGN_LABEL: Record<WidgetDesign, string> = {
  mini: "Mini",
  compacto: "Compacto",
  completo: "Completo",
  stats: "Stats",
  barra: "Barra",
  vertical: "Vertical",
}
export const PERIOD_LABEL: Record<WidgetPeriod, string> = {
  hoy: "Hoy",
  "24h": "24 h",
  temporada: "Temporada",
  historico: "Histórico",
}

/** Tamaño de la fuente de navegador en OBS para cada diseño (al 100 %). */
export const WIDGET_SIZE: Record<WidgetDesign, [number, number]> = {
  mini: [170, 64],
  compacto: [360, 150],
  completo: [420, 190],
  stats: [420, 200],
  barra: [720, 56],
  vertical: [200, 500],
}

/** Las stats que se pueden elegir, con el texto corto que se ve en el widget. */
export const STAT_LABEL = {
  adr: "ADR",
  rating: "Rating",
  kd: "K/D",
  kr: "KR",
  hs: "HS",
  record: "V-D",
  elo_delta: "ELO",
  aces: "Ace",
  quadros: "4K",
  triples: "3K",
  sniper: "Sniper",
  knife: "Cuchillo",
  clutches: "Clutch",
  entries: "Entradas",
  pistols: "Pistolas",
  matches: "Mixes",
  peak: "Pico",
  rank: "Ranking",
  country_rank: "País",
} as const
export type StatKey = keyof typeof STAT_LABEL
const STAT_KEYS = Object.keys(STAT_LABEL) as StatKey[]

export const MAX_TOP = 4
export const MAX_CHIPS = 5
export const MAX_PHRASE = 40

export type Part =
  "photo" | "nick" | "tag" | "level" | "progress" | "last" | "flag" | "phrase"
export const PART_LABEL: Record<Part, string> = {
  photo: "Foto de perfil",
  nick: "Nick",
  tag: "Tag del equipo",
  level: "Nivel",
  progress: "Barra al próximo nivel",
  last: "Últimos resultados",
  flag: "Bandera",
  phrase: "Frase",
}
const PARTS = Object.keys(PART_LABEL) as Part[]

export interface WidgetOptions {
  design: WidgetDesign
  period: WidgetPeriod
  /** Stats grandes (Stats, Barra y Vertical). */
  top: StatKey[]
  /** Stats chicas de la segunda fila (Stats). */
  chips: StatKey[]
  /** Color de acento, en hex sin "#". */
  accent: string
  /** Opacidad del fondo, de 0 a 100. */
  opacity: number
  /** Tamaño, de 75 a 150 %. */
  scale: number
  hidden: Part[]
  /** Frase propia; vacía = automática. */
  phrase: string
  last: 5 | 10
}

export const DEFAULT_OPTIONS: WidgetOptions = {
  design: "compacto",
  period: "hoy",
  top: ["adr", "rating", "kd", "kr"],
  chips: ["aces", "quadros", "triples", "sniper", "knife"],
  accent: "ff6900",
  opacity: 80,
  scale: 100,
  hidden: [],
  phrase: "",
  last: 5,
}

/** Colores sugeridos para el acento. El primero es el naranja de la marca. */
export const ACCENTS = [
  "ff6900",
  "fe1f00",
  "ffc800",
  "1ce400",
  "00b4ff",
  "8b5cf6",
  "ec4899",
  "eeeeee",
]

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n))
const isHex = (s: string) => /^[0-9a-f]{6}$/i.test(s)

const keysFrom = (v: string | null, max: number, fallback: StatKey[]) => {
  if (v === null) return fallback
  const list = [
    ...new Set(
      v
        .split(",")
        .filter((k): k is StatKey => (STAT_KEYS as string[]).includes(k))
    ),
  ]
  return list.slice(0, max)
}

/** Lee las opciones de la URL. Un valor inválido vuelve al de por defecto en lugar de romper el widget. */
export function parseOptions(search: string | URLSearchParams): WidgetOptions {
  const q = typeof search === "string" ? new URLSearchParams(search) : search
  const d = DEFAULT_OPTIONS
  const design = q.get("d")
  const period = q.get("v")
  const accent = (q.get("a") ?? "").toLowerCase()
  const num = (k: string, def: number, min: number, max: number) => {
    const n = Number(q.get(k))
    return q.get(k) !== null && Number.isFinite(n)
      ? clamp(Math.round(n), min, max)
      : def
  }
  return {
    design:
      design && design in DESIGN_LABEL ? (design as WidgetDesign) : d.design,
    period:
      period && period in PERIOD_LABEL ? (period as WidgetPeriod) : d.period,
    top: keysFrom(q.get("t"), MAX_TOP, d.top),
    chips: keysFrom(q.get("c"), MAX_CHIPS, d.chips),
    accent: isHex(accent) ? accent : d.accent,
    opacity: num("o", d.opacity, 0, 100),
    scale: num("s", d.scale, 75, 150),
    hidden: (q.get("h") ?? "")
      .split(",")
      .filter((p): p is Part => (PARTS as string[]).includes(p)),
    phrase: (q.get("f") ?? "").trim().slice(0, MAX_PHRASE),
    last: q.get("n") === "10" ? 10 : 5,
  }
}

/**
 * Las opciones como texto de URL, sin el `id`, con solo lo que cambia respecto de los valores por defecto. Es lo
 * que se guarda en la cuenta (replanteo 112, bitácora 2026-11-11-widget-guardar).
 */
export function optionsQuery(o: WidgetOptions) {
  const d = DEFAULT_OPTIONS
  const q = new URLSearchParams()
  if (o.design !== d.design) q.set("d", o.design)
  if (o.period !== d.period) q.set("v", o.period)
  if (o.top.join() !== d.top.join()) q.set("t", o.top.join(","))
  if (o.chips.join() !== d.chips.join()) q.set("c", o.chips.join(","))
  if (o.accent !== d.accent) q.set("a", o.accent)
  if (o.opacity !== d.opacity) q.set("o", String(o.opacity))
  if (o.scale !== d.scale) q.set("s", String(o.scale))
  if (o.hidden.length) q.set("h", o.hidden.join(","))
  if (o.phrase.trim()) q.set("f", o.phrase.trim().slice(0, MAX_PHRASE))
  if (o.last !== d.last) q.set("n", String(o.last))
  return q.toString()
}

/** La URL del widget con las opciones adentro (la de `/demo/widget`, sin cuenta). */
export function widgetUrl(base: string, playerId: string, o: WidgetOptions) {
  const rest = optionsQuery(o)
  return `${base}/widget?${new URLSearchParams({ id: playerId })}${rest ? `&${rest}` : ""}`
}

/** La URL fija del widget: solo la ficha. Usa lo que el jugador guardó en su cuenta. */
export const savedWidgetUrl = (base: string, playerId: string) =>
  `${base}/widget?${new URLSearchParams({ id: playerId })}`

/** Las claves de opciones de la URL (sin `id` ni `bg`). */
const OPTION_KEYS = ["d", "v", "t", "c", "a", "o", "s", "h", "f", "n"]

/**
 * Lo guardado con las opciones de la URL encima: cada opción que trae la URL gana. Así una URL vieja, con todo
 * adentro, se sigue viendo igual, y `/widget?id=…` muestra lo guardado.
 */
export function mergeOptions(saved: string | null, url: URLSearchParams) {
  const q = new URLSearchParams(saved ?? "")
  for (const k of OPTION_KEYS) {
    const v = url.get(k)
    if (v !== null) q.set(k, v)
  }
  return parseOptions(q)
}
