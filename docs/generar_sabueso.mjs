// Marco "Sabueso" (inspirado en 8.gif / 8.png, 2026-11-24): un detective de dibujo animado de los años 30, en grises.
// La foto es la cara: gorra de detective y orejas de sabueso arriba, brazos de goma con guantes a los lados y una lupa.
// Uso: node docs/generar_sabueso.mjs marco.svg
// Una sola línea de tiempo (K) manda en brazos, manos y lupa, así nada se desfasa.
import { writeFileSync } from "node:fs"

const out = process.argv[2]
if (!out) throw new Error("uso: node docs/generar_sabueso.mjs marco.svg")
const T = 6
const C = { n: "#0b0b0b", g: "#9c9c9c", gs: "#6f6f6f", gl: "#bdbdbd", b: "#ececec", bs: "#c4c4c4" }
const n = (v) => +v.toFixed(1), k3 = (v) => +v.toFixed(4)

// Momentos (s) y posición de cada muñeca. Fuera de cuadro = y 300.
const K = [
  // t     izquierda     codo izq.     derecha      codo der.
  [0.0, [36, 196], [12, 172], [221, 194], [244, 170]],
  [1.0, [36, 198], [12, 174], [221, 196], [244, 172]],
  [2.0, [36, 196], [12, 172], [221, 194], [244, 170]],
  [2.2, [62, 190], [6, 206], [196, 188], [252, 206]],
  [2.45, [58, 193], [6, 208], [200, 191], [252, 208]],
  [2.7, [62, 190], [6, 206], [196, 188], [252, 206]],
  [2.95, [64, 300], [8, 240], [198, 190], [252, 206]],
  [3.25, [92, 190], [6, 222], [221, 198], [244, 172]],
  [3.4, [88, 199], [4, 222], [221, 194], [244, 170]],
  [3.85, [102, 194], [6, 222], [221, 196], [244, 172]],
  [4.3, [108, 200], [8, 222], [221, 194], [244, 170]],
  [4.75, [94, 194], [6, 222], [221, 196], [244, 172]],
  [4.95, [90, 189], [4, 222], [221, 195], [244, 171]],
  [5.2, [64, 300], [4, 222], [221, 194], [244, 170]],
  [5.4, [40, 300], [10, 220], [221, 194], [244, 170]],
  [5.6, [36, 190], [12, 168], [221, 196], [244, 172]],
  [5.75, [36, 197], [12, 173], [221, 195], [244, 171]],
  [6.0, [36, 196], [12, 172], [221, 194], [244, 170]],
]
if (K[0][0] !== 0 || K.at(-1)[0] !== T || JSON.stringify(K[0].slice(1)) !== JSON.stringify(K.at(-1).slice(1))) throw new Error("el bucle no cierra")
const keyTimes = K.map((r) => k3(r[0] / T)).join(";")
const splines = K.slice(1).map(() => ".4 0 .5 1").join(";")
const timing = `dur="${T}s" repeatCount="indefinite" calcMode="spline" keyTimes="${keyTimes}" keySplines="${splines}"`
const follow = (i) => `<animateTransform attributeName="transform" type="translate" ${timing} values="${K.map((r) => r[i].join(" ")).join(";")}"/>`
// Visibilidad por tramos [desde, hasta) en segundos.
function show(...tramos) {
  const pts = [...new Set([0, ...tramos.flat()])].filter((t) => t < T).sort((a, b) => a - b)
  return `<animate attributeName="opacity" calcMode="discrete" dur="${T}s" repeatCount="indefinite" keyTimes="${pts.map((t) => k3(t / T)).join(";")}" values="${pts.map((t) => (tramos.some(([a, b]) => t >= a && t < b) ? 1 : 0)).join(";")}"/>`
}
// Brazo de goma: del hombro (punta) a la muñeca pasando por el codo.
function arm(shoulder, elbow, wrist) {
  const L = [], R = [], N = 12
  for (let i = 0; i <= N; i++) {
    const t = i / N, m = 1 - t, p = [0, 1].map((j) => m * m * shoulder[j] + 2 * m * t * elbow[j] + t * t * wrist[j])
    const d = [0, 1].map((j) => 2 * m * (elbow[j] - shoulder[j]) + 2 * t * (wrist[j] - elbow[j])), l = Math.hypot(...d) || 1, h = 1 + 6.2 * Math.min(1, t * 1.7)
    L.push([p[0] - (d[1] / l) * h, p[1] + (d[0] / l) * h]); R.push([p[0] + (d[1] / l) * h, p[1] - (d[0] / l) * h])
  }
  return "M" + [...L, ...R.reverse()].map(([a, b]) => `${n(a)} ${n(b)}`).join("L") + "Z"
}
const armPath = (sh, w, e) => `<path fill="${C.n}" stroke="#777" stroke-width="1.2" d="${arm(sh, K[0][e], K[0][w])}"><animate attributeName="d" ${timing} values="${K.map((r) => arm(sh, r[e], r[w])).join(";")}"/></path>`

