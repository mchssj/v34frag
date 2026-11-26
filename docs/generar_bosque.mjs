// Marco "Bosque" (inspirado en 7.gif / 7.png, 2026-11-24): la foto se ve desde adentro de un bosque en silueta que se
// mece con el viento. Uso: node docs/generar_bosque.mjs marco.svg [color=#000000] [detalle=#121513] [semilla=7]
// Con otro color sale la variante para el tema oscuro, con la misma forma.
import { writeFileSync } from "node:fs"

const [out, COLOR = "#000000", DETALLE = "#121513", seed = "7"] = process.argv.slice(2)
if (!out) throw new Error("uso: node docs/generar_bosque.mjs marco.svg [color] [detalle] [semilla]")
const DUR = 3.24
let s = Number(seed) >>> 0 || 1
const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const rr = (a, b) => a + (b - a) * rand()
const n = (v) => +v.toFixed(1)
const rad = (g) => (g * Math.PI) / 180

// Hoja con nervio curvo: base, punta y ancho.
const leaf = (x, y, ang, len, w) => {
  const c = Math.cos(ang), k = Math.sin(ang), p = (a, b) => `${n(x + c * a - k * b)} ${n(y + k * a + c * b)}`
  return `M${n(x)} ${n(y)}Q${p(len * 0.4, w)} ${p(len, 0)}Q${p(len * 0.45, -w)} ${n(x)} ${n(y)}`
}
// Ramita: tallo curvo con hojas alternadas y una en la punta.
function sprig(x, y, ang, len, size) {
  let d = "", a = ang, px = x, py = y
  const bend = rr(-0.5, 0.5), steps = Math.max(3, Math.round(len / 4.2))
  for (let i = 0; i < steps; i++) {
    a += bend / steps
    const nx = px + (Math.cos(a) * len) / steps, ny = py + (Math.sin(a) * len) / steps
    d += `M${n(px - 0.4)} ${n(py)}L${n(nx)} ${n(ny)}L${n(px + 0.5)} ${n(py + 0.3)}z`
    const side = i % 2 ? 1 : -1, t = 1 - (i / steps) * 0.35
    d += leaf(nx, ny, a + side * rr(0.5, 1), size * t * rr(0.85, 1.2), size * 0.34 * t)
    if (rand() < 0.5) d += leaf(nx, ny, a - side * rr(0.5, 1), size * t * rr(0.6, 0.9), size * 0.3 * t)
    px = nx; py = ny
  }
  return d + leaf(px, py, a, size, size * 0.32)
}
// Rama de abeto: nace en el tronco, se hunde un poco y levanta la punta, con agujas que cuelgan.
function bough(x, y, dir, len, drop, up, thick) {
  const P = (t) => [x + dir * len * t, y + drop * Math.sin(Math.PI * Math.min(1, t * 1.1)) - up * t * t]
  const top = [], bot = [], k = Math.round(len / 1.7)
  for (let i = 0; i <= k; i++) {
    const t = i / k, [px, py] = P(t), w = thick * Math.pow(Math.max(0, 1 - t), 0.45)
    top.push([px - dir * 0.6, py - w * 0.35 - (i % 2 ? rr(0.2, 1.4) : 0)])
    bot.push([px + dir * rr(-1.5, 1), py + w * 0.65 + (i % 2 ? rr(2, 6.5) : rr(0, 1.2)) * (0.35 + 0.65 * Math.sqrt(1 - t))])
  }
  return "M" + [...top, ...bot.reverse()].map(([a, b]) => `${n(a)} ${n(b)}`).join("L") + "z"
}
// Rama pelada: trazo que se afina y se abre en ramitas.
function twig(x, y, ang, len, w, depth) {
  const segs = 5, L = [], R = []
  let a = ang, px = x, py = y, d = ""
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, h = (w / 2) * (1 - t * 0.8)
    L.push([px + Math.sin(a) * h, py - Math.cos(a) * h]); R.push([px - Math.sin(a) * h, py + Math.cos(a) * h])
    if (depth > 0 && i > 1 && i < segs + 1) d += twig(px, py, a + (i % 2 ? 1 : -1) * rr(0.45, 0.95), len * rr(0.3, 0.5), w * 0.5 * (1 - t * 0.4), depth - 1)
    a += rr(-0.28, 0.28); px += (Math.cos(a) * len) / segs; py += (Math.sin(a) * len) / segs
  }
  return d + "M" + [...L, ...R.reverse()].map(([p, q]) => `${n(p)} ${n(q)}`).join("L") + "z"
}

const sway = (d, px, py, amp, delay, fill = COLOR) =>
  `<path fill="${fill}" d="${d}"><animateTransform attributeName="transform" type="rotate" dur="${DUR}s" begin="-${n(delay)}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" values="${n(-amp)} ${px} ${py};${n(amp)} ${px} ${py};${n(-amp)} ${px} ${py}"/></path>`

