import { flat, starPath, text, type D } from "./svgKit"

// Trofeos con volumen (plan docs/bitacora/2026-11-14-pines-de-torneo, "Estilos"): cromo con brillos, sombra y una base
// laqueada con la placa grabada. Formas inspiradas en trofeos reales de CS y otros esports (copa de anillos, triángulo
// partido en piezas, isotipo de CM League en piezas, orbe con corona, alas en V, jarrón esbelto, torre de bloques, corona, disco con mira, obelisco de cristal y
// estrella facetada), sin logos, nombres ni marcas de quien los entrega. Todos miden 200×240 y apoyan en y = 170.

const BASE_TOP = 170

/** Degradados y filtros de los trofeos (cada pin lleva los suyos, con su prefijo). */
function defs(d: D) {
  const { u, t } = d
  const locked = !t.glow
  const gem = locked
    ? ["#C9CDD4", "#6B7079", "#2A2D33"]
    : ["#E0F7FF", "#38BDF8", "#0B3F7A"]
  return flat(`<defs>
    <linearGradient id="${u}-ch" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${t.deep}"/><stop offset=".1" stop-color="${t.dark}"/><stop offset=".24" stop-color="${t.mid}"/>
      <stop offset=".35" stop-color="${t.light}"/><stop offset=".41" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset=".48" stop-color="${t.light}"/>
      <stop offset=".62" stop-color="${t.mid}"/><stop offset=".8" stop-color="${t.dark}"/><stop offset=".92" stop-color="${t.mid}"/><stop offset="1" stop-color="${t.deep}"/>
    </linearGradient>
    <linearGradient id="${u}-cd" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.light}"/><stop offset=".2" stop-color="${t.mid}"/><stop offset=".42" stop-color="${t.dark}"/>
      <stop offset=".58" stop-color="${t.light}"/><stop offset=".7" stop-color="${t.mid}"/><stop offset="1" stop-color="${t.deep}"/>
    </linearGradient>
    <linearGradient id="${u}-cv" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${t.light}"/><stop offset=".45" stop-color="${t.mid}"/><stop offset=".85" stop-color="${t.dark}"/><stop offset="1" stop-color="${t.deep}"/>
    </linearGradient>
    <linearGradient id="${u}-bw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2C2F37"/><stop offset=".5" stop-color="#16181D"/><stop offset="1" stop-color="#08090B"/></linearGradient>
    <linearGradient id="${u}-bt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A4E58"/><stop offset="1" stop-color="#1F2127"/></linearGradient>
    <linearGradient id="${u}-hl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
    <linearGradient id="${u}-vel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A2433"/><stop offset=".55" stop-color="#4E0F1A"/><stop offset="1" stop-color="#22060B"/></linearGradient>
    <linearGradient id="${u}-gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E8F7FF" stop-opacity=".55"/><stop offset=".25" stop-color="#9FD6F5" stop-opacity=".3"/><stop offset=".45" stop-color="#FFFFFF" stop-opacity=".6"/><stop offset=".6" stop-color="#7CC4F0" stop-opacity=".28"/><stop offset="1" stop-color="#CFEFFF" stop-opacity=".5"/></linearGradient>
    <radialGradient id="${u}-gem" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="${gem[0]}"/><stop offset=".45" stop-color="${gem[1]}"/><stop offset="1" stop-color="${gem[2]}"/></radialGradient>
    <radialGradient id="${u}-glass" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset=".35" stop-color="${gem[0]}" stop-opacity=".8"/><stop offset=".75" stop-color="${gem[1]}" stop-opacity=".85"/><stop offset="1" stop-color="${gem[2]}"/></radialGradient>
    <linearGradient id="${u}-lq" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#050608"/><stop offset=".3" stop-color="#2E323B"/><stop offset=".38" stop-color="#5A606C"/><stop offset=".5" stop-color="#16181D"/><stop offset=".85" stop-color="#0B0C10"/><stop offset="1" stop-color="#1E2128"/></linearGradient>
    <pattern id="${u}-lat" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="${t.deep}"/><rect width="1.6" height="4" fill="${t.mid}" opacity=".75"/></pattern>
    <pattern id="${u}-br" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height=".7" fill="#FFFFFF" opacity=".18"/><rect y="1.6" width="3" height=".5" fill="#000000" opacity=".12"/></pattern>
    <filter id="${u}-blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>
  </defs>`)
}

