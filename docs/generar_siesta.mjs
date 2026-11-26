// Marco "Siesta" (inspirado en 5.gif / 5.png, 2026-11-24): pixel art, un marco garabateado a pincel que tiembla,
// estrellas doradas y una chibi oveja que cabecea, se duerme y se despierta de un susto.
// Uso: node docs/generar_siesta.mjs marco.svg [trazo=#ffffff] [semilla=5]
// El trazo se puede cambiar para el tema claro. Cuadrícula de 128 celdas, 12 cuadros de 0,35 s.
import { writeFileSync } from "node:fs"

const [out, TRAZO = "#ffffff", seed = "5"] = process.argv.slice(2)
if (!out) throw new Error("uso: node docs/generar_siesta.mjs marco.svg [trazo] [semilla]")
const N = 128, PASO = 0.35
const COL = { 1: "#14112f", 2: "#ffffff", 3: "#1fb6a6", 4: "#c9c8d6", 5: "#ffdb59", 6: "#ffffff", 7: TRAZO, 8: "#0d6f6c" }
let s = Number(seed) >>> 0 || 1
const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const rr = (a, b) => a + (b - a) * rand()

const grid = () => new Uint8Array(N * N)
const put = (g, x, y, v) => { if (x >= 0 && y >= 0 && x < N && y < N) g[y * N + x] = v }
function toPaths(g) {
  const d = {}
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const v = g[y * N + x]
      if (!v) continue
      let e = x; while (e < N && g[y * N + e] === v) e++
      d[v] = (d[v] ?? "") + `M${x} ${y}h${e - x}v1h${x - e}z`; x = e - 1
    }
  return Object.entries(d).map(([v, p]) => `<path fill="${COL[v]}" d="${p}"/>`).join("")
}

// ---- Marco a pincel: cerdas largas de lado a lado; las de adentro son continuas y pisan la foto (celda 16 a 112) ----
function pincel() {
  const g = grid()
  for (let lado = 0; lado < 4; lado++) {
    const w1 = rr(0, 6.28), w2 = rr(0, 6.28)
    for (let c = 0; c < 10; c++) {
      const off = 9 + c, firme = c >= 5 && c <= 8, a = 8 + rr(0, firme ? 1 : 12), b = 120 - rr(0, firme ? 1 : 12)
      let hueco = 0
      for (let t = Math.floor(a); t < b; t++) {
        if (!firme && hueco <= 0 && rand() < (c === 9 || c < 2 ? 0.16 : 0.05)) hueco = rr(3, 16)
        if (hueco-- > 0) continue
        const o = off + Math.round(Math.sin(t / 19 + w1) * 0.9 + Math.sin(t / 7 + w2) * 0.35)
        const [x, y] = [[t, o], [127 - o, t], [t, 127 - o], [o, t]][lado]
        put(g, x, y, 7)
      }
    }
  }
  // Comprobación: entre el borde de la foto y el trazo no queda ningún hueco.
  for (let t = 17; t < 111; t++) for (const [x, y] of [[t, 15], [112, t], [t, 112], [15, t]]) if (!g[y * N + x]) put(g, x, y, 7)
  // Esquinas de la foto (radio de ~8 celdas): se cubren.
  for (const [cx, cy] of [[16, 16], [111, 16], [16, 111], [111, 111]]) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (Math.abs(x) + Math.abs(y) < 5) put(g, cx + x, cy + y, 7)
  return g
}

// ---- Estrellas de cuatro puntas ----
function estrella(g, cx, cy, r) {
  const f = (x, y, q) => Math.pow(Math.abs(x), 0.78) + Math.pow(Math.abs(y), 0.78) <= Math.pow(q, 0.78)
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (f(x, y, r * 0.5)) put(g, cx + x, cy + y, 6)
    else if (f(x, y, r + 0.3)) put(g, cx + x, cy + y, 5)
  }
}
const ESTRELLAS = [[17, 15, 12], [20, 111, 8], [9, 93, 5], [40, 117, 5], [102, 11, 5], [113, 19, 6]]

