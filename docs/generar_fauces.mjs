// Marco "Fauces" (inspirado en 7.gif, 2026-11-24): una boca de monstruo de cómic que rodea la foto y respira.
// Uso: node docs/generar_fauces.mjs marco.svg
// Todo se dibuja con puntos y pasa por la misma deformación, así cada camino tiene dos poses (reposo y respiro) con los
// mismos comandos. El bucle va y vuelve (reposo, respiro, reposo), por eso cierra exacto.
import { writeFileSync } from "node:fs"

const out = process.argv[2]
if (!out) throw new Error("uso: node docs/generar_fauces.mjs marco.svg")

const DUR = 1.4
const C = {
  tinta: "#0d0a0b", labio: "#b32a30", labioSombra: "#7f1d22", labioLuz: "#d2494c",
  piel: "#fbf8dc", pielSombra: "#b9b79f", diente: "#ffffff", dienteSombra: "#b9bac0",
  lengua: "#bd6a62", lenguaSombra: "#8f463f", lenguaLuz: "#e2a097", carne: "#8a2126", carneLuz: "#b32a30",
}

// Deformaciones: cada una mueve un punto de la pose de reposo a la de respiro.
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
const boca = ([x, y]) => {
  const u = (x - 128) / 128, v = (y - 128) / 128
  return [x + 2.4 * u * (1 - v * v), y - 2 * smooth(128, 30, y) - 5.5 * smooth(110, 205, y)]
}
const piel = ([x, y]) => [x + 1.8 * ((x - 128) / 128), y + 1.4 * ((y - 128) / 128)]
const lengua = ([x, y]) => { const b = boca([x, y]), k = smooth(200, 248, y); return [b[0] + 5 * k, b[1] + 2.5 * k] }
const carne = ([x, y]) => [x + 1.6 * Math.sin(x / 19) * smooth(252, 226, y), y - 1.6 * smooth(250, 226, y)]

const num = (v) => +v.toFixed(1)
// Curva suave (Catmull-Rom) por los puntos; un tercer valor en 1 marca una punta.
function spline(pts, closed = true) {
  const n = pts.length, at = (i) => pts[(i + n) % n]
  const tan = (i) => (at(i)[2] || (!closed && (i === 0 || i === n - 1)) ? [0, 0] : [(at(i + 1)[0] - at(i - 1)[0]) / 6, (at(i + 1)[1] - at(i - 1)[1]) / 6])
  const segs = []
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = at(i), b = at(i + 1), ta = tan(i), tb = tan((i + 1) % n)
    segs.push([[a[0] + ta[0], a[1] + ta[1]], [b[0] - tb[0], b[1] - tb[1]], [b[0], b[1]]])
  }
  return { start: [pts[0][0], pts[0][1]], segs, closed }
}
// Trazo de tinta que se afina en las puntas.
function tick(x1, y1, x2, y2, w = 2, bend = 1.5) {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l
  const c = (t, k) => [x1 + dx * t + nx * k, y1 + dy * t + ny * k]
  return { start: [x1, y1], closed: true, segs: [[c(0.3, bend + w * 0.65), c(0.75, bend + w * 0.65), [x2, y2]], [c(0.75, bend - w * 0.4), c(0.3, bend - w * 0.4), [x1, y1]]] }
}
// Trazo largo que se afina, por varios puntos.
function brush(pts, w) {
  const n = pts.length, side = (k) => pts.map(([x, y], i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]), h = (w / 2) * Math.sin((Math.PI * (i + 0.4)) / (n - 0.2)) * k
    return [x - ((b[1] - a[1]) / l) * h, y + ((b[0] - a[0]) / l) * h]
  })
  return spline([...side(1), ...side(-1).reverse()])
}
const toD = (shapes, f) => shapes.map((s) => {
  const p = (q) => { const r = f(q); if (r.some((v) => v < -1 || v > 257)) throw new Error(`punto fuera del lienzo: ${r}`); return `${num(r[0])} ${num(r[1])}` }
  return `M${p(s.start)}` + s.segs.map((c) => `C${c.map(p).join(" ")}`).join("") + (s.closed ? "Z" : "")
}).join("")
const id = (p) => p
let count = 0
function path(shapes, warp, attrs, begin = 0) {
  const list = Array.isArray(shapes) ? shapes : [shapes]
  const a = toD(list, id), b = toD(list, warp)
  const cmd = (d) => d.replace(/[^MCZ]/g, "")
  if (cmd(a) !== cmd(b)) throw new Error("las dos poses no tienen los mismos comandos")
  count++
  const anim = `<animate attributeName="d" dur="${DUR}s" begin="${begin}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" values="${a};${b};${a}"/>`
  return `<path d="${a}" ${attrs}>${anim}</path>`
}
const ink = (w) => `stroke="${C.tinta}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`