const halo = (d: D, cx: number, cy: number, rx: number, ry: number) =>
  d.t.glow
    ? `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${d.t.glow}" opacity="${d.champ ? 0.32 : 0.16}" filter="url(#${d.u}-g)"/>`
    : ""

/** Base laqueada con filetes de metal y la placa grabada (escalón, torneo y año). */
function plinth(d: D, w = 124) {
  const { u, t } = d
  const top = BASE_TOP
  const a = 100 - w / 2
  return flat(`<g id="base">
    <ellipse cx="100" cy="233" rx="${w / 2 + 10}" ry="5" fill="#000" opacity=".45" filter="url(#${u}-blur)"/>
    <path d="M${a + 6} ${top} H${a + w - 6} L${a + w} ${top + 6} H${a} Z" fill="url(#${u}-bt)"/>
    <rect x="${a}" y="${top + 6}" width="${w}" height="${226 - top}" fill="url(#${u}-bw)"/>
    <rect x="${a}" y="${top + 6}" width="${w}" height="2.4" fill="url(#${u}-ch)"/>
    <rect x="${a}" y="228" width="${w}" height="4" fill="url(#${u}-ch)"/>
    <rect x="${a + 4}" y="${top + 10}" width="8" height="${214 - top}" fill="#FFFFFF" opacity=".05"/>
    <rect x="56" y="${top + 13}" width="88" height="37" rx="1.5" fill="url(#${u}-ch)"/>
    <rect x="58" y="${top + 15}" width="84" height="33" rx="1" fill="none" stroke="${t.deep}" stroke-width=".7" opacity=".7"/>
    ${text(100, top + 27, d.label, 10, 76, t.deep, 900, 1.2)}
    <path d="M78 ${top + 31} H122" stroke="${t.deep}" stroke-width=".6" opacity=".6"/>
    ${text(100, top + 39, d.event, 6, 78, t.deep, 800, 0.4)}
    ${text(100, top + 46, d.year, 5.5, 30, t.deep, 700, 1.2)}
  </g>`)
}

/** Pie torneado: platillo, cuello y nudo. */
function foot(d: D, neckTop: number, w = 52) {
  const { u } = d
  return flat(`<path d="M${100 - w / 2} ${BASE_TOP} Q${100 - w / 2 + 2} ${BASE_TOP - 10} ${100 - 9} ${BASE_TOP - 13} H${100 + 9} Q${100 + w / 2 - 2} ${BASE_TOP - 10} ${100 + w / 2} ${BASE_TOP} Z" fill="url(#${u}-ch)"/>
    <ellipse cx="100" cy="${BASE_TOP}" rx="${w / 2}" ry="2.2" fill="url(#${u}-cv)"/>
    <rect x="95" y="${neckTop}" width="10" height="${BASE_TOP - 13 - neckTop}" fill="url(#${u}-ch)"/>
    <ellipse cx="100" cy="${(neckTop + BASE_TOP - 13) / 2}" rx="9" ry="4.2" fill="url(#${u}-ch)"/>
    <ellipse cx="100" cy="${(neckTop + BASE_TOP - 13) / 2 - 1.4}" rx="7" ry="1.6" fill="#FFFFFF" opacity=".35"/>`)
}

/** Un trazo de metal con sombra debajo (asas, volutas). */
const metalStroke = (d: D, path: string, w: number) =>
  `<path d="${path}" fill="none" stroke="${d.t.deep}" stroke-width="${w + 2.5}" stroke-linecap="round"/><path d="${path}" fill="none" stroke="url(#${d.u}-ch)" stroke-width="${w}" stroke-linecap="round"/><path d="${path}" fill="none" stroke="#FFFFFF" stroke-width="${Math.max(0.8, w / 5)}" stroke-linecap="round" opacity=".35"/>`

const mirror = (s: string) =>
  `<g transform="translate(200 0) scale(-1 1)">${s}</g>`

const wrap = (d: D, body: string) => defs(d) + flat(body) + plinth(d)

// ---------------------------------------------------------------- copa de anillos