// ---- Personaje: base en (cx, by), estirado por sx y sy ----
const CX = 94, BY = 124, ESC = 0.92
function personaje(g, { sx: ax = 1, sy: ay = 1, ojos = "medio", cuerno = 0, z = 0, boca = 0 }) {
  const sx = ax * ESC, sy = ay * ESC
  const X = (x) => CX + x * sx, Y = (y) => BY + y * sy
  const elip = (x, y, a, b, fill, line = 1, w = 1) => {
    const px = X(x), py = Y(y), A = a * sx, B = b * sy
    for (let j = Math.floor(py - B - w); j <= py + B + w; j++) for (let i = Math.floor(px - A - w); i <= px + A + w; i++) {
      if (j > BY) continue
      const dx = i + 0.5 - px, dy = j + 0.5 - py, dentro = (dx / A) ** 2 + (dy / B) ** 2 <= 1
      if (dentro) put(g, i, j, fill)
      else if (w && (dx / (A + w)) ** 2 + (dy / (B + w)) ** 2 <= 1) put(g, i, j, line)
    }
  }
  const px = (x, y, v) => put(g, Math.round(X(x)), Math.round(Y(y)), v)
  // silueta gruesa por detrás
  const lana = [[-19, -7, 7], [19, -7, 7], [-22, -16, 7], [22, -16, 7], [-19, -25, 7], [19, -25, 7], [-11, -31, 7], [11, -31, 7], [0, -33, 7.5]]
  for (const [x, y, r] of lana) elip(x, y, r, r, 1, 1, 2.2)
  elip(0, -16, 21, 18, 1, 1, 1.5)
  // orejas caídas
  for (const d of [-1, 1]) { elip(d * 27, -13 + cuerno * 0.3, 5.5, 3.6, 2, 1, 1.8); elip(d * 27.5, -12.4 + cuerno * 0.3, 2.6, 1.3, 4, 4, 0) }
  // lana: cada copo con su contorno, y el medio limpio
  for (const [x, y, r] of lana) elip(x, y, r, r, 2, 1, 0.9)
  elip(0, -16, 18, 17, 2, 2, 0)
  for (const [x, y] of [[-17, -19], [17, -18], [-13, -26], [12, -25], [-19, -10], [19, -9]]) { px(x, y, 4); px(x + 1, y, 4); px(x + 1, y - 1, 4) }
  // cuernos enroscados
  for (const d of [-1, 1]) {
    const hx = d * 18, hy = -29 + cuerno
    elip(hx, hy, 7.2, 6.6, 1, 1, 0.8)
    elip(hx + d * 8, hy + 4.5, 3.4, 2.6, 1, 1, 0.8)
    for (const [a, b] of [[-3, -3], [-2, -4], [-1, -4], [0, -4], [1, -4], [2, -3], [3, -2], [3, -1], [3, 0], [2, 1], [1, 2], [0, 2], [-1, 1], [-1, 0], [0, -1]]) px(hx + d * a, hy + b + 1, 2)
    px(hx + d * 9, hy + 5, 2)
  }
  // cara y flequillo
  elip(0, -10.5, 13.5, 10.5, 2, 1, 1.1)
  for (const [x, y, r] of [[-9.5, -19.5, 4.8], [9.5, -19.5, 4.8], [-3, -19, 4.6], [4.5, -20, 4.8]]) elip(x, y, r, r * 0.9, 2, 1, 0.9)
  elip(0, -25, 15, 6, 2, 2, 0)
  for (const d of [-1, 1]) elip(d * 14, -17.5, 4.2, 4.2, 2, 2, 0) // sin esquinas en la cara
  // ojos
  const rect = (x, y, w, h, v) => { const i0 = Math.round(X(x) - w / 2), j0 = Math.round(Y(y)); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, i0 + i, j0 + j, v) }
  for (const d of [-1, 1]) {
    const x = d * 6.5
    if (ojos === "abierto") { rect(x, -13, 5, Math.round(7 * sy), 1); rect(x, -12.2, 3, Math.round(5.6 * sy), 3); rect(x, -12.2, 3, 2, 8); rect(x - 0.6, -11, 1, 2, 2) }
    if (ojos === "medio") { rect(x, -11, 6, 1, 1); rect(x, -10, 4, 4, 1); rect(x, -10, 2, 3, 3) }
    if (ojos === "sueño") { rect(x, -10, 6, 1, 1); rect(x, -9, 4, 2, 1); rect(x, -9, 2, 1, 3) }
    if (ojos === "cerrado") rect(x, -9, 6, 1, 1)
    // "> <": una punta de flecha hacia la nariz
    if (ojos === "apretado") for (let k = -2; k <= 2; k++) { const i = Math.round(X(x)) + d * (Math.abs(k) - 1), j = Math.round(Y(-9)) + k; put(g, i, j, 1); put(g, i + d, j, 1) }
  }
  if (boca === 1) { rect(0, -4.6, 2, 2, 1) } else if (boca === 2) { rect(0, -5, 3, 3, 1); rect(0, -4, 1, 1, 4) } else rect(0, -4, 2, 1, 1)
  // patitas apoyadas en el borde y línea de apoyo
  for (const d of [-1, 1]) elip(d * 12, 0, 4.4, 3.6, 2, 1, 1)
  for (let x = Math.round(X(-27)); x <= X(27); x++) { put(g, x, BY, 1); put(g, x, BY + 1, 1) }
  // Z con halo blanco
  const Z = { 5: ["#####", "...#.", "..#..", ".#...", "#####"], 4: ["####", "..#.", ".#..", "####"] }
  const zeta = (x, y, k) => {
    const cells = []
    Z[k].forEach((row, j) => [...row].forEach((c, i) => c === "#" && cells.push([x + i, y + j])))
    for (const [a, b] of cells) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) put(g, a + i, b + j, 2)
    for (const [a, b] of cells) put(g, a, b, 1)
  }
  if (z >= 1) zeta(104, 80, 4)
  if (z >= 2) zeta(110, 71, 5)
}

