// Pines de torneo (plan docs/bitacora/2026-11-14-pines-de-torneo, sección 6). El SVG se arma en código porque cada pin
// lleva el nombre del torneo y el año. Cada torneo elige un estilo (la "familia" del pin) y el campeón lleva en todos un
// adorno propio (trofeo, corona, laureles o rayos). Mismo marco oscuro (#0B0C10) y fuente (Montserrat) que las medallas.
// Los estilos se inspiran en trofeos de CS 1.6, CS:GO y CS2, pero son dibujos propios: sin logos ni marcas de terceros.

import {
  FACE,
  INK,
  WHITE,
  esc,
  flat,
  starPath,
  text,
  type D,
  type T,
} from "./svgKit"
import {
  alas,
  anillos,
  bloques,
  corona,
  disco,
  estrella3d,
  obelisco,
  jarron,
  orbe,
  isotipo,
  rombo,
} from "./trophies"

export type PinTier =
  | "champion"
  | "finalist"
  | "third"
  | "semifinalist"
  | "quarter"
  | "round16"
  | "participant"

export type PinMetal = "oro" | "plata" | "bronce" | "acero"

export type PinStyle =
  | "clasico"
  | "cristal"
  | "escudo"
  | "moneda"
  | "estrella"
  | "globo"
  | "cinta"
  | "angular"
  | "anillos"
  | "isotipo"
  | "rombo"
  | "jarron"
  | "orbe"
  | "alas"
  | "bloques"
  | "corona"
  | "disco"
  | "obelisco"
  | "estrella3d"

export const PIN_TIERS: {
  id: PinTier
  name: string
  /** Texto del pin, en mayúsculas. */
  label: string
  metal: PinMetal
}[] = [
  { id: "champion", name: "Campeón", label: "CAMPEÓN", metal: "oro" },
  { id: "finalist", name: "Finalista", label: "FINALISTA", metal: "plata" },
  {
    id: "third",
    name: "Tercer puesto",
    label: "TERCER PUESTO",
    metal: "bronce",
  },
  {
    id: "semifinalist",
    name: "Semifinalista",
    label: "SEMIFINALISTA",
    metal: "bronce",
  },
  {
    id: "quarter",
    name: "Cuartofinalista",
    label: "CUARTOFINALISTA",
    metal: "acero",
  },
  { id: "round16", name: "Octavos de final", label: "OCTAVOS", metal: "acero" },
  {
    id: "participant",
    name: "Participante",
    label: "PARTICIPANTE",
    metal: "acero",
  },
]

// Premios individuales del torneo (plan, sección 3.2): van al jugador, no al equipo. El MVP lleva el adorno del campeón.
export type PinAward =
  "mvp" | "top_fragger" | "awp" | "clutch" | "hs" | "adr" | "entry" | "play"

export const PIN_AWARDS: {
  id: PinAward
  name: string
  label: string
  metal: PinMetal
  /** De dónde sale el ganador. */
  rule: string
}[] = [
  {
    id: "mvp",
    name: "MVP del torneo",
    label: "MVP",
    metal: "oro",
    rule: "Mejor rating del torneo (mínimo de mapas jugados); el organizador lo puede cambiar",
  },
  {
    id: "top_fragger",
    name: "Top fragger",
    label: "TOP FRAGGER",
    metal: "plata",
    rule: "Más kills en el torneo",
  },
  {
    id: "awp",
    name: "Mejor AWP",
    label: "MEJOR AWP",
    metal: "plata",
    rule: "Más kills con AWP",
  },
  {
    id: "clutch",
    name: "Rey del clutch",
    label: "REY DEL CLUTCH",
    metal: "plata",
    rule: "Más clutches ganados",
  },
  {
    id: "hs",
    name: "Mejor puntería",
    label: "MEJOR % HS",
    metal: "bronce",
    rule: "Mayor % de headshots (mínimo de kills)",
  },
  {
    id: "adr",
    name: "Más daño",
    label: "MÁS DAÑO",
    metal: "bronce",
    rule: "Mayor ADR (mínimo de mapas jugados)",
  },
  {
    id: "entry",
    name: "Entry del torneo",
    label: "ENTRY",
    metal: "bronce",
    rule: "Más primeras kills de ronda",
  },
  {
    id: "play",
    name: "Jugada del torneo",
    label: "JUGADA",
    metal: "oro",
    rule: "La elige el organizador (o una votación) entre los clips del torneo",
  },
]