// Formas unidas: primero todas con contorno y después todas solo con relleno, para que el contorno quede por fuera.
const blob = (shapes, extra = "", fill = C.b) =>
  `<g fill="${fill}" stroke="${C.n}" stroke-width="4.4" stroke-linejoin="round">${shapes.join("")}</g><g fill="${fill}">${shapes.join("")}</g>${extra}`
const el = (x, y, a, b, r = 0) => `<ellipse cx="${x}" cy="${y}" rx="${a}" ry="${b}"${r ? ` transform="rotate(${r} ${x} ${y})"` : ""}/>`
const ln = (d, w = 1.9) => `<path d="${d}" fill="none" stroke="${C.n}" stroke-width="${w}" stroke-linecap="round"/>`
const sh = (d) => `<path d="${d}" fill="${C.bs}"/>`

// Guante agarrando el borde (origen: muñeca).
const puno = blob([el(0, 1, 19, 7.5, -4), el(1, 19, 20, 17), el(-15, 33, 8, 10, 12), el(-4, 38, 8, 10), el(8, 38, 8, 10, -4), el(18, 31, 7, 9.5, -14)],
  sh("M-19 24q3 14 12 20q14 6 28-6q-6 14-20 13q-18 0-20-27z") + ln("M-17 6q17 7 34-2") + ln("M-7 13q-3 8-2 15") + ln("M2 13q0 8 0 15") + ln("M11 12q3 7 3 14") + ln("M-10 30q1 6-1 12") + ln("M2 33v11") + ln("M13 31q0 6 2 10"))
// Guante que se señala con el pulgar (hacia el centro de la foto).
const pulgar = blob([el(-14, 8, 7, 14, 24), el(6, 10, 22, 17), el(34, 3, 13, 6.5, -32), el(-6, 2, 8.5, 12, -12), el(8, -1, 8.5, 12), el(21, 4, 8, 11, 14)],
  sh("M-12 18q12 10 30 4q8-3 10-9q4 13-12 17q-19 4-28-12z") + ln("M-1 -3q3 10 0 20") + ln("M14.5 -5q2 10-1 21") + ln("M26 0q3 7 1 13") + ln("M-16 1q8 4 6 18") + ln("M31 10q6 0 11-4"))
// Guante con la lupa.
const mango = `<g stroke="${C.n}" stroke-linecap="round"><path d="M2 34L14 -20" stroke-width="13"/><path d="M2 34L14 -20" stroke="${C.gs}" stroke-width="8.4"/><path d="M0 33L12 -20" stroke="${C.gl}" stroke-width="2"/></g>`
const aro = `<circle cx="28" cy="-64" r="39" fill="#fff" fill-opacity=".13"/><circle cx="28" cy="-64" r="40" fill="none" stroke="${C.n}" stroke-width="12.5"/><circle cx="28" cy="-64" r="40" fill="none" stroke="${C.g}" stroke-width="8"/><path d="M-11 -73A40 40 0 0 1 42 -101.4" fill="none" stroke="${C.gl}" stroke-width="2.6" stroke-linecap="round"/><g fill="none" stroke="#fff" stroke-linecap="round" stroke-width="3.2"><path d="M33 -92A29 29 0 0 1 55 -73"/><path d="M57 -65v1.8"/><path d="M22 -36A29 29 0 0 1 3 -50"/></g>`
const manoLupa = mango + aro + blob([el(-12, 18, 8, 20, 4), el(4, 12, 20, 17), el(19, 2, 9, 7.5, -12), el(21, 13, 9.5, 7.5), el(20, 24, 9, 7.5, 8), el(13, 33, 8, 6.5, 12)],
  sh("M-8 26q14 12 30 8q-6 8-16 8q-12-2-14-16z") + ln("M12 6q8 2 15-1") + ln("M11 18q9 2 17 0") + ln("M8 29q8 1 16-1") + ln("M-4 4q-5 12-3 26") + ln("M3 2q-3 8-2 14"))