export function anillos(d: D) {
  const { u, t } = d
  const rings: string[] = []
  for (let i = 0; i < 12; i++) {
    const y = 28 + i * 8.6
    const yc = y + 3.8
    const hw = yc < 98 ? 38 - (yc - 28) * 0.08 : 32.4 - (yc - 98) * 0.62
    if (i === 8 || i === 9) {
      rings.push(
        `<rect x="${100 - hw}" y="${y}" width="${hw * 2}" height="7.6" fill="url(#${u}-lat)"/><rect x="${100 - hw}" y="${y}" width="${hw * 2}" height="7.6" fill="url(#${u}-ch)" opacity=".35"/>`
      )
      continue
    }
    rings.push(
      `<rect x="${100 - hw + 2}" y="${y - 0.6}" width="${hw * 2 - 4}" height="9.8" fill="${t.deep}"/><rect x="${100 - hw}" y="${y}" width="${hw * 2}" height="7.6" rx="3.8" fill="url(#${u}-ch)"/><rect x="${100 - hw + 3}" y="${y + 0.8}" width="${hw * 2 - 6}" height="1.3" rx=".6" fill="${t.light}" opacity=".55"/>`
    )
  }
  return wrap(
    d,
    `${halo(d, 100, 80, 60, 80)}
    ${foot(d, 130)}
    <rect x="${100 - 15}" y="128" width="30" height="6" rx="3" fill="url(#${u}-ch)"/>
    ${rings.join("")}
    <path d="M62 30 Q62 8 100 7 Q138 8 138 30 Z" fill="url(#${u}-ch)"/>
    <ellipse cx="88" cy="16" rx="12" ry="4" fill="#FFFFFF" opacity=".4"/>
    <rect x="62" y="28.5" width="76" height="2" fill="${t.deep}" opacity=".6"/>`
  )
}

// ---------------------------------------------------------------- isotipo de CM League

// El isotipo de la marca (src/assets/brand: dos chevrones enfrentados y dos barras) en cuatro piezas de metal que flotan
// sobre varillas. Es el único trofeo con la forma de la liga.
export function isotipo(d: D) {
  const { u, t } = d
  // Isotipo de 64×64 escalado ×2.6 y centrado en (100, 84).
  const k = 2.6
  const P = (x: number, y: number) =>
    `${(100 + (x - 32) * k).toFixed(1)} ${(84 + (y - 32) * k).toFixed(1)}`
  const w = 6 * k
  const chevron = `M${P(12, 21)} L${P(23, 32)} L${P(12, 43)}`
  const piece = (shape: string, move: string) =>
    `<g transform="${move}">
      <path d="${shape}" transform="translate(3.5 3)" fill="none" stroke="${t.deep}" stroke-width="${w}" stroke-linejoin="miter"/>
      <path d="${shape}" fill="none" stroke="url(#${u}-cd)" stroke-width="${w}" stroke-linejoin="miter"/>
      <path d="${shape}" fill="none" stroke="url(#${u}-br)" stroke-width="${w}" stroke-linejoin="miter"/>
    </g>`
  const bar = (y: number, move: string) => {
    const x = 100 - w / 2
    const top = 84 + (y - 32) * k
    const h = 11 * k
    return `<g transform="${move}">
      <rect x="${x + 3.5}" y="${top + 3}" width="${w}" height="${h}" fill="${t.deep}"/>
      <rect x="${x}" y="${top}" width="${w}" height="${h}" fill="url(#${u}-ch)"/>
      <rect x="${x}" y="${top}" width="${w}" height="${h}" fill="url(#${u}-br)"/>
      <rect x="${x}" y="${top}" width="${w}" height="1.4" fill="#FFFFFF" opacity=".5"/>
    </g>`
  }
  const rod = (x: number, y: number) =>
    `<rect x="${x - 1.4}" y="${y}" width="2.8" height="${170 - y}" fill="url(#${u}-ch)"/>`
  return wrap(
    d,
    `${halo(d, 100, 84, 72, 70)}
    ${rod(46, 116)}${rod(154, 116)}${rod(100, 146)}
    ${piece(chevron, "translate(-7 0) rotate(-4 62 84)")}
    ${mirror(piece(chevron, "translate(-7 0) rotate(-4 62 84)"))}
    ${bar(11, "translate(0 -9)")}
    ${bar(42, "translate(0 4)")}
    <path d="M80 170 L84 164 H116 L120 170 Z" fill="url(#${u}-ch)"/>`
  )
}