export const awardOf = (id: PinAward) => PIN_AWARDS.find((a) => a.id === id)!

export const PIN_STYLES: { id: PinStyle; name: string; hint: string }[] = [
  {
    id: "clasico",
    name: "Clásico",
    hint: "Copa para el campeón, placa con flecha y sello. Estilo de los Majors",
  },
  {
    id: "cristal",
    name: "Cristal",
    hint: "Prisma tallado sobre una base. Estilo de los trofeos de cristal de las grandes finales",
  },
  {
    id: "escudo",
    name: "Escudo",
    hint: "Escudo con cinta y galones. Estilo de las ligas por temporada",
  },
  {
    id: "moneda",
    name: "Moneda",
    hint: "Moneda acuñada con mira. Estilo de las monedas de pick'em y de los festivales LAN",
  },
  {
    id: "estrella",
    name: "Estrella",
    hint: "Estrella sobre columna. Estilo de los campeonatos mundiales de la época de la 1.6",
  },
  {
    id: "globo",
    name: "Globo",
    hint: "Globo con anillo. Estilo de las finales mundiales",
  },
  {
    id: "cinta",
    name: "Medalla con cinta",
    hint: "Medalla colgada de una cinta. Estilo de las LAN de la 1.6",
  },
  {
    id: "angular",
    name: "Angular",
    hint: "Placa octogonal con cortes en diagonal. Estilo de los circuitos modernos de CS2",
  },
  {
    id: "anillos",
    name: "Copa de anillos",
    hint: "Copa de anillos apilados con banda calada, sobre base laqueada",
  },
  {
    id: "isotipo",
    name: "Isotipo CM League",
    hint: "El logo de la liga en cuatro piezas de metal que flotan sobre varillas",
  },
  {
    id: "rombo",
    name: "Rombo partido",
    hint: "Rombo de metal partido en tres piezas, con la arista central marcada",
  },
  {
    id: "jarron",
    name: "Jarrón esbelto",
    hint: "Copa alta y angosta laqueada en negro, con filetes de metal",
  },
  {
    id: "orbe",
    name: "Orbe con corona",
    hint: "Esfera de cristal sostenida por una corona de puntas",
  },
  {
    id: "alas",
    name: "Alas en V",
    hint: "Dos hojas en V con filo de metal y gema en la base",
  },
  {
    id: "bloques",
    name: "Torre de bloques",
    hint: "Barras de metal escalonadas sobre un bloque grabado",
  },
  {
    id: "corona",
    name: "Corona",
    hint: "Corona con piedras sobre un almohadón de terciopelo",
  },
  {
    id: "disco",
    name: "Disco con mira",
    hint: "Disco de metal con anillos y una mira grabada, sostenido por un arco",
  },
  {
    id: "obelisco",
    name: "Obelisco de cristal",
    hint: "Obelisco de vidrio con la mira grabada, sobre una base de metal",
  },
  {
    id: "estrella3d",
    name: "Estrella facetada",
    hint: "Estrella de metal tallada en facetas, sobre una columna",
  },
]

export const PIN_METALS: { id: PinMetal; name: string }[] = [
  { id: "oro", name: "Oro" },
  { id: "plata", name: "Plata" },
  { id: "bronce", name: "Bronce" },
  { id: "acero", name: "Acero" },
]

export const tierOf = (id: PinTier) => PIN_TIERS.find((t) => t.id === id)!
export const styleOf = (id: PinStyle) => PIN_STYLES.find((s) => s.id === id)!

// Oro, plata y bronce son los de las medallas (templates.json › metales); acero es nuevo, para los escalones bajos.
const TONES: Record<PinMetal, T> = {
  oro: {
    light: "#FFF1B8",
    mid: "#E6A927",
    dark: "#6B4A12",
    deep: "#2E1F06",
    glow: "#F5C542",
  },
  plata: {
    light: "#FFFFFF",
    mid: "#BFC4CD",
    dark: "#4A505B",
    deep: "#1C1F25",
    glow: "#D9DEE6",
  },
  bronce: {
    light: "#FFD1A1",
    mid: "#C8792B",
    dark: "#55301A",
    deep: "#24130A",
    glow: "#E0904A",
  },
  acero: {
    light: "#D5E1EE",
    mid: "#6F8296",
    dark: "#232B35",
    deep: "#0E1218",
    glow: "#7FA3C7",
  },
}
const LOCKED: T = {
  light: "#6B7079",
  mid: "#3A3E46",
  dark: "#1C1E23",
  deep: "#0F1013",
  glow: "",
}