const hand = (i, flip, body, ...tramos) => `<g transform="translate(${K[0][i].join(" ")})"><g opacity="${tramos[0][0] === 0 ? 1 : 0}">${flip ? `<g transform="scale(-1 1)">${body}</g>` : body}${show(...tramos)}</g>${follow(i)}</g>`

// ---- Orejas y gorra ----
const wag = (amp, px, py, dur, begin) => `<animateTransform attributeName="transform" type="rotate" dur="${dur}s" begin="-${begin}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" values="${-amp} ${px} ${py};${amp} ${px} ${py};${-amp} ${px} ${py}"/>`
const oreja = (d, luz) => `<path d="${d}" fill="${C.n}" stroke="#777" stroke-width="1.5"/><path d="${luz}" fill="none" stroke="#4c4c4c" stroke-width="2" stroke-linecap="round"/>`
const orejas = `<g>${oreja("M82 30C58 12 28 16 14 42C2 66 4 102 18 116C27 124 37 114 38 100C40 78 54 62 84 54Z", "M22 48C14 62 13 82 17 98")}${wag(2.4, 82, 42, 3, 0)}</g><g>${oreja("M166 24C188 6 220 8 236 32C252 56 252 88 238 102C230 109 220 101 218 88C215 68 202 54 170 48Z", "M231 38C241 54 243 72 239 88")}${wag(2.4, 168, 36, 3, 1.3)}</g>`
const cuadros = ["M92 46Q88 26 104 13", "M108 51Q106 28 118 9", "M126 52Q127 30 127 8", "M143 49Q146 30 138 9", "M157 42Q160 26 149 13", "M87 34Q122 46 164 29", "M91 23Q122 34 159 19"].map((d) => `<path d="${d}" fill="none" stroke="${C.gs}" stroke-width="2.2" opacity=".75"/>`).join("")
const gorra = `<g><path d="M82 44C78 22 96 7 122 6C148 5 168 16 168 38C150 52 104 58 82 44Z" fill="${C.g}" stroke="${C.n}" stroke-width="3.4" stroke-linejoin="round"/>${cuadros}<path d="M88 30C92 18 104 11 118 10" fill="none" stroke="${C.gl}" stroke-width="3" stroke-linecap="round"/>
<path d="M82 42C104 54 148 50 168 36C171 41 171 45 168 48C148 64 102 68 82 55C78 52 78 46 82 42Z" fill="#1a1a1a" stroke="${C.n}" stroke-width="2"/>
<path d="M70 50C78 46 82 50 92 54C112 60 142 57 160 48C168 44 174 42 180 46C186 52 172 64 152 70C126 78 92 74 76 64C68 59 66 54 70 50Z" fill="${C.g}" stroke="${C.n}" stroke-width="3.4" stroke-linejoin="round"/><path d="M80 63C104 74 140 72 166 59C150 68 118 78 80 63Z" fill="${C.gs}"/><path d="M78 54C92 62 120 64 140 60" fill="none" stroke="${C.gl}" stroke-width="2.4" stroke-linecap="round"/>
<g fill="${C.gs}" stroke="${C.n}" stroke-width="2.6" stroke-linejoin="round"><path d="M124 9C114 0 104 2 105 7C106 12 116 12 124 9Z"/><path d="M124 9C134 -1 145 1 144 6C143 12 132 12 124 9Z"/><circle cx="124" cy="8.5" r="3.4" fill="${C.g}"/></g>
<animateTransform attributeName="transform" type="translate" dur="1.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" values="0 3;0 5.2;0 3"/></g>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
${orejas}${gorra}
${armPath([20, 128], 1, 2)}${armPath([238, 124], 3, 4)}
${hand(3, true, puno, [0, 2.1], [3.1, T])}${hand(3, true, pulgar, [2.1, 3.1])}
${hand(1, false, puno, [0, 2.1], [5.3, T])}${hand(1, false, pulgar, [2.1, 2.95])}${hand(1, false, manoLupa, [2.95, 5.2])}
</svg>
`
writeFileSync(out, svg)
console.log(`${out}: ${(svg.length / 1024).toFixed(1)} KB`)