const CUADROS = [
  { ojos: "medio" }, { ojos: "cerrado", cuerno: 1, sy: 0.98 }, { ojos: "sueño" }, { ojos: "abierto", sy: 1.02 },
  { ojos: "medio" }, { ojos: "cerrado", cuerno: 1, sy: 0.98 }, { ojos: "sueño", z: 1 }, { ojos: "cerrado", cuerno: 1, sy: 0.97, z: 2 },
  { ojos: "cerrado", cuerno: 3, sy: 0.92, sx: 1.03, z: 2, boca: 1 }, { ojos: "apretado", cuerno: 2, sy: 0.82, sx: 1.06 },
  { ojos: "abierto", sy: 1.22, sx: 0.94, cuerno: -2, boca: 2, susto: true }, { ojos: "abierto", sy: 1.03, boca: 1 },
]
const DUR = +(CUADROS.length * PASO).toFixed(2)
const bordes = [pincel(), pincel(), pincel()]
const turno = (on) => `<animate attributeName="opacity" calcMode="discrete" dur="${DUR}s" repeatCount="indefinite" values="${CUADROS.map((_, i) => (on(i) ? 1 : 0)).join(";")}"/>`
const capa = (g, on) => `<g opacity="${on(0) ? 1 : 0}">${toPaths(g)}${turno(on)}</g>`

const partes = bordes.map((g, k) => capa(g, (i) => i % 3 === k))
CUADROS.forEach((c, k) => {
  const g = grid()
  ESTRELLAS.forEach(([x, y, r], j) => estrella(g, x, y, c.susto ? Math.round(r * 1.35) : r + ((k + j) % 3 === 0 ? 1 : 0)))
  personaje(g, c)
  partes.push(capa(g, (i) => i === k))
})
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="256" height="256" shape-rendering="crispEdges">${partes.join("\n")}</svg>\n`
writeFileSync(out, svg)
console.log(`${out}: ${CUADROS.length} cuadros, ${(svg.length / 1024).toFixed(1)} KB`)