export type PinOptions = {
  /** Escalón por puesto, o `award` para un premio individual. */
  tier?: PinTier
  award?: PinAward
  metal?: PinMetal
  style?: PinStyle
  /** Nombre del torneo, como se ve en la web (se pasa a mayúsculas). */
  event: string
  year: number | string
  /** Prefijo único para los id del SVG (varios pines en la misma página). */
  uid: string
  locked?: boolean
}

const DRAW: Record<PinStyle, (d: D) => string> = {
  clasico: (d) => (d.champ ? trophy(d) : d.participant ? seal(d) : chevron(d)),
  cristal,
  escudo: shield,
  moneda: coin,
  estrella: star,
  globo: globe,
  cinta: ribbon,
  angular,
  anillos,
  isotipo,
  rombo,
  jarron,
  orbe,
  alas,
  bloques,
  corona,
  disco,
  obelisco,
  estrella3d,
}

/** SVG del pin, 200×240. */
export function pinSvg(o: PinOptions): string {
  const tier = o.award ? awardOf(o.award) : tierOf(o.tier ?? "champion")
  const t = o.locked ? LOCKED : TONES[o.metal ?? tier.metal]
  const u = o.uid
  const d: D = {
    u,
    t,
    label: tier.label,
    event: o.event.trim().toUpperCase() || "TORNEO",
    year: String(o.year),
    champ: o.award ? o.award === "mvp" : o.tier === "champion",
    participant: !o.award && o.tier === "participant",
  }
  const defs = flat(`<defs>
    <linearGradient id="${u}-m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.light}"/><stop offset=".3" stop-color="${t.mid}"/><stop offset=".52" stop-color="${t.dark}"/><stop offset=".72" stop-color="${t.mid}"/><stop offset=".86" stop-color="${t.light}"/><stop offset="1" stop-color="${t.dark}"/></linearGradient>
    <linearGradient id="${u}-v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.dark}"/><stop offset=".22" stop-color="${t.mid}"/><stop offset=".4" stop-color="${t.light}"/><stop offset=".58" stop-color="${t.mid}"/><stop offset="1" stop-color="${t.dark}"/></linearGradient>
    <linearGradient id="${u}-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E2129"/><stop offset="1" stop-color="${FACE}"/></linearGradient>
    <radialGradient id="${u}-r" cx=".36" cy=".32" r=".75"><stop offset="0" stop-color="${t.light}"/><stop offset=".45" stop-color="${t.mid}"/><stop offset="1" stop-color="${t.dark}"/></radialGradient>
    <filter id="${u}-g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" role="img"><title>${esc(`${tier.name} · ${o.event} ${d.year}`)}</title>${defs}${DRAW[o.style ?? "clasico"](d)}</svg>`
}

// ---------------------------------------------------------------- piezas comunes

const glow = (d: D, shape: string) =>
  d.t.glow
    ? shape.replace(
        "GLOW",
        `fill="${d.t.glow}" opacity=".26" filter="url(#${d.u}-g)"`
      )
    : ""

/** Banda horizontal con el escalón, cruzando la pieza. */
function band(d: D, y: number, w = 172, size = 13) {
  const a = 100 - w / 2
  const b = 100 + w / 2
  return flat(`<g id="banda">
    <path d="M${a - 4} ${y} H${b + 4} L${b - 2} ${y + 24} H${a + 2} Z" fill="${INK}"/>
    <path d="M${a} ${y + 3} H${b} L${b - 5} ${y + 21} H${a + 5} Z" fill="${FACE}" stroke="url(#${d.u}-m)" stroke-width="2"/>
    ${text(100, y + 17, d.label, size, w - 18, "#FFFFFF", 900, 1.2)}
  </g>`)
}

/** Pie con base escalonada. */
function stand(d: D, top: number) {
  return flat(`<g id="pie">
    <path d="M84 ${top} H116 L120 ${top + 14} H80 Z" fill="url(#${d.u}-v)" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M60 ${top + 14} H140 L148 ${top + 34} H52 Z" fill="${FACE}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M60 ${top + 14} H140 L142 ${top + 19} H58 Z" fill="url(#${d.u}-v)"/>
    <rect x="46" y="${top + 34}" width="108" height="8" rx="2" fill="url(#${d.u}-v)" stroke="${INK}" stroke-width="2.5"/>
  </g>`)
}

/** Placa del pedestal con el escalón, el torneo y el año (copa, estrella, globo, cristal). */
function plaque(d: D, withLabel = true) {
  const h = withLabel ? 62 : 46
  const y = 226 - h
  const lines = withLabel
    ? `${text(100, y + 21, d.label, 14, 108, d.t.light, 900, 1.5)}<path d="M70 ${y + 28} H130" stroke="${d.t.mid}" stroke-width="1.2" opacity=".6"/>${text(100, y + 42, d.event, 9.5, 112, WHITE, 800, 0.3)}${text(100, y + 54, d.year, 8, 44, d.t.mid, 700, 2)}`
    : `${text(100, y + 21, d.event, 10, 112, WHITE, 800, 0.3)}${text(100, y + 35, d.year, 8.5, 44, d.t.mid, 700, 2)}`
  return flat(`<g id="placa">
    <rect x="34" y="${y - 4}" width="132" height="${h + 4}" rx="5" fill="${INK}"/>
    <rect x="38" y="${y}" width="124" height="${h - 4}" rx="3" fill="url(#${d.u}-f)" stroke="url(#${d.u}-m)" stroke-width="2"/>
    ${lines}
    <rect x="28" y="226" width="144" height="8" rx="2" fill="url(#${d.u}-v)" stroke="${INK}" stroke-width="2"/>
  </g>`)
}

/** Columna corta con base trapezoidal, de `top` a 160 (antes de la placa). */
function column(d: D, top: number) {
  return flat(`<rect x="93" y="${top}" width="14" height="${142 - top}" fill="url(#${d.u}-v)" stroke="${INK}" stroke-width="2.5"/>
    <ellipse cx="100" cy="143" rx="16" ry="5" fill="url(#${d.u}-m)" stroke="${INK}" stroke-width="2.5"/>
    <path d="M74 146 H126 L134 160 H66 Z" fill="url(#${d.u}-v)" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`)
}

/** Rayos detrás de la pieza del campeón. */
function rays(d: D, cx: number, cy: number, R: number, n = 16) {
  if (!d.champ) return ""
  const w = Math.PI / n / 2.2
  const paths = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const p = (b: number) =>
      `${(cx + Math.cos(b) * R).toFixed(1)} ${(cy + Math.sin(b) * R).toFixed(1)}`
    return `M${cx} ${cy} L${p(a - w)} L${p(a + w)} Z`
  }).join(" ")
  return `<path d="${paths}" fill="${d.t.light}" opacity=".16"/>`
}