// ---------------------------------------------------------------- rombo partido

export function rombo(d: D) {
  const { u, t } = d
  const pieces: [string, string, string][] = [
    [
      "a",
      "100 8 125 48 102 46 88 58 67.5 60",
      "translate(-2 -10) rotate(-3 100 40)",
    ],
    [
      "b",
      "67.5 60 88 58 102 46 125 48 150 88 139.5 104 112 118 96 110 69.7 118 50 88",
      "translate(4 -3) rotate(2 100 86)",
    ],
    ["c", "69.7 118 96 110 112 118 139.5 104 100 162", ""],
  ]
  const draw = ([id, pts, move]: [string, string, string]) => {
    const shape = `M${pts} Z`
    return `<g transform="${move}">
      <clipPath id="${u}-rb${id}"><path d="${shape}"/></clipPath>
      <path d="${shape}" transform="translate(4 3)" fill="${t.deep}"/>
      <path d="${shape}" fill="url(#${u}-cd)"/>
      <g clip-path="url(#${u}-rb${id})">
        <rect x="100" y="0" width="60" height="170" fill="#FFFFFF" opacity=".14"/>
        <rect x="40" y="0" width="60" height="170" fill="${t.deep}" opacity=".18"/>
        <rect x="40" y="0" width="120" height="170" fill="url(#${u}-br)"/>
        <path d="M100 0 V170" stroke="#FFFFFF" stroke-width="1" opacity=".55"/>
      </g>
      <path d="${shape}" fill="none" stroke="${t.light}" stroke-width=".9" opacity=".7" stroke-linejoin="round"/>
    </g>`
  }
  return wrap(
    d,
    `${halo(d, 100, 86, 64, 82)}
    ${pieces.map(draw).join("")}
    ${d.champ ? `<path d="M100 74 L108 86 L100 98 L92 86 Z" fill="url(#${u}-gem)" stroke="url(#${u}-ch)" stroke-width="1.2" transform="translate(4 -3)"/>` : ""}
    <path d="M84 170 L88 160 H112 L116 170 Z" fill="url(#${u}-ch)"/>`
  )
}

// ---------------------------------------------------------------- orbe con corona

export function orbe(d: D) {
  const { u, t } = d
  const spike = (x: number, dx: number, h: number) =>
    `<path d="M${x - 6} 112 L${x + 6} 112 L${x + dx} ${112 - h} Z" fill="url(#${u}-ch)"/><path d="M${x} 112 L${x + dx} ${112 - h}" stroke="#FFFFFF" stroke-width=".8" opacity=".45"/>`
  return wrap(
    d,
    `${halo(d, 100, 78, 64, 66)}
    ${foot(d, 118, 58)}
    <path d="M78 120 Q100 128 122 120 L116 112 H84 Z" fill="url(#${u}-ch)"/>
    ${spike(76, -18, 52)}${spike(124, 18, 52)}${spike(88, -6, 44)}${spike(112, 6, 44)}
    <circle cx="100" cy="76" r="31" fill="url(#${u}-glass)"/>
    <path d="M76 70 Q100 56 124 70 M74 84 Q100 98 126 84" fill="none" stroke="#FFFFFF" stroke-width=".8" opacity=".4"/>
    <ellipse cx="90" cy="64" rx="10" ry="6" fill="#FFFFFF" opacity=".7"/>
    <circle cx="112" cy="90" r="3" fill="#FFFFFF" opacity=".5"/>
    <ellipse cx="100" cy="112" rx="34" ry="7" fill="url(#${u}-ch)"/>
    <ellipse cx="100" cy="111" rx="30" ry="3" fill="${t.light}" opacity=".35"/>
    ${spike(64, -26, 60)}${spike(100, 0, 40)}${spike(136, 26, 60)}
    ${[64, 100, 136].map((x, i) => `<circle cx="${x + [-26, 0, 26][i]!}" cy="${112 - [60, 40, 60][i]! - 2}" r="3.2" fill="url(#${u}-gem)"/>`).join("")}`
  )
}

// ---------------------------------------------------------------- alas en V