// ---- Labios: borde interior y exterior con puntos que se corresponden (interior, exterior, sombra dentro, sombra fuera) ----
const L = [
  // arriba, de izquierda a derecha
  [47, 38, 25, 14, 0.34, 1], [70, 37, 60, 18, 0.36, 1], [97, 42, 95, 24, 0.4, 1], [122, 48, 124, 30, 0.46, 1], [150, 43, 153, 23, 0.4, 1],
  [182, 37, 190, 14, 0.36, 1], [207, 37, 226, 9, 0.34, 1],
  // derecha
  [218, 48, 240, 22, 0.3, 1], [220, 80, 241, 72, 0.28, 1], [217, 120, 237, 120, 0.26, 1], [218, 160, 239, 166, 0.24, 1], [219, 192, 241, 206, 0.16, 0.9],
  // abajo, de derecha a izquierda
  [208, 209, 227, 230, 0, 0.72], [176, 210, 180, 230, 0, 0.64], [140, 206, 142, 226, 0, 0.6], [104, 205, 102, 226, 0, 0.6], [72, 210, 68, 233, 0, 0.66],
  [48, 209, 29, 233, 0, 0.74],
  // izquierda
  [37, 193, 16, 210, 0.14, 0.9], [38, 158, 20, 165, 0.22, 1], [39, 118, 23, 118, 0.26, 1], [37, 78, 20, 76, 0.28, 1], [36, 49, 12, 27, 0.3, 1],
]
const inner = L.map(([x, y]) => [x, y])
const outer = L.map(([, , x, y]) => [x, y])
const mix = (k) => L.map((p) => [p[0] + (p[2] - p[0]) * p[k], p[1] + (p[3] - p[1]) * p[k]])
const R = (pts) => spline(pts)

// ---- Dientes: base 1, base 2 (tapadas por el labio) y punta curva ----
const tooth = (x1, y1, x2, y2, tx, ty, curve) => {
  const s = { start: [x1, y1], closed: true, segs: [] }
  const c = (ax, ay, k) => [ax + (tx - ax) * k + curve * (1 - k), ay + (ty - ay) * k]
  s.segs = [[c(x1, y1, 0.35), c(x1, y1, 0.75), [tx, ty]], [c(x2, y2, 0.75), c(x2, y2, 0.35), [x2, y2]], [[x2, y2], [x1, y1], [x1, y1]]]
  // sombra: media luna pegada al segundo lado
  const mx = x1 + (x2 - x1) * 0.62, my = y1 + (y2 - y1) * 0.62
  const sh = { start: [mx, my], closed: true, segs: [[c(mx, my, 0.35), c(mx, my, 0.75), [tx, ty]], [c(x2, y2, 0.75), c(x2, y2, 0.35), [x2, y2]], [[x2, y2], [mx, my], [mx, my]]] }
  return [s, sh]
}
const teeth = [
  // arriba a la izquierda
  tooth(38, 34, 54, 34, 41, 66, 7), tooth(52, 34, 79, 34, 74, 90, -11), tooth(82, 35, 98, 39, 99, 66, -6),
  // arriba a la derecha
  tooth(154, 40, 172, 34, 155, 64, 7), tooth(176, 34, 202, 33, 178, 80, 12), tooth(199, 33, 219, 34, 209, 70, 5),
  // abajo a la izquierda
  tooth(36, 214, 60, 214, 45, 158, -9), tooth(61, 214, 80, 214, 63, 180, 8),
  // abajo a la derecha
  tooth(160, 214, 178, 215, 179, 188, -5), tooth(179, 215, 202, 215, 184, 168, 10), tooth(199, 214, 220, 212, 212, 152, 5),
]

// ---- Lengua: sale sobre el labio de abajo, cuelga y se relame hacia la derecha, con la punta hacia arriba ----
const T = spline([
  [88, 207], [92, 195], [104, 190], [116, 196, 1], [127, 190], [142, 194], [150, 206], [155, 220], [167, 228], [182, 228], [195, 221], [207, 209, 1],
  [211, 224], [205, 239], [190, 248], [168, 251], [142, 250], [118, 244], [100, 232], [90, 219],
])
const Tsombra = spline([
  [88, 207, 1], [93, 211], [101, 224], [116, 236], [140, 242], [168, 243], [190, 239], [203, 227], [207, 209, 1],
  [211, 224], [205, 239], [190, 248], [168, 251], [142, 250], [118, 244], [100, 232], [90, 219],
])
const Tsurco = brush([[116, 195], [118, 206], [126, 221], [142, 232], [164, 236], [184, 234]], 4)
const Tluz = [brush([[139, 198], [145, 206], [148, 214]], 4), brush([[158, 229], [168, 232], [180, 231]], 3), brush([[97, 196], [102, 194], [107, 195]], 3)]
const Trayas = [tick(97, 203, 105, 200, 1.8, -1.4), tick(127, 198, 135, 200, 1.6, -1.2), tick(103, 226, 112, 236, 1.8, 1), tick(109, 225, 116, 232, 1.5, 0.8), tick(150, 246, 164, 247, 1.8, 0.8), tick(192, 243, 201, 235, 1.8, 1)]