/** Laureles a los dos lados (campeón). `from`/`to` en grados, 90 = abajo. */
function laurels(
  d: D,
  cx: number,
  cy: number,
  r: number,
  from = 100,
  to = 235
) {
  if (!d.champ) return ""
  const leaves: string[] = []
  const n = 9
  for (const side of [1, -1]) {
    for (let i = 0; i < n; i++) {
      const deg = from + ((to - from) * i) / (n - 1)
      const a = ((side === 1 ? deg : 180 - deg) * Math.PI) / 180
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      const rot = (side === 1 ? deg + 90 : 90 - deg) + side * 28
      leaves.push(
        `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="8" ry="3.4" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="url(#${d.u}-m)" stroke="${INK}" stroke-width="1.4"/>`
      )
    }
  }
  return `<g id="laureles">${leaves.join("")}</g>`
}

/** Corona chica sobre la pieza (campeón). */
function crown(d: D, cx: number, y: number, w = 56) {
  if (!d.champ) return ""
  const a = cx - w / 2
  const s = w / 6
  return flat(`<g id="corona">
    <path d="M${a} ${y} L${a - 4} ${y - 20} L${a + s * 1.5} ${y - 9} L${cx} ${y - 26} L${a + s * 4.5} ${y - 9} L${a + w + 4} ${y - 20} L${a + w} ${y} Z" fill="url(#${d.u}-m)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="${cx}" cy="${y - 28}" r="3.4" fill="${d.t.light}" stroke="${INK}" stroke-width="1.6"/>
    <circle cx="${a - 4}" cy="${y - 22}" r="2.8" fill="${d.t.light}" stroke="${INK}" stroke-width="1.4"/>
    <circle cx="${a + w + 4}" cy="${y - 22}" r="2.8" fill="${d.t.light}" stroke="${INK}" stroke-width="1.4"/>
  </g>`)
}

// ---------------------------------------------------------------- clásico (Majors)