export function alas(d: D) {
  const { u, t } = d
  const blade = `<path d="M99 150 L86 150 L40 26 L64 12 Z" fill="url(#${u}-cd)"/>
    <path d="M86 150 L80 150 L34 30 L40 26 Z" fill="url(#${u}-ch)"/>
    <path d="M99 150 L64 12 L68 14 L100 142 Z" fill="${t.light}" opacity=".55"/>
    <path d="M58 40 L84 128" stroke="${t.deep}" stroke-width="1" opacity=".5"/>`
  return wrap(
    d,
    `${halo(d, 100, 80, 70, 80)}
    <path d="M100 34 L108 140 L100 150 L92 140 Z" fill="url(#${u}-ch)"/>
    <path d="M100 34 L100 150" stroke="#FFFFFF" stroke-width=".8" opacity=".5"/>
    ${blade}${mirror(blade)}
    <path d="M100 128 L109 140 L100 152 L91 140 Z" fill="url(#${u}-gem)" stroke="url(#${u}-ch)" stroke-width="1.5"/>
    <rect x="78" y="150" width="44" height="8" rx="1" fill="url(#${u}-ch)"/>
    <path d="M70 170 L74 158 H126 L130 170 Z" fill="url(#${u}-ch)"/>
    <rect x="74" y="158" width="52" height="1.5" fill="#FFFFFF" opacity=".4"/>`
  )
}

// ---------------------------------------------------------------- jarrón esbelto

export function jarron(d: D) {
  const { u, t } = d
  const vine = "M84 38 C86 76 92 102 97 120"
  return wrap(
    d,
    `${halo(d, 100, 70, 46, 78)}
    ${foot(d, 128, 48)}
    <path d="M92 120 H108 L106 130 H94 Z" fill="url(#${u}-ch)"/>
    <path d="M74 10 H126 C126 58 118 98 106 122 H94 C82 98 74 58 74 10 Z" fill="url(#${u}-lq)"/>
    <path d="M75.6 28 H124.4 L124 37 H76 Z" fill="url(#${u}-ch)"/>
    <path d="M77 29.2 H123" stroke="#FFFFFF" stroke-width=".7" opacity=".45"/>
    ${metalStroke(d, vine, 2)}${mirror(metalStroke(d, vine, 2))}
    <path d="M100 40 V118" stroke="url(#${u}-ch)" stroke-width="1.4" opacity=".8"/>
    <path d="${starPath(100, 64, 9, 3.8)}" fill="url(#${u}-ch)"/>
    <path d="M82 14 C82 56 87 90 95 114" fill="none" stroke="#FFFFFF" stroke-width="3" opacity=".22" stroke-linecap="round"/>
    <ellipse cx="100" cy="10" rx="26" ry="4.5" fill="url(#${u}-cv)"/>
    <ellipse cx="100" cy="10.4" rx="23" ry="2.8" fill="${t.deep}"/>`
  )
}

// ---------------------------------------------------------------- torre de bloques

export function bloques(d: D) {
  const { u, t } = d
  const w = 13
  const bars = [50, 64, 78, 93.5, 108, 122, 136].map((x, i) => {
    const top = [80, 54, 34, 12, 34, 54, 80][i]!
    const shape =
      i === 3
        ? `M${x} ${top + 7} L${x + w / 2} ${top} L${x + w} ${top + 7} V128 H${x} Z`
        : i < 3
          ? `M${x} ${top + 7} L${x + w} ${top} V128 H${x} Z`
          : `M${x} ${top} L${x + w} ${top + 7} V128 H${x} Z`
    const win =
      i % 2 === 0
        ? `<rect x="${x + 3.5}" y="${top + 16}" width="${w - 7}" height="${Math.min(22, 100 - top)}" rx="1" fill="${t.deep}" opacity=".75"/>`
        : ""
    return `<path d="${shape}" transform="translate(3 3)" fill="${t.deep}"/><path d="${shape}" fill="url(#${u}-ch)"/>${win}<path d="M${x + 1.5} ${top + 9} V126" stroke="#FFFFFF" stroke-width=".9" opacity=".4"/>`
  })
  return wrap(
    d,
    `${halo(d, 100, 80, 70, 76)}
    ${bars.join("")}
    <rect x="46" y="104" width="108" height="9" fill="url(#${u}-cv)"/>
    <rect x="46" y="104" width="108" height="1.6" fill="#FFFFFF" opacity=".45"/>
    <path d="M44 128 H156 V152 H44 Z" transform="translate(3 3)" fill="${t.deep}"/>
    <rect x="44" y="128" width="112" height="24" fill="url(#${u}-cd)"/>
    ${text(100, 144, "CM LEAGUE", 9, 80, t.deep, 900, 3)}
    <path d="M60 170 L64 152 H136 L140 170 Z" fill="url(#${u}-ch)"/>
    <rect x="64" y="152" width="72" height="1.5" fill="#FFFFFF" opacity=".4"/>`
  )
}