// ---- Piel que asoma detrás: arriba, a los costados y abajo (anillo; el hueco queda tapado por los labios) ----
const P = [[128, 4], [172, 7], [214, 22], [240, 60], [250, 110], [252, 160], [246, 206], [222, 236], [176, 246], [128, 247], [80, 246], [34, 236], [10, 206], [4, 160], [6, 110], [16, 60], [42, 22], [84, 7]]
const hueco = L.map(([ix, iy, ox, oy]) => [ix + (ox - ix) * 0.5, iy + (oy - iy) * 0.5])
const Psombra = spline([[252, 160], [246, 206], [222, 236], [176, 246], [128, 247], [80, 246], [34, 236], [10, 206], [4, 160], [12, 176], [22, 206], [60, 218], [128, 214], [196, 218], [234, 206], [244, 176]])
const Prayas = [tick(114, 8, 118, 15, 1.6, 0.5), tick(124, 7, 126, 13, 1.6, 0.5), tick(146, 10, 143, 16, 1.4, 0.5), tick(12, 118, 18, 122, 1.6, 0.5), tick(11, 127, 16, 130, 1.4, 0.4), tick(20, 222, 27, 233, 1.8, 0.8), tick(28, 230, 34, 239, 1.6, 0.6),
  tick(244, 184, 239, 192, 1.6, 0.5), tick(44, 239, 76, 241, 2, -1.2), tick(56, 244, 70, 244, 1.4, -0.6), tick(236, 219, 227, 232, 1.8, 0.6)]

// ---- Carne desgarrada abajo: jirones en gancho ----
const jiron = (pts) => spline(pts)
const carneAtras = [
  // fondo: sin él se ve la página entre la piel y los jirones
  jiron([[22, 226], [60, 238], [128, 240], [196, 238], [236, 218], [243, 232], [238, 248], [210, 251], [128, 252], [46, 251], [20, 248]]),
  jiron([[2, 247, 1], [9, 243], [13, 236], [10, 230], [6, 231], [5, 238, 1], [2, 229], [8, 221], [17, 224], [22, 232], [30, 240], [42, 246], [50, 252, 1], [38, 250], [30, 255, 1], [22, 250], [12, 250], [6, 255, 1]]),
  jiron([[254, 248, 1], [247, 244], [243, 238], [246, 232], [250, 235, 1], [252, 225], [245, 217], [237, 224], [236, 233], [226, 243], [212, 247], [204, 252, 1], [222, 250], [231, 255, 1], [238, 251], [248, 255, 1]]),
]
const carneFrente = jiron([
  [24, 250, 1], [36, 248], [45, 243], [47, 237], [42, 235, 1], [50, 234], [56, 241], [66, 246], [74, 242], [75, 235], [70, 231, 1], [80, 232], [84, 240], [92, 246], [102, 248], [112, 249], [140, 252], [172, 252], [196, 250], [208, 246], [214, 239],
  [211, 232], [206, 230, 1], [216, 229], [222, 237], [224, 245], [236, 250, 1], [222, 250], [214, 255, 1], [204, 251], [186, 254, 1], [168, 254], [140, 254, 1], [124, 251], [112, 255, 1], [98, 251], [84, 251], [72, 255, 1], [60, 251], [44, 255, 1], [38, 251],
])
const carneBrillo = [tick(51, 238, 60, 247, 2.4, 1), tick(79, 236, 90, 248, 2.6, 1), tick(217, 233, 220, 246, 2.4, -1), tick(14, 229, 24, 242, 2.6, -1), tick(242, 222, 239, 234, 2.6, -1), tick(100, 250, 110, 251, 1.4, 0)]