function trophy(d: D) {
  const { u, t } = d
  const cup = "M58 22 H142 V70 Q142 118 100 126 Q58 118 58 70 Z"
  const ribs = [36, 50, 64, 78, 92]
    .map((y) => {
      const inset = y > 70 ? (y - 70) * 0.55 : 0
      return `<path d="M${60 + inset} ${y} H${140 - inset}" stroke="${t.dark}" stroke-width="3.2" opacity=".55"/><path d="M${60 + inset} ${y + 2.4} H${140 - inset}" stroke="${t.light}" stroke-width="1" opacity=".55"/>`
    })
    .join("")
  return flat(`${glow(d, `<ellipse cx="100" cy="80" rx="62" ry="64" GLOW/>`)}
    <g id="asas" fill="none" stroke-linecap="round">
      <path d="M60 34 Q30 36 32 62 Q34 86 62 92" stroke="${INK}" stroke-width="11"/><path d="M60 34 Q30 36 32 62 Q34 86 62 92" stroke="url(#${u}-v)" stroke-width="6"/>
      <path d="M140 34 Q170 36 168 62 Q166 86 138 92" stroke="${INK}" stroke-width="11"/><path d="M140 34 Q170 36 168 62 Q166 86 138 92" stroke="url(#${u}-v)" stroke-width="6"/>
    </g>
    <g id="copa"><path d="${cup}" fill="${INK}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/><path d="${cup}" fill="url(#${u}-v)"/>${ribs}
      <path d="M54 18 H146 V28 H54 Z" fill="url(#${u}-m)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M76 30 V96" stroke="#FFFFFF" stroke-width="5" opacity=".28" stroke-linecap="round"/></g>
    ${text(100, 66, "CM LEAGUE", 8, 56, t.dark, 900, 1.6)}
    <rect x="92" y="124" width="16" height="16" fill="url(#${u}-v)" stroke="${INK}" stroke-width="2.5"/>
    ${column(d, 138)}
    ${plaque(d)}`)
}

function chevron(d: D) {
  const { u, t } = d
  const outer = "M18 20 H128 L178 88 L128 156 H18 L58 88 Z"
  const inner = "M34 30 H122 L164 88 L122 146 H34 L68 88 Z"
  return flat(`${glow(d, `<path d="${outer}" GLOW/>`)}
    <g id="placa"><path d="${outer}" fill="${INK}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
      <path d="${outer}" fill="url(#${u}-m)" stroke="url(#${u}-m)" stroke-width="3" stroke-linejoin="round"/>
      <path d="${inner}" fill="url(#${u}-f)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M42 36 H118 L146 74" fill="none" stroke="${t.light}" stroke-width="1.6" opacity=".35" stroke-linecap="round"/>
      ${text(104, 56, "CM LEAGUE", 9, 70, t.light, 900, 2.2)}
      <path d="M80 62 H128" stroke="${t.mid}" stroke-width="1.5" opacity=".7"/></g>
    <g transform="translate(-4 -12)">${band(d, 88, 172)}</g>
    ${text(98, 120, d.event, 9.5, 92, WHITE, 800, 0.3)}
    ${text(98, 134, d.year, 8.5, 50, t.mid, 700, 2)}
    ${stand(d, 162)}`)
}

function seal(d: D) {
  const { u, t } = d
  const dots = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2
    return `<circle cx="${(100 + Math.cos(a) * 60).toFixed(1)}" cy="${(84 + Math.sin(a) * 60).toFixed(1)}" r="1.7" fill="${t.light}" opacity=".55"/>`
  }).join("")
  return flat(`${glow(d, `<circle cx="100" cy="84" r="70" GLOW/>`)}
    <g id="sello"><circle cx="100" cy="84" r="72" fill="${INK}"/><circle cx="100" cy="84" r="68" fill="url(#${u}-m)"/>
      <circle cx="100" cy="84" r="56" fill="url(#${u}-f)" stroke="${INK}" stroke-width="3"/>${dots}
      ${text(100, 56, "CM LEAGUE", 8.5, 66, t.light, 900, 2)}
      ${text(100, 112, d.event, 9, 84, WHITE, 800, 0.3)}
      ${text(100, 125, d.year, 8, 44, t.mid, 700, 2)}</g>
    ${band(d, 72, 164, 12)}
    ${stand(d, 162)}`)
}

// ---------------------------------------------------------------- cristal

