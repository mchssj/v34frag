import manifest from "./templates.json"

// Plantillas de las medallas (plan docs/bitacora/2026-11-04-medallas-configurables, sección 2.4). templates.json lo arma
// docs/bitacora/2026-11-04-medallas-configurables/pruebas/armar_manifiesto.py desde los SVG de Kyan (badges/nuevas); la API lo importa
// para validar. Una plantilla es una familia: el SVG de un escalón cualquiera y lo demás se configura.

export type Metal = "bronce" | "plata" | "oro" | "platino" | "diamante"
export type Tone = { light: string; mid: string; dark: string; face?: string }
export type Template = (typeof manifest.plantillas)[number]

export const TEMPLATES: Template[] = manifest.plantillas
export const ACCENTS = manifest.acentos as Record<string, Required<Tone>>
export const METALS = manifest.metales as Record<Metal | "bloqueada", Tone>
export const METAL_LIST: { id: Metal; name: string }[] = [
  { id: "bronce", name: "Bronce" },
  { id: "plata", name: "Plata" },
  { id: "oro", name: "Oro" },
  { id: "platino", name: "Platino" },
  { id: "diamante", name: "Diamante" },
]
export const METAL_LEVEL: Record<Metal, number> = {
  bronce: 1,
  plata: 2,
  oro: 3,
  platino: 4,
  diamante: 5,
}

/** Categorías, en el orden de Logros y del editor. */
export const CATEGORIES = [
  "Temporada",
  "Trayectoria",
  "Habilidad",
  "Arsenal y bomba",
  "Rondas",
  "Mapas",
  "Comunidad",
] as const

export const templateOf = (id: string) => TEMPLATES.find((t) => t.id === id)

/** Lo que dibuja <Medal> (el `MedalDesign` de la API, sin id ni título). */
export type MedalLook = {
  template: string
  number?: string | null
  label?: string | null
  band?: string | null
  metal?: Metal | string | null
  accent?: string | null
}

/** El número del dibujo a partir del objetivo: "{n}", "{n}%", "{k}" (10000 → 10k) o "{d}" (1.5). */
export function numberFor(fmt: string | null, target: number): string | null {
  if (!fmt) return null
  if (fmt === "{k}")
    return target >= 10000 && target % 1000 === 0
      ? `${target / 1000}k`
      : String(target)
  if (fmt === "{d}") return target.toFixed(1)
  return fmt.replace("{n}", String(target))
}

/** El título por defecto ("{n} kills con AWP" → "500 kills con AWP"); igual que defaultTitle de la API. */
export function titleFor(t: Template, target: number): string {
  const n =
    Number.isInteger(target) && target >= 10000
      ? target.toLocaleString("es-AR")
      : String(target)
  return t.titleFmt.replace("{n}", n)
}

/** El metal de cada escalón: sube con el escalón (bronce, plata, oro, platino y diamante). */
export function metalForStep(t: Template, target: number): Metal {
  const i = t.steps.indexOf(target)
  const list: Metal[] = ["bronce", "plata", "oro", "platino", "diamante"]
  if (t.steps.length <= 1) return (t.metal as Metal | null) ?? "oro"
  return list[Math.min(Math.max(i, 0), 4)]!
}

/** El dibujo por defecto de una plantilla con un objetivo. */
export function defaultLook(t: Template, target = t.steps[0] ?? 1): MedalLook {
  return {
    template: t.id,
    number: t.editable.number ? numberFor(t.defaults.number, target) : null,
    label: t.defaults.label,
    band: t.defaults.band,
    metal:
      t.aggregation === "season_rank" && t.id === "podio"
        ? (["oro", "plata", "bronce"][target - 1] as Metal)
        : metalForStep(t, target),
    accent: t.accent,
  }
}

/** Los puestos 11 en adelante no tienen diseño propio (propuesta mientras Kyan lo diseña: pregunta 1 del plan). */
export const isProposal = (l: Pick<MedalLook, "template" | "band">) =>
  l.template === "top_temporada" &&
  Number(/\d+/.exec(l.band ?? "")?.[0] ?? 0) > 10
