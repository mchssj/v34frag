import {
  numberFor,
  templateOf,
  titleFor,
  defaultLook,
  type MedalLook,
  type Metal,
  type Template,
} from "@/features/medals/templates"

// Estado del editor de Administración › Medallas (plan, sección 9.1): plantilla, objetivo y filtros, diseño según lo
// que la plantilla deja editar, y el cuerpo para la API.

export const STATUS_LABEL = {
  draft: "Borrador",
  active: "Activa",
  archived: "Archivada",
} as const
export const STATUS_TONE = {
  draft: "warn",
  active: "win",
  archived: "neutral",
} as const
export const AGGREGATION_LABEL: Record<string, string> = {
  total: "Total acumulado",
  avg_min_matches: "Promedio, con un mínimo de mixes",
  max: "El máximo alcanzado",
  streak: "La racha más larga",
  once: "Una vez",
  season_rank: "Puesto al cerrar la temporada",
  manual: "La da un admin",
}

export type Draft = {
  template: string
  target: number
  title: string
  titleAuto: boolean
  minMatches: number
  numMode: "auto" | "custom"
  number: string
  label: string
  band: string
  metal: Metal
  accent: string | null
}

const T = (id: string) => templateOf(id)!

/** Al elegir una plantilla: su primer escalón y su dibujo por defecto. */
export function fromTemplate(id: string): Draft {
  const t = T(id)
  const target = t.steps[0] ?? 1
  const look = defaultLook(t, target)
  return {
    template: id,
    target,
    title: titleFor(t, target),
    titleAuto: true,
    minMatches: Number(
      (t.filters as { min_matches?: number }).min_matches ?? 20
    ),
    numMode: "auto",
    number: look.number ?? "",
    label: look.label ?? "",
    band: look.band ?? "",
    metal: (look.metal as Metal) ?? "oro",
    accent: look.accent ?? null,
  }
}

/** Cambiar el objetivo: el título y el número siguen al objetivo (si no se escribieron a mano) y el metal al escalón. */
export function withTarget(d: Draft, n: number): Draft {
  const t = T(d.template)
  const look = defaultLook(t, n)
  return {
    ...d,
    target: n,
    title: d.titleAuto ? titleFor(t, n) : d.title,
    number:
      d.numMode === "auto" ? (numberFor(t.defaults.number, n) ?? "") : d.number,
    metal: t.steps.includes(n) ? ((look.metal as Metal) ?? d.metal) : d.metal,
    band: t.id === "top_temporada" ? `TOP ${n}` : d.band,
  }
}

/** El dibujo de la vista previa. Las de temporada muestran la etiqueta S1 de ejemplo. */
export function lookOf(d: Draft): MedalLook {
  const t = T(d.template)
  return {
    template: d.template,
    number: t.editable.number
      ? d.number
      : t.id === "podio"
        ? String(d.target)
        : null,
    label: t.aggregation === "season_rank" ? "S1" : d.label,
    band: t.editable.band ? d.band : null,
    metal: d.metal,
    accent: d.accent,
  }
}

export function ruleOf(d: Draft) {
  const t = T(d.template)
  const n = d.target.toLocaleString("es-AR")
  switch (t.aggregation) {
    case "season_rank":
      return "Se otorga al cerrar la temporada a quien termina en el tramo que la usa (Administración › Temporadas). La etiqueta dice el número de la temporada."
    case "manual":
      return "La da un admin a mano, desde Administración › Jugadores › Fichas."
    case "once":
      return "Se otorga una vez, cuando el jugador la cumple."
    case "avg_min_matches":
      return `Se otorga cuando el promedio del jugador llega a ${n}, con al menos ${d.minMatches} mixes.`
    case "streak":
      return `Se otorga cuando el jugador encadena ${n} victorias seguidas.`
    case "max":
      return `Se otorga cuando el jugador llega a ${n} en algún momento.`
    default:
      return `Se otorga cuando el jugador llega a ${n}, sumando todas sus partidas.`
  }
}

/** Objetivo fijo: las de una vez y las manuales valen 1; el podio va del 1 al 3. */
export const fixedTarget = (t: Template) =>
  t.aggregation === "once" || t.aggregation === "manual"

/** Errores que frenan el guardado (los mismos límites que la API). */
export function problems(d: Draft): string[] {
  const t = T(d.template)
  const out: string[] = []
  if (!(d.target > 0)) out.push("El objetivo tiene que ser mayor que 0.")
  if (t.aggregation !== "avg_min_matches" && !Number.isInteger(d.target))
    out.push("El objetivo tiene que ser un número entero.")
  if (t.id === "podio" && ![1, 2, 3].includes(d.target))
    out.push("El podio es del puesto 1 al 3.")
  if (!d.title.trim() || d.title.length > 80)
    out.push("El título: de 1 a 80 caracteres.")
  if (t.editable.number && d.number.length > 5)
    out.push("El número: hasta 5 caracteres.")
  if (t.editable.label && d.label.length > 14)
    out.push("La etiqueta: hasta 14 caracteres.")
  if (t.editable.band && d.band.length > 14)
    out.push("La banda: hasta 14 caracteres.")
  return out
}

/** El diseño para la API: solo lo que la plantilla deja editar. */
export function designBody(d: Draft) {
  const t = T(d.template)
  return {
    ...(t.editable.number ? { number: d.number.trim() || null } : {}),
    ...(t.editable.label
      ? { label: d.label.trim().toUpperCase() || null }
      : {}),
    ...(t.editable.band ? { band: d.band.trim().toUpperCase() || null } : {}),
    metal: d.metal,
    ...(t.editable.accent ? { accent: d.accent } : {}),
  }
}

export function fromDefinition(def: {
  template: string
  target: number
  title: string
  filters: Record<string, unknown>
  design: {
    number: string | null
    label: string | null
    band: string | null
    metal: string | null
    accent: string | null
  }
}): Draft {
  const t = T(def.template)
  return {
    template: def.template,
    target: def.target,
    title: def.title,
    titleAuto: def.title === titleFor(t, def.target),
    minMatches: Number(def.filters.min_matches ?? 20),
    numMode:
      def.design.number === numberFor(t.defaults.number, def.target)
        ? "auto"
        : "custom",
    number: def.design.number ?? "",
    label: def.design.label ?? t.defaults.label ?? "",
    band: def.design.band ?? t.defaults.band ?? "",
    metal: (def.design.metal as Metal) ?? "oro",
    accent: def.design.accent ?? t.accent,
  }
}