function cristal(d: D) {
  const { u, t } = d
  const outer = "M100 6 L140 38 L134 148 L100 164 L66 148 L60 38 Z"
  return flat(`${glow(d, `<path d="${outer}" GLOW/>`)}
    ${rays(d, 100, 80, 96)}
    <g id="prisma">
      <path d="${outer}" fill="${INK}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
      <path d="M100 6 L60 38 L66 148 L100 164 Z" fill="${t.mid}" opacity=".9"/>
      <path d="M100 6 L140 38 L134 148 L100 164 Z" fill="${t.light}" opacity=".85"/>
      <path d="M100 18 L124 42 L120 140 L100 152 L80 140 L76 42 Z" fill="url(#${u}-f)" opacity=".6"/>
      <path d="M100 18 L124 42 L120 140 L100 152 L80 140 L76 42 Z" fill="none" stroke="${t.light}" stroke-width="1.2" opacity=".7"/>
      <path d="M100 6 V18 M60 38 L76 42 M140 38 L124 42 M66 148 L80 140 M134 148 L120 140 M100 164 V152" stroke="${t.dark}" stroke-width="1.2" opacity=".6"/>
      <path d="M68 46 L72 138" stroke="#FFFFFF" stroke-width="3" opacity=".45" stroke-linecap="round"/>
      <path d="${starPath(100, 64, 13, 5.5)}" fill="${t.light}" stroke="${INK}" stroke-width="1.4"/>
      ${text(100, 92, "CM", 11, 30, t.light, 900, 1)}
      ${text(100, 136, d.year, 8.5, 34, t.light, 800, 1.5)}
    </g>
    ${band(d, 102, d.champ ? 176 : 164)}
    
    <path d="M72 164 H128 L136 178 H64 Z" fill="url(#${u}-v)" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    ${plaque(d, false)}`)
}

// ---------------------------------------------------------------- escudo (ligas)

function shield(d: D) {
  const { u, t } = d
  const outer = "M38 30 H162 V100 Q162 154 100 188 Q38 154 38 100 Z"
  const inner = "M50 42 H150 V100 Q150 146 100 174 Q50 146 50 100 Z"
  return flat(`${glow(d, `<path d="${outer}" GLOW/>`)}
    ${laurels(d, 100, 112, 84, 70, 200)}
    <g id="escudo">
      <path d="${outer}" fill="${INK}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
      <path d="${outer}" fill="url(#${u}-m)"/>
      <path d="${inner}" fill="url(#${u}-f)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M100 42 V174" stroke="${t.mid}" stroke-width="1" opacity=".25"/>
      ${text(100, 60, "CM LEAGUE", 8.5, 80, t.light, 900, 2)}
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M80 86 L100 70 L120 86" stroke="${INK}" stroke-width="9"/><path d="M80 86 L100 70 L120 86" stroke="url(#${u}-v)" stroke-width="5"/>
        <path d="M80 100 L100 84 L120 100" stroke="${INK}" stroke-width="9"/><path d="M80 100 L100 84 L120 100" stroke="url(#${u}-v)" stroke-width="5"/>
      </g>
      ${text(100, 146, d.event, 9, 82, WHITE, 800, 0.3)}
      ${text(100, 159, d.year, 8, 36, t.mid, 700, 2)}
    </g>
    <g id="cinta">
      <path d="M14 112 L32 106 L32 130 L14 136 L22 124 Z" fill="${t.dark}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M186 112 L168 106 L168 130 L186 136 L178 124 Z" fill="${t.dark}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    </g>
    ${band(d, 106, 148, 12.5)}
    ${crown(d, 100, 28, 60)}`)
}

// ---------------------------------------------------------------- moneda (pick'em, LAN)

