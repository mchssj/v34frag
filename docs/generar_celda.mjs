// Uso: node docs/generar_celda.mjs salida.svg
// Marco "Celda" (inspiración 3.gif, diseño propio): una plancha de hierro remachada con dos barrotes sobre la foto.
// Dos puños esposados, unidos por una cadena, suben por los barrotes, tiran hasta doblarlos hacia afuera, tiemblan del
// esfuerzo y caen de golpe; los barrotes vuelven con un rebote. Ciclo de 3 s.
// Los barrotes son caminos con los mismos comandos en todas las poses (si no, el navegador salta sin animar), y la
// cadena tiene largo fijo: cuelga cuando los puños están juntos y queda tensa cuando tiran.
import { writeFileSync } from "node:fs"

const [out] = process.argv.slice(2)
if (!out) throw new Error("uso: node docs/generar_celda.mjs salida.svg")

const r1 = (v) => Math.round(v * 10) / 10
const DUR = 3
const OUT = 10, IN = 34 // franja de hierro: de 10 a 34; la foto empieza en 32, así que la plancha la pisa 2 px
const XL = 78, XR = 178, TOP = 28, BOT = 228 // barrotes (30 % y 70 %), con los extremos debajo de la plancha
const TINTA = "#1d1d22"

// Poses: momento del ciclo (0-1), altura de los puños y cuánto se abren los barrotes.
const POSES = [
  [0.0, 198, 0], [0.12, 198, 0], [0.24, 180, 0], [0.32, 180, 0], [0.44, 162, 0], [0.52, 162, 0], // suben de a saltos
  [0.64, 156, 15], [0.7, 156, 12], [0.74, 156, 16], [0.78, 156, 12], [0.82, 156, 16], // tiran y tiemblan
  [0.88, 198, 0], [0.92, 198, -3], [0.96, 198, 1], [1.0, 198, 0], // caen de golpe; los barrotes rebotan
]
const keyTimes = POSES.map(([t]) => t).join(";")

// Barrote que pasa por el puño (x ± d, hy) con tangente vertical ahí: dos cúbicas, siempre los mismos comandos.
const barra = (x, hy, d) => {
  const g = x + d
  const a = (hy - TOP) * 0.4, b = (BOT - hy) * 0.4 // controles proporcionales a cada tramo: un arco parejo, sin S
  return `M${x} ${TOP}C${x} ${r1(TOP + a)} ${r1(g)} ${r1(hy - a)} ${r1(g)} ${hy}C${r1(g)} ${r1(hy + b)} ${x} ${r1(BOT - b)} ${x} ${BOT}`
}
const anima = (attr, valores) =>
  `<animate attributeName="${attr}" dur="${DUR}s" repeatCount="indefinite" keyTimes="${keyTimes}" values="${valores.join(";")}"/>`
const traslada = (valores) =>
  `<animateTransform attributeName="transform" type="translate" dur="${DUR}s" repeatCount="indefinite" keyTimes="${keyTimes}" values="${valores.join(";")}"/>`
const rota = (valores) =>
  `<animateTransform attributeName="transform" type="rotate" additive="sum" dur="${DUR}s" repeatCount="indefinite" keyTimes="${keyTimes}" values="${valores.join(";")}"/>`

const poses = (lado) => POSES.map(([, hy, d]) => barra(lado < 0 ? XL : XR, hy, lado * d))
for (const lado of [-1, 1]) {
  const cmds = poses(lado).map((p) => p.replace(/[-\d.\s]+/g, ""))
  if (new Set(cmds).size !== 1) throw new Error("las poses del barrote no tienen los mismos comandos")
}
const barrote = (lado) => {
  const ps = poses(lado), d0 = ps[0]
  return `<g>
    <path d="${d0}" fill="none" stroke="${TINTA}" stroke-width="10" stroke-linecap="round">${anima("d", ps)}</path>
    <path d="${d0}" fill="none" stroke="#4e5259" stroke-width="7" stroke-linecap="round">${anima("d", ps)}</path>
    <path d="${d0}" fill="none" stroke="#9aa0aa" stroke-width="2" stroke-linecap="round" transform="translate(-1.5 0)">${anima("d", ps)}</path>
  </g>`
}

// Cadena de largo fijo entre las dos esposas (parábola). Con los puños juntos cuelga 14 px; si tiran, queda recta.
const N = 9, SPAN0 = XR - XL - 28, SAG0 = 14, LARGO = SPAN0 + (8 * SAG0 * SAG0) / (3 * SPAN0)
const eslabones = POSES.map(([, hy, d]) => {
  const x0 = XL - d + 14, x1 = XR + d - 14, y = hy + 16, span = x1 - x0
  const sag = span >= LARGO ? 0 : Math.sqrt((3 * span * (LARGO - span)) / 8)
  return Array.from({ length: N }, (_, k) => {
    const u = (k + 0.5) / N, x = x0 + u * span, yy = y + 4 * sag * u * (1 - u)
    const ang = (Math.atan2(4 * sag * (1 - 2 * u), span) * 180) / Math.PI
    return [r1(x), r1(yy), r1(ang)]
  })
})
const cadena = Array.from({ length: N }, (_, k) => {
  const tr = eslabones.map((p) => `${p[k][0]} ${p[k][1]}`), ro = eslabones.map((p) => p[k][2])
  const forma = k % 2 === 0
    ? `<ellipse rx="6.5" ry="3.6" fill="none" stroke="${TINTA}" stroke-width="3.6"/><ellipse rx="6.5" ry="3.6" fill="none" stroke="#7b8089" stroke-width="2"/>`
    : `<rect x="-6.5" y="-1.6" width="13" height="3.2" rx="1.6" fill="#5f636b" stroke="${TINTA}" stroke-width="1.2"/>`
  return `<g transform="translate(${tr[0]})">${traslada(tr)}${rota(ro)}${forma}</g>`
}).join("\n    ")