// ---------------------------------------------------------------- corona

export function corona(d: D) {
  const { u, t } = d
  const tips: [number, number][] = [
    [52, 58],
    [76, 46],
    [124, 46],
    [148, 58],
  ]
  const jewels = [70, 85, 100, 115, 130]
    .map(
      (x, i) =>
        `<ellipse cx="${x}" cy="${116 + Math.abs(x - 100) * 0.04}" rx="${i === 2 ? 5 : 3.6}" ry="${i === 2 ? 6 : 4.4}" fill="${i % 2 ? "#B3122E" : `url(#${u}-gem)`}" stroke="${t.deep}" stroke-width=".8"/>`
    )
    .join("")
  return wrap(
    d,
    `${halo(d, 100, 90, 64, 62)}
    <path d="M66 170 L70 160 H130 L134 170 Z" fill="url(#${u}-ch)"/>
    <path d="M42 150 Q38 130 60 127 H140 Q162 130 158 150 Q150 162 100 162 Q50 162 42 150 Z" fill="url(#${u}-vel)"/>
    <path d="M52 134 Q100 126 148 134" fill="none" stroke="#FFFFFF" stroke-width="1.4" opacity=".18"/>
    ${[44, 156].map((x) => `<circle cx="${x}" cy="150" r="3.4" fill="url(#${u}-ch)"/><path d="M${x} 153 V161" stroke="url(#${u}-ch)" stroke-width="2.2"/>`).join("")}
    <path d="M60 104 Q100 44 140 104 Z" fill="url(#${u}-vel)"/>
    <ellipse cx="100" cy="104" rx="44" ry="6" fill="${t.deep}"/>
    <path d="M56 106 L52 58 L64 86 L76 46 L88 80 L100 34 L112 80 L124 46 L136 86 L148 58 L144 106 Q100 114 56 106 Z" fill="url(#${u}-ch)"/>
    <path d="M58 100 L55 66 M100 40 L100 78" stroke="#FFFFFF" stroke-width="1.2" opacity=".4"/>
    ${tips.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.6" fill="url(#${u}-ch)"/><circle cx="${x - 1.4}" cy="${y - 1.4}" r="1.4" fill="#FFFFFF" opacity=".7"/>`).join("")}
    <path d="M100 22 L106 30 L100 38 L94 30 Z" fill="url(#${u}-gem)" stroke="url(#${u}-ch)" stroke-width="1.2"/>
    <path d="M56 106 Q100 114 144 106 V126 Q100 134 56 126 Z" fill="url(#${u}-ch)"/>
    <path d="M57 109 Q100 117 143 109" fill="none" stroke="${t.deep}" stroke-width=".8" opacity=".6"/>
    <path d="M57 123 Q100 131 143 123" fill="none" stroke="${t.deep}" stroke-width=".8" opacity=".6"/>
    ${jewels}`
  )
}

// ---------------------------------------------------------------- disco con mira

export function disco(d: D) {
  const { u, t } = d
  const rings = [44, 38, 32]
    .map(
      (r) =>
        `<circle cx="100" cy="70" r="${r}" fill="none" stroke="${t.deep}" stroke-width=".7" opacity=".45"/>`
    )
    .join("")
  return wrap(
    d,
    `${halo(d, 100, 70, 66, 66)}
    ${foot(d, 140, 54)}
    <circle cx="100" cy="70" r="58" fill="${t.deep}"/>
    <circle cx="100" cy="70" r="56" fill="url(#${u}-ch)"/>
    <circle cx="100" cy="70" r="48" fill="url(#${u}-cd)"/>
    ${rings}
    <g fill="none" stroke="${t.deep}" stroke-linecap="round" opacity=".85">
      <circle cx="100" cy="66" r="15" stroke-width="2.6"/>
      <path d="M100 44 V56 M100 76 V88 M78 66 H90 M110 66 H122" stroke-width="2.6"/>
    </g>
    <circle cx="100" cy="66" r="2.4" fill="${t.deep}"/>
    ${text(100, 102, "CM LEAGUE", 7, 56, t.deep, 900, 2)}
    <path d="M62 44 A46 46 0 0 1 120 26" fill="none" stroke="#FFFFFF" stroke-width="3" opacity=".35" stroke-linecap="round"/>
    ${metalStroke(d, "M46 86 Q52 140 100 142 Q148 140 154 86", 6)}
    <rect x="94" y="138" width="12" height="6" fill="url(#${u}-ch)"/>`
  )
}

// ---------------------------------------------------------------- obelisco de cristal

export function obelisco(d: D) {
  const { u, t } = d
  const front = "M80 32 L100 8 L120 32 L124 150 H76 Z"
  return wrap(
    d,
    `${halo(d, 100, 80, 48, 80)}
    <path d="M120 32 L132 40 L135 146 L124 150 Z" fill="#6FA8CC" opacity=".45"/>
    <path d="M100 8 L112 14 L132 40 L120 32 Z" fill="#DDF3FF" opacity=".55"/>
    <path d="${front}" fill="#0E2233" opacity=".35"/>
    <path d="${front}" fill="url(#${u}-gl)"/>
    ${t.glow ? `<path d="${front}" fill="${t.glow}" opacity=".12"/>` : ""}
    <path d="${front}" fill="none" stroke="#FFFFFF" stroke-width="1" opacity=".75"/>
    <path d="M100 8 V150" stroke="#FFFFFF" stroke-width=".6" opacity=".35"/>
    <g fill="none" stroke="#FFFFFF" stroke-linecap="round" opacity=".7">
      <circle cx="100" cy="72" r="13" stroke-width="1.6"/>
      <path d="M100 52 V62 M100 82 V92 M80 72 H90 M110 72 H120" stroke-width="1.6"/>
    </g>
    ${text(100, 112, "CM LEAGUE", 6.5, 40, "#FFFFFF", 900, 1.5)}
    <path d="M84 36 L86 140" stroke="#FFFFFF" stroke-width="2.6" opacity=".45" stroke-linecap="round"/>
    <rect x="72" y="148" width="58" height="10" fill="url(#${u}-ch)"/>
    <rect x="72" y="148" width="58" height="1.5" fill="#FFFFFF" opacity=".45"/>
    <path d="M66 170 L70 158 H132 L136 170 Z" fill="url(#${u}-cd)"/>`
  )
}

// ---------------------------------------------------------------- estrella facetada

export function estrella3d(d: D) {
  const { u, t } = d
  const cx = 100
  const cy = 64
  const pt = (k: number, r: number): [number, number] => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  }
  const f = (p: [number, number]) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`
  const facets: string[] = []
  for (let i = 0; i < 5; i++) {
    const o = pt(i * 2, 58)
    const left = pt(i * 2 - 1, 24)
    const right = pt(i * 2 + 1, 24)
    const up = o[1] < cy
    facets.push(
      `<path d="M${cx} ${cy} L${f(left)} L${f(o)} Z" fill="${up ? t.light : t.mid}"/>`,
      `<path d="M${cx} ${cy} L${f(o)} L${f(right)} Z" fill="${up ? t.mid : t.dark}"/>`
    )
  }
  return wrap(
    d,
    `${halo(d, 100, 64, 66, 66)}
    ${foot(d, 112, 52)}
    <rect x="96" y="86" width="8" height="28" fill="url(#${u}-ch)"/>
    <path d="${starPath(cx, cy + 3, 60, 25)}" fill="${t.deep}"/>
    ${facets.join("")}
    <path d="${starPath(cx, cy, 58, 24)}" fill="none" stroke="${t.deep}" stroke-width=".8" stroke-linejoin="round"/>
    ${Array.from({ length: 5 }, (_, i) => `<path d="M${cx} ${cy} L${f(pt(i * 2, 58))}" stroke="#FFFFFF" stroke-width=".7" opacity=".5"/>`).join("")}
    <circle cx="${cx}" cy="${cy}" r="3" fill="#FFFFFF" opacity=".8"/>`
  )
}
