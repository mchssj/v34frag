// Piezas comunes de los SVG de pines: tipos, colores fijos y textos (plan docs/bitacora/2026-11-14-pines-de-torneo).

/** Tonos de un metal: `deep` es la sombra más oscura del cromo. */
export type T = {
  light: string
  mid: string
  dark: string
  deep: string
  glow: string
}

/** Lo que necesita cada dibujo. */
export type D = {
  u: string
  t: T
  label: string
  event: string
  year: string
  champ: boolean
  participant: boolean
}

export const INK = "#0B0C10"
export const FACE = "#15171D"
export const WHITE = "#E8EAF0"

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
export const flat = (s: string) => s.replace(/\n\s*/g, "")

/** Texto centrado que se achica (textLength) si no entra en `max` px. */
export function text(
  x: number,
  y: number,
  s: string,
  size: number,
  max: number,
  fill: string,
  weight = 800,
  spacing = 0.5
) {
  // Ancho aproximado de Montserrat ExtraBold en mayúsculas: 0.68 em por letra.
  const w = s.length * size * 0.68 + Math.max(0, s.length - 1) * spacing
  const fit =
    w > max ? ` textLength="${max}" lengthAdjust="spacingAndGlyphs"` : ""
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="${weight}" font-size="${size}" letter-spacing="${spacing}" fill="${fill}"${fit}>${esc(s)}</text>`
}

export function starPath(cx: number, cy: number, R: number, r: number, n = 5) {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n
    const k = i % 2 ? r : R
    pts.push(
      `${(cx + Math.cos(a) * k).toFixed(1)} ${(cy + Math.sin(a) * k).toFixed(1)}`
    )
  }
  return `M${pts.join(" L")} Z`
}

/** Números de prueba repetibles (texturas grabadas): siempre el mismo dibujo para la misma semilla. */
export function rand(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