function coin(d: D) {
  const { u, t } = d
  const notches = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2
    const p = (r: number) =>
      `${(100 + Math.cos(a) * r).toFixed(1)} ${(96 + Math.sin(a) * r).toFixed(1)}`
    return `M${p(70)} L${p(77)}`
  }).join(" ")
  const top = `CM LEAGUE · ${d.event}`
  const arcLen = Math.PI * 54
  const w = top.length * 8.5 * 0.68
  return flat(`<g transform="translate(0 26)">${glow(d, `<circle cx="100" cy="96" r="80" GLOW/>`)}
    ${rays(d, 100, 96, 112, 20)}
    ${laurels(d, 100, 100, 90, 55, 175)}
    <g id="moneda">
      <circle cx="100" cy="96" r="82" fill="${INK}"/>
      <circle cx="100" cy="96" r="78" fill="url(#${u}-m)"/>
      <path d="${notches}" stroke="${t.dark}" stroke-width="2" opacity=".65"/>
      <circle cx="100" cy="96" r="68" fill="url(#${u}-r)" stroke="${INK}" stroke-width="3"/>
      <circle cx="100" cy="96" r="62" fill="url(#${u}-f)" opacity=".82"/>
      <path id="${u}-arc" d="M46 96 A54 54 0 0 1 154 96" fill="none"/>
      <text font-family="Montserrat, sans-serif" font-weight="900" font-size="8.5" letter-spacing="1" fill="${t.light}"${w > arcLen ? ` textLength="${arcLen.toFixed(0)}" lengthAdjust="spacingAndGlyphs"` : ""}><textPath href="#${u}-arc" startOffset="50%" text-anchor="middle">${esc(top)}</textPath></text>
      <g fill="none" stroke-linecap="round">
        <circle cx="100" cy="88" r="17" stroke="${INK}" stroke-width="7"/><circle cx="100" cy="88" r="17" stroke="url(#${u}-v)" stroke-width="3.5"/>
        <path d="M100 63 V77 M100 99 V113 M75 88 H89 M111 88 H125" stroke="${INK}" stroke-width="7"/>
        <path d="M100 63 V77 M100 99 V113 M75 88 H89 M111 88 H125" stroke="url(#${u}-v)" stroke-width="3.5"/>
        <circle cx="100" cy="88" r="2.6" fill="${t.light}" stroke="none"/>
      </g>
      ${text(100, 134, d.year, 9, 40, t.light, 800, 2)}
    </g>
    ${band(d, 150, 176)}
    ${d.champ ? `<path d="${starPath(100, 10, 11, 4.6)}" fill="url(#${u}-m)" stroke="${INK}" stroke-width="2"/>` : ""}
    </g>`)
}

// ---------------------------------------------------------------- estrella (mundiales de la 1.6)

function star(d: D) {
  const { u, t } = d
  const outer = starPath(100, 72, 66, 28)
  return flat(`${glow(d, `<circle cx="100" cy="72" r="64" GLOW/>`)}
    ${rays(d, 100, 72, 100, 20)}
    <g id="estrella">
      <path d="${outer}" fill="${INK}" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>
      <path d="${outer}" fill="url(#${u}-m)" stroke-linejoin="round"/>
      <path d="${starPath(100, 72, 50, 21)}" fill="url(#${u}-f)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      ${Array.from({ length: 5 }, (_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
        return `<path d="M100 72 L${(100 + Math.cos(a) * 50).toFixed(1)} ${(72 + Math.sin(a) * 50).toFixed(1)}" stroke="${t.mid}" stroke-width="1.2" opacity=".55"/>`
      }).join("")}
      <circle cx="100" cy="72" r="16" fill="url(#${u}-r)" stroke="${INK}" stroke-width="2.5"/>
      ${text(100, 76.5, "CM", 11, 24, INK, 900, 0.5)}
    </g>
    ${column(d, 124)}
    ${plaque(d)}`)
}

// ---------------------------------------------------------------- globo (finales mundiales)

function globe(d: D) {
  const { u, t } = d
  return flat(`${glow(d, `<circle cx="100" cy="72" r="64" GLOW/>`)}
    ${rays(d, 100, 72, 104, 20)}
    <g id="anillo-atras"><path d="M30 92 A72 18 -18 0 1 166 46" fill="none" stroke="${INK}" stroke-width="9"/><path d="M30 92 A72 18 -18 0 1 166 46" fill="none" stroke="url(#${u}-v)" stroke-width="4.5"/></g>
    <g id="globo">
      <circle cx="100" cy="72" r="58" fill="${INK}"/>
      <circle cx="100" cy="72" r="54" fill="url(#${u}-r)"/>
      <g fill="none" stroke="${t.dark}" stroke-width="1.6" opacity=".7">
        <ellipse cx="100" cy="72" rx="20" ry="54"/><ellipse cx="100" cy="72" rx="40" ry="54"/><path d="M100 18 V126"/>
        <path d="M46 72 H154"/><path d="M53 45 Q100 56 147 45"/><path d="M53 99 Q100 88 147 99"/>
      </g>
      <path d="M68 40 Q80 28 96 26" fill="none" stroke="#FFFFFF" stroke-width="4" opacity=".45" stroke-linecap="round"/>
    </g>
    <g id="anillo"><path d="M166 46 A72 18 -18 0 1 30 92" fill="none" stroke="${INK}" stroke-width="9"/><path d="M166 46 A72 18 -18 0 1 30 92" fill="none" stroke="url(#${u}-m)" stroke-width="4.5"/></g>
    ${
      d.champ
        ? [
            [40, 24],
            [164, 104],
            [150, 20],
          ]
            .map(
              ([x, y]) =>
                `<path d="${starPath(x!, y!, 7, 3)}" fill="${t.light}" stroke="${INK}" stroke-width="1.2"/>`
            )
            .join("")
        : ""
    }
    <path d="M74 122 Q100 140 126 122" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    <path d="M74 122 Q100 140 126 122" fill="none" stroke="url(#${u}-v)" stroke-width="5" stroke-linecap="round"/>
    ${column(d, 132)}
    ${plaque(d)}`)
}