// Puño que agarra el barrote: palma, cuatro nudillos y el pulgar; la esposa queda detrás, del lado de afuera.
const puno = (lado) => {
  const tr = POSES.map(([, hy, d]) => `${r1((lado < 0 ? XL : XR) + lado * d)} ${hy}`)
  const s = lado < 0 ? 1 : -1 // el derecho es el izquierdo espejado
  return `<g transform="translate(${tr[0]})">${traslada(tr)}<g transform="scale(${s * 1.3} 1.3)">
      <circle cx="-9" cy="9" r="10" fill="#6b717b" stroke="${TINTA}" stroke-width="2"/>
      <circle cx="-9" cy="9" r="5.5" fill="#3e434b" stroke="${TINTA}" stroke-width="1.2"/>
      <path d="M-11 -9h18a5 5 0 0 1 5 5v15a6 6 0 0 1-6 6h-14a6 6 0 0 1-6-6v-14a6 6 0 0 1 3-6z" fill="#e8d3a8" stroke="${TINTA}" stroke-width="2"/>
      <path d="M-9 13h16a4 4 0 0 0 4-4v4a6 6 0 0 1-6 6h-12a6 6 0 0 1-4-2z" fill="#c9ae80"/>
      <path d="M-3 -9v9M3 -9v9M9 -8v8" stroke="${TINTA}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M-13 3c4-2 9-2 12 1" fill="none" stroke="${TINTA}" stroke-width="1.8" stroke-linecap="round"/>
    </g></g>`
}

// Plancha de hierro: franja con biselado (claro arriba y a la izquierda) y remaches sobre la línea media.
const M = (OUT + IN) / 2, PASO = 26
// Hueco con las esquinas de la foto (radio 8 % de 192 = 15,4) menos 2 px: la plancha pisa la foto también en las esquinas.
const R = r1(15.4 - (IN - 32))
const remaches = []
for (let a = M; a <= 256 - M + 0.1; a += (256 - 2 * M) / Math.round((256 - 2 * M) / PASO)) {
  for (const [x, y] of [[a, M], [a, 256 - M], [M, a], [256 - M, a]]) remaches.push(`${r1(x)},${r1(y)}`)
}
const unicos = [...new Set(remaches)].map((p) => p.split(",").map(Number))
const plancha = `<path d="M${OUT} ${OUT}H${256 - OUT}V${256 - OUT}H${OUT}ZM${IN + R} ${IN}A${R} ${R} 0 0 0 ${IN} ${IN + R}V${256 - IN - R}A${R} ${R} 0 0 0 ${IN + R} ${256 - IN}H${256 - IN - R}A${R} ${R} 0 0 0 ${256 - IN} ${256 - IN - R}V${IN + R}A${R} ${R} 0 0 0 ${256 - IN - R} ${IN}Z" fill="url(#hierro)" fill-rule="evenodd" stroke="${TINTA}" stroke-width="2.5"/>
  <path d="M${OUT + 2.5} ${256 - OUT - 2.5}V${OUT + 2.5}H${256 - OUT - 2.5}" fill="none" stroke="#a9b0ba" stroke-width="1.6" opacity=".8"/>
  <path d="M${IN - 2} ${256 - IN + 2}H${256 - IN + 2}V${IN - 2}" fill="none" stroke="#a9b0ba" stroke-width="1.4" opacity=".6"/>
  <path d="M${OUT} ${OUT}L${IN} ${IN}M${256 - OUT} ${OUT}L${256 - IN} ${IN}M${OUT} ${256 - OUT}L${IN} ${256 - IN}M${256 - OUT} ${256 - OUT}L${256 - IN} ${256 - IN}" stroke="${TINTA}" stroke-width="1.4" opacity=".7"/>
  ${unicos.map(([x, y]) => `<use href="#remache" x="${x}" y="${y}"/>`).join("")}`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <!-- Celda: plancha de hierro remachada y dos barrotes sobre la foto. Dos puños esposados suben, tiran hasta doblar
       los barrotes y caen (inspiración 3.gif, diseño propio). Generado con docs/generar_celda.mjs. Ciclo de ${DUR} s. -->
  <defs>
    <linearGradient id="hierro" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7a808a"/><stop offset=".5" stop-color="#5b616b"/><stop offset="1" stop-color="#454a53"/>
    </linearGradient>
    <g id="remache"><circle r="3.4" fill="#6b717b" stroke="${TINTA}" stroke-width="1.2"/><circle cx="-1" cy="-1" r="1.2" fill="#c3cad3"/></g>
  </defs>
  ${barrote(-1)}
  ${barrote(1)}
  ${plancha}
  <g>
    ${cadena}
  </g>
  ${puno(-1)}
  ${puno(1)}
</svg>
`
writeFileSync(out, svg)
console.log(`celda: ${POSES.length} poses, ${N} eslabones, ${unicos.length} remaches, ${Buffer.byteLength(svg)} bytes`)
