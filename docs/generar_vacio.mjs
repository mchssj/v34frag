// Uso: node docs/generar_vacio.mjs salida.svg [semilla=7]
// Marco "Vacío" (inspiración 6.gif, diseño propio): una franja negra que ondula como tinta, con un contorno glitch
// rojo y cian desfasado (para que se vea también en el tema oscuro), unas pocas gotas que caen cerca del borde de la foto
// y formas neón (triángulos, círculos, medios círculos) que parpadean cambiando de color. Ciclo de 2 s.
import { writeFileSync } from "node:fs"

const [out, seedArg = "7"] = process.argv.slice(2)
if (!out) throw new Error("uso: node docs/generar_vacio.mjs salida.svg [semilla]")
let s = Number(seedArg) >>> 0 || 1
const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) // misma semilla, mismo SVG
const DUR = 2, C = 128, N = 64
const r1 = (v) => Math.round(v * 10) / 10

// Contorno cerrado de un cuadrado redondeado (superelipse) a `R` del centro, ondulado con ondas al azar.
function contour(R, amp) {
  const waves = Array.from({ length: 3 }, () => ({ k: 3 + Math.floor(rand() * 6), ph: rand() * 2 * Math.PI, a: amp * (0.4 + rand() * 0.6) }))
  return Array.from({ length: N }, (_, i) => {
    const t = (i / N) * 2 * Math.PI, c = Math.cos(t), sn = Math.sin(t)
    const sq = R / Math.pow(Math.abs(c) ** 8 + Math.abs(sn) ** 8, 1 / 8)
    const r = sq + waves.reduce((acc, w) => acc + w.a * Math.sin(w.k * t + w.ph), 0)
    return [C + r * c, C + r * sn]
  })
}
// Curva suave por los puntos (Catmull-Rom a Bézier). Mismo número de comandos siempre: se puede animar `d`.
function smooth(p) {
  const at = (i) => p[(i + p.length) % p.length]
  let d = `M${r1(p[0][0])} ${r1(p[0][1])}`
  for (let i = 0; i < p.length; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    d += `C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`
  }
  return d + "Z"
}
// La franja: borde exterior + borde interior (evenodd). Tres poses, y la primera repetida al final para cerrar el bucle.
const poses = Array.from({ length: 3 }, () => smooth(contour(125, 2.5)) + smooth(contour(94, 4)))
const franja = `<path id="franja" fill-rule="evenodd" d="${poses[0]}">
    <animate attributeName="d" values="${[...poses, poses[0]].join(";")}" dur="${DUR}s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1"/>
  </path>`

// Contorno glitch: la franja repetida en rojo y cian, corrida; de vez en cuando salta más (como una interferencia).
const glitch = (color, dx, dy) => `<use href="#franja" fill="${color}" transform="translate(${dx} ${dy})">
    <animateTransform attributeName="transform" type="translate" values="${dx} ${dy};${dx * 2.6} ${dy};${dx} ${dy};${dx} ${dy};${-dx} ${dy * 2};${dx} ${dy}" keyTimes="0;.31;.35;.78;.8;1" calcMode="discrete" dur="${DUR}s" repeatCount="indefinite"/>
  </use>`

// Gotas: pocas y chicas, en el margen de la foto (entre el 12,5 % y el 18 %), que caen y se apagan.
const gotas = [[52, 40], [150, 36], [218, 92], [40, 170], [190, 220]].map(([x, y], i) => {
  const b = `${(-(i * DUR) / 5).toFixed(2)}s` // cada gota en otro momento del ciclo
  return `<circle cx="${x}" cy="${y}" r="3.5" fill="#000">
    <animate attributeName="cy" values="${y};${y + 9};${y + 9}" keyTimes="0;.7;1" dur="${DUR}s" begin="${b}" repeatCount="indefinite"/>
    <animate attributeName="r" values="3.5;2.2;0" keyTimes="0;.7;1" dur="${DUR}s" begin="${b}" repeatCount="indefinite"/>
  </circle>`
})

// Formas neón en la franja: cada una aparece en algunos tramos del ciclo y cambia de color de golpe.
const COLORES = ["#ff2a2a", "#2aff5a", "#2a5bff", "#ff2ae0", "#ffe62a", "#2ae6ff"]
const formas = {
  tri: (z) => `<path d="M${-z} ${z}L${-z * 0.6} ${-z * 1.1}L${z * 1.1} ${z * 0.8}Z"/>`,
  circ: (z) => `<circle r="${z * 0.75}"/>`,
  medio: (z) => `<path d="M${-z} 0A${z} ${z} 0 0 0 ${z} 0Z"/>`,
  punto: (z) => `<circle r="${z * 0.35}"/>`,
}
const lugares = [[20, 234, "tri", 15], [236, 228, "tri", 12], [28, 20, "tri", 11], [128, 13, "medio", 9], [196, 14, "circ", 7],
  [244, 60, "punto", 8], [243, 160, "circ", 6], [12, 110, "punto", 8], [90, 244, "punto", 7]]
const neon = lugares.map(([x, y, f, z]) => {
  const cols = Array.from({ length: 6 }, () => COLORES[Math.floor(rand() * COLORES.length)])
  const on = Array.from({ length: 6 }, () => (rand() < 0.45 ? 1 : 0))
  if (!on.some(Boolean)) on[Math.floor(rand() * 6)] = 1
  const kt = Array.from({ length: 6 }, (_, i) => r1(i / 6 * 100) / 100).join(";")
  const rot = Math.floor(rand() * 4) * 90
  return `<g transform="translate(${x} ${y}) rotate(${rot})" fill="${cols[0]}" opacity="${on[0]}">
    <animate attributeName="fill" values="${cols.join(";")}" keyTimes="${kt}" calcMode="discrete" dur="${DUR}s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="${on.join(";")}" keyTimes="${kt}" calcMode="discrete" dur="${DUR}s" repeatCount="indefinite"/>
    ${formas[f](z)}
  </g>`
})

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <!-- Vacío: franja negra que ondula, contorno glitch rojo y cian, gotas y formas neón que parpadean (inspiración 6.gif,
       diseño propio). Generado con docs/generar_vacio.mjs (semilla ${seedArg}). Ciclo de ${DUR} s. -->
  <defs>
    ${franja}
    <filter id="brillo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g opacity=".85">
  ${glitch("#ff2a4a", -1.6, -0.8)}
  ${glitch("#2ae6ff", 1.6, 0.8)}
  </g>
  <use href="#franja" fill="#000"/>
  ${gotas.join("\n  ")}
  <g filter="url(#brillo)">
  ${neon.join("\n  ")}
  </g>
</svg>
`
// Comprobación: las poses tienen los mismos comandos (si no, el navegador no puede animar `d`).
const cmds = poses.map((d) => d.replace(/[^MCZ]/g, ""))
if (new Set(cmds).size !== 1) throw new Error("las poses de la franja no tienen los mismos comandos")
writeFileSync(out, svg)
console.log(`${out}: ${(svg.length / 1024).toFixed(1)} KB`)