const parts = []
// ---- Abeto de la izquierda: tronco fuera de cuadro. Pocas ramas, gruesas, con aire entre ellas ----
const izq = [[60, 46], [78, 60], [98, 68], [118, 74], [137, 64], [156, 76], [175, 68], [194, 80], [208, 84]]
izq.forEach(([y, alcance], i) => parts.push(sway(bough(-6, y + 10, 1, alcance + 6, 6, 18 + rr(-4, 4), 12 + i * 0.6), 0, y, rr(1.3, 2.2), 0.2 + i * 0.09)))
// ---- Abeto de la derecha: más grande y más abierto ----
const der = [[70, 50], [88, 60], [108, 70], [130, 86], [152, 78], [172, 98], [188, 80], [202, 92], [214, 96]]
der.forEach(([y, alcance], i) => parts.push(sway(bough(262, y + 15, -1, alcance + 6, 7, 26 + rr(-5, 5), 13 + i * 0.8), 256, y, rr(1.2, 2), 1 + i * 0.1)))
// ---- Rama pelada que cuelga arriba a la derecha ----
parts.push(sway(twig(176, 22, rad(86), 48, 7, 2) + twig(180, 24, rad(58), 52, 5.5, 2) + twig(204, 24, rad(84), 38, 5, 2), 178, 16, 2.4, 0.5))
// ---- Follaje de arriba: hondo en las esquinas, ralo en el medio ----
const hondo = [44, 34, 24, 14, 18, 17, 26, 38]
for (let g = 0; g < 8; g++) {
  let d = ""
  const x0 = g * 32
  for (let i = 0; i < 10; i++) d += sprig(x0 + rr(-6, 34), rr(22, 33), rad(rr(58, 122)), hondo[g] * rr(0.45, 1.1), rr(7, 11))
  parts.push(sway(d, x0 + 16, 8, rr(1.2, 2.2), g * 0.4))
}
// ---- Ramas arqueadas y maleza de abajo ----
parts.push(sway(twig(92, 222, rad(-62), 50, 6.5, 2) + twig(108, 220, rad(-34), 60, 5, 2) + twig(150, 222, rad(-50), 34, 4, 2), 100, 228, 2.2, 1.4))
const alto = [40, 34, 26, 18, 17, 21, 30, 38]
for (let g = 0; g < 8; g++) {
  let d = ""
  const x0 = g * 32
  for (let i = 0; i < 11; i++) d += sprig(x0 + rr(-6, 34), rr(221, 230), rad(rr(-122, -58)), alto[g] * rr(0.45, 1.1), rr(7, 10))
  parts.push(sway(d, x0 + 16, 248, rr(1.2, 2.2), 0.8 + g * 0.35))
}
// ---- Macizo: pisa la foto (32 a 224) en todo el contorno, con esquinas redondeadas ----
const H = 34, hueco = `M${H + 16} ${H}H${256 - H - 16}q16 0 16 16V${256 - H - 16}q0 16 -16 16H${H + 16}q-16 0 -16 -16V${H + 16}q0 -16 16 -16z`
if (H - 32 < 1) throw new Error("el macizo no pisa la foto")
// Hojas apenas más claras sobre el macizo, para que no sea una plancha lisa.
let detalle = "", borde = ""
for (let i = 0; i < 170; i++) {
  const lado = i % 4, t = rr(6, 250), o = rr(5, 27)
  const [x, y] = lado === 0 ? [t, o] : lado === 1 ? [t, 256 - o] : lado === 2 ? [o, t] : [256 - o, t]
  detalle += leaf(x, y, rr(0, 6.28), rr(5, 9), rr(1.6, 2.6))
}
// Borde de afuera de hojas, en vez de un cuadrado recto: hojas que salen del macizo, sin pasar del lienzo.
const B = 11, M = 256 - 2 * B
for (let i = 0; i < 4; i++)
  for (let t = B; t <= 256 - B; t += 3.1) {
    const q = t + rr(-2, 2), ang = i * 90 - 90 + rr(-48, 48), len = rr(5, 11), [x, y] = [[q, B + 3], [256 - B - 3, q], [q, 256 - B - 3], [B + 3, q]][i]
    borde += leaf(x, y, rad(ang), len, len * 0.36)
  }
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><defs><clipPath id="c"><rect x="${B}" y="${B}" width="${M}" height="${M}" rx="15"/></clipPath></defs><path fill="${COLOR}" d="${borde}"/><g clip-path="url(#c)"><path fill="${COLOR}" fill-rule="evenodd" d="M0 0H256V256H0z${hueco}"/>
${parts.join("\n")}
<path fill="${DETALLE}" d="${detalle}"/></g></svg>
`
writeFileSync(out, svg)
console.log(`${out}: ${parts.length} piezas, ${(svg.length / 1024).toFixed(1)} KB`)