// ---------------------------------------------------------------- medalla con cinta (LAN de la 1.6)

function ribbon(d: D) {
  const { u, t } = d
  const strap = (path: string) =>
    `<path d="${path}" fill="${t.dark}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`
  return flat(`${glow(d, `<circle cx="100" cy="150" r="62" GLOW/>`)}
    <g id="cinta">
      ${strap("M142 4 H112 L84 98 H114 Z")}
      <path d="M131 4 H123 L95 98 H103 Z" fill="${t.mid}"/>
      ${strap("M58 4 H88 L116 98 H86 Z")}
      <path d="M69 4 H77 L105 98 H97 Z" fill="${t.mid}"/>
      <path d="M58 4 H142" stroke="${INK}" stroke-width="3"/>
    </g>
    <rect x="76" y="92" width="48" height="12" rx="3" fill="url(#${u}-v)" stroke="${INK}" stroke-width="2.5"/>
    ${laurels(d, 100, 152, 72, 60, 200)}
    <g id="medalla">
      <circle cx="100" cy="152" r="64" fill="${INK}"/>
      <circle cx="100" cy="152" r="60" fill="url(#${u}-m)"/>
      <circle cx="100" cy="152" r="50" fill="url(#${u}-f)" stroke="${INK}" stroke-width="3"/>
      <circle cx="100" cy="152" r="45" fill="none" stroke="${t.mid}" stroke-width="1" stroke-dasharray="2 3" opacity=".7"/>
      ${d.champ ? `<path d="${starPath(100, 117, 8, 3.4)}" fill="${t.light}" stroke="${INK}" stroke-width="1.2"/>` : ""}
      ${text(100, d.champ ? 133 : 128, "CM LEAGUE", 8, 70, t.light, 900, 1.8)}
      ${text(100, 178, d.event, 8.5, 72, WHITE, 800, 0.3)}
      ${text(100, 190, d.year, 8, 36, t.mid, 700, 2)}
    </g>
    ${band(d, 140, 176)}`)
}

// ---------------------------------------------------------------- angular (circuitos de CS2)

function angular(d: D) {
  const { u, t } = d
  const outer = "M50 18 H150 L182 54 V122 L150 158 H50 L18 122 V54 Z"
  const inner = "M58 30 H142 L168 60 V116 L142 146 H58 L32 116 V60 Z"
  return flat(`${glow(d, `<path d="${outer}" GLOW/>`)}
    ${
      d.champ
        ? `<g id="alas">
        <path d="M22 66 L2 46 L6 104 L22 118 Z" fill="url(#${u}-m)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M178 66 L198 46 L194 104 L178 118 Z" fill="url(#${u}-m)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      </g>`
        : ""
    }
    <g id="placa">
      <path d="${outer}" fill="${INK}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
      <path d="${outer}" fill="url(#${u}-m)" stroke-linejoin="round"/>
      <path d="${inner}" fill="url(#${u}-f)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M118 30 H142 L100 146 H76 Z" fill="${t.mid}" opacity=".16"/>
      <path d="M150 30 H158 L120 146 H112 Z" fill="${t.mid}" opacity=".1"/>
      <path d="M58 30 H96" stroke="${t.light}" stroke-width="3"/>
      ${text(100, 52, "CM LEAGUE", 9, 80, t.light, 900, 2.4)}
      ${text(100, 124, d.event, 9.5, 108, WHITE, 800, 0.3)}
      ${text(100, 137, d.year, 8.5, 44, t.mid, 700, 2)}
      ${d.champ ? `<path d="${starPath(100, 18, 9, 3.8)}" fill="url(#${u}-m)" stroke="${INK}" stroke-width="2"/>` : ""}
    </g>
    ${band(d, 70, 184)}
    ${stand(d, 162)}`)
}