// ---- Trazos y brillos de los labios ----
const Lrayas = [
  tick(116, 31, 119, 43, 1.8, 1), tick(124, 33, 125, 45, 2, 0), tick(133, 31, 131, 41, 1.6, -1), tick(33, 18, 45, 31, 2, 1.2), tick(24, 22, 37, 35, 1.8, 1.2), tick(219, 14, 209, 27, 2, -1.2), tick(228, 18, 217, 32, 1.6, -1.2),
  tick(22, 104, 35, 101, 1.9, -1), tick(22, 112, 32, 111, 1.6, -0.6), tick(237, 138, 222, 140, 1.9, 1), tick(238, 147, 227, 149, 1.6, 0.8), tick(241, 62, 231, 63, 1.6, 0.6),
  tick(17, 196, 30, 185, 1.9, 1), tick(20, 206, 34, 194, 1.8, 1), tick(240, 200, 227, 190, 1.9, -1), tick(236, 210, 224, 199, 1.6, -1), tick(40, 216, 43, 230, 1.9, -1), tick(68, 213, 66, 227, 1.6, -0.6), tick(75, 212, 74, 222, 1.4, -0.4), tick(212, 213, 220, 224, 1.8, 1),
]
const Lluz = [tick(56, 18, 92, 23, 1.8, 0.6), tick(160, 24, 196, 18, 1.8, 0.6), tick(236, 86, 235, 112, 1.8, 0.4), tick(20, 80, 22, 98, 1.8, -0.4), tick(162, 210, 202, 212, 1.6, 0.6), tick(50, 213, 64, 212, 1.6, 0.6)]

const body = [
  // uno por camino: los dos lados giran al revés y en un mismo camino se restarían
  ...carneAtras.map((c) => path(c, carne, `fill="${C.carne}" ${ink(2)}`, -0.4)),
  path([spline(P), R(hueco)], piel, `fill="${C.piel}" fill-rule="evenodd" ${ink(2.6)}`),
  path(Psombra, piel, `fill="${C.pielSombra}"`),
  path(Prayas, piel, `fill="${C.tinta}"`),
  path(spline(P), piel, `fill="none" ${ink(2.6)}`),
  path(carneFrente, carne, `fill="${C.carne}" ${ink(2)}`, -0.4),
  path(carneBrillo, carne, `fill="${C.carneLuz}"`, -0.4),
  // dientes detrás de los labios
  path(teeth.map(([t]) => t), boca, `fill="${C.diente}" ${ink(2.6)}`),
  path(teeth.map(([, t]) => t), boca, `fill="${C.dienteSombra}"`),
  path(teeth.map(([t]) => t), boca, `fill="none" ${ink(2.2)}`),
  // labios
  path([R(outer), R(inner)], boca, `fill="${C.labio}" fill-rule="evenodd"`),
  path([R(mix(4)), R(inner)], boca, `fill="${C.labioSombra}" fill-rule="evenodd"`),
  path([R(outer), R(mix(5))], boca, `fill="${C.labioSombra}" fill-rule="evenodd"`),
  path(Lluz, boca, `fill="${C.labioLuz}"`),
  path(Lrayas, boca, `fill="${C.tinta}"`),
  path(R(outer), boca, `fill="none" ${ink(2.8)}`),
  path(R(inner), boca, `fill="none" ${ink(3.6)}`),
  // lengua
  path(T, lengua, `fill="${C.lengua}" ${ink(2.8)}`),
  path(Tsombra, lengua, `fill="${C.lenguaSombra}"`),
  path(Tluz, lengua, `fill="${C.lenguaLuz}"`),
  path([Tsurco, ...Trayas], lengua, `fill="${C.tinta}"`),
  path(T, lengua, `fill="none" ${ink(2.8)}`),
]

// Comprobación: el borde interior pisa la foto (12,5 % por lado, radio 8 % de la foto) en las dos poses.
const r = 192 * 0.08
const dist = ([x, y]) => { const qx = Math.abs(x - 128) - (96 - r), qy = Math.abs(y - 128) - (96 - r); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r }
const sampleMax = (f) => {
  const s = R(inner); let max = -Infinity, p0 = f(s.start)
  for (const g of s.segs) { const [c1, c2, e] = g.map(f); for (let t = 0; t <= 1; t += 0.05) { const m = 1 - t; max = Math.max(max, dist([0, 1].map((k) => m ** 3 * p0[k] + 3 * m * m * t * c1[k] + 3 * m * t * t * c2[k] + t ** 3 * e[k]))) } p0 = e }
  return max
}
for (const [n, f] of [["reposo", id], ["respiro", boca]]) { const m = sampleMax(f); if (m > -0.3) throw new Error(`en ${n} el borde interior se sale de la foto (${m.toFixed(2)} px)`); console.log(`${n}: el borde interior pisa la foto al menos ${(-m).toFixed(1)} px`) }

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">${body.join("")}</svg>\n`
writeFileSync(out, svg)
console.log(`${out}: ${count} caminos, ${(svg.length / 1024).toFixed(1)} KB`)
