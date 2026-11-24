// Marco "Mar de nubes" (inspirado en 6.gif / 6.png, 2026-11-24): pixel art, un mar de nubes violeta que corre bajo la
// foto, nubes sueltas que la cruzan, luna y estrellas que titilan.
// Uso: node docs/generar_nocturno.mjs marco.svg [semilla=6]
// Se dibuja en una cuadrícula de 128 celdas (2 px a 256). La franja de nubes es periódica: da la vuelta exacta.
import { writeFileSync } from "node:fs"

const [out, seed = "6"] = process.argv.slice(2)
if (!out) throw new Error("uso: node docs/generar_nocturno.mjs marco.svg [semilla]")
const N = 128, DUR = 10.56
const C = { oscuro: "#211640", claro: "#3d34a5", luna: "#d59cfc", lunaSombra: "#a675fe", borde: "#000000" }

let s = Number(seed) >>> 0 || 1
const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)

// Cada copo es un círculo con contorno oscuro y luz arriba a la izquierda, con el borde de abajo dentado.
// Se pintan de atrás (arriba) hacia adelante (abajo): el de adelante tapa al de atrás y deja su contorno.
function paint(puffs, w, h, wrap) {
  const g = new Uint8Array(w * h)
  const set = (x, y, v) => { if (y < 0 || y >= h) return; if (wrap) x = ((x % w) + w) % w; else if (x < 0 || x >= w) return; g[y * w + x] = v }
  for (const [cx, cy, r] of [...puffs].sort((a, b) => a[1] - b[1])) {
    // Los copos tapados por arriba casi no reciben luz: quedan manchas sueltas sobre lo oscuro, no un racimo.
    const top = Math.floor(cy - r) - 1, tapado = top >= 0 && g[top * w + (((Math.floor(cx) % w) + w) % w)] > 0
    const k = tapado ? -0.75 + rand() * 0.75 : 0.05 + rand() * 0.2
    const jag = Array.from({ length: 2 * r + 5 }, () => (rand() < 0.22 ? 2 : Math.round(rand() * 2.2 - 1.3)))
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy)
        if (d > r) continue
        const lit = d < r - 1 && dy + dx * 0.45 < r * k + jag[x - Math.floor(cx - r)]
        set(x, y, lit ? 2 : 1)
      }
  }
  return g
}
const runs = (g, w, h, v) => {
  let d = ""
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (g[y * w + x] !== v) continue
      let e = x; while (e < w && g[y * w + e] === v) e++
      d += `M${x} ${y}h${e - x}v1h${x - e}z`; x = e
    }
  return d
}

// ---- Mar de nubes ----
const mar = [
  // loma de la izquierda
  [29, 100, 6], [38, 102, 5], [23, 105, 5], [32, 107, 7], [17, 109, 5], [44, 107, 6], [25, 111, 5], [51, 111, 5], [39, 112, 5],
  // lomita del medio
  [61, 107, 4], [67, 104, 5], [65, 111, 5], [74, 109, 5],
  // torre
  [97, 86, 6], [105, 83, 6], [111, 89, 5], [90, 91, 5], [101, 92, 7], [109, 95, 6], [91, 99, 5], [98, 101, 7], [86, 104, 6], [108, 104, 7], [94, 108, 7], [103, 110, 7], [114, 109, 5],
  // lomita de la derecha
  [121, 109, 4], [126, 107, 4], [131, 110, 4], [80, 112, 4], [7, 111, 5],
  // manchas en lo macizo de abajo
  [12, 118, 5], [30, 119, 6], [47, 118, 4], [58, 117, 5], [72, 119, 5], [88, 118, 6], [104, 119, 5], [119, 117, 5],
]
const BASE = 110 // desde acá hacia abajo es macizo: pisa la foto, que termina en 112
const g = paint(mar, N, N, true)
for (let y = BASE; y < N; y++) for (let x = 0; x < N; x++) if (!g[y * N + x]) g[y * N + x] = 1
// Los huecos de una o dos celdas entre copos se rellenan.
for (let x = 0; x < N; x++) for (let y = 100; y < BASE; y++) if (!g[y * N + x] && [1, 2, 3].some((k) => g[(y - k) * N + x]) ) g[y * N + x] = 1
// Comprobación: en todas las columnas la nube empieza dentro de la foto (celda 111 o antes) y no deja huecos hasta abajo.
for (let x = 0; x < N; x++) for (let y = 111; y < N; y++) if (!g[y * N + x]) throw new Error(`hueco en ${x},${y}`)

// ---- Nubes sueltas: copos apoyados en una base chata, con alas finas ----
function nube(puffs, w, base, alas) {
  const c = paint(puffs, w, base + 2, false)
  for (let x = 0; x < w; x++) { let y = 0; while (y < base && !c[y * w + x]) y++; for (; y < base; y++) if (!c[y * w + x]) c[y * w + x] = 1 }
  for (let x = alas[0]; x < alas[1]; x++) c[base * w + x] = 1
  for (let x = alas[2]; x < alas[3]; x++) c[(base + 1) * w + x] = 1
  for (let x = 0; x < w; x++) for (let y = base + 1; y < base + 2; y++) if (!(x >= alas[2] && x < alas[3])) c[y * w + x] = 0
  return c
}
const n1 = nube([[12, 6, 5], [20, 8, 4], [6, 9, 3], [14, 9, 4]], 34, 11, [0, 32, 8, 18]), n1w = 34, n1h = 13
const n2 = nube([[14, 5, 4], [9, 8, 4], [18, 8, 4]], 26, 10, [1, 25, 6, 20]), n2w = 26, n2h = 12
const nubeD = (c, w, h) => `<path fill="${C.oscuro}" d="${runs(c, w, h, 1)}"/><path fill="${C.claro}" d="${runs(c, w, h, 2)}"/>`

// ---- Luna ----
const M = 15, luna = new Uint8Array(M * M)
for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
  const dx = x + 0.5 - M / 2, dy = y + 0.5 - M / 2, d = Math.hypot(dx, dy)
  if (d <= 7.3) luna[y * M + x] = d > 6.1 ? 1 : Math.hypot(dx + 1.8, dy + 1.8) > 6.2 ? 3 : 2
}
for (const [x, y] of [[4, 5], [5, 5], [4, 6], [8, 9], [9, 9], [9, 10], [8, 4]]) luna[y * M + x] = 3

// Pasos enteros de una celda, para que el pixel art no tiemble.
const pasos = (from, to) => Array.from({ length: Math.abs(to - from) }, (_, i) => `${from + i * Math.sign(to - from)} 0`).join(";")
const mover = (from, to, dur) => `<animateTransform attributeName="transform" type="translate" calcMode="discrete" dur="${dur}s" repeatCount="indefinite" values="${pasos(from, to)}"/>`

const estrella = (x, y, big, dur, begin) => {
  const d = big ? `<path fill="#827fd6" d="M${x + 2} ${y}h1v5h-1zM${x} ${y + 2}h5v1h-5z"/><path fill="#c9ccff" d="M${x + 2} ${y + 1}h1v3h-1zM${x + 1} ${y + 2}h3v1h-3z"/>`
    : `<path fill="#acb9c5" fill-opacity=".55" d="M${x + 1} ${y}h1v3h-1zM${x} ${y + 1}h3v1h-3z"/><path fill="#dfe8ee" d="M${x + 1} ${y + 1}h1v1h-1z"/>`
  return `<g>${d}<animate attributeName="opacity" calcMode="discrete" dur="${dur}s" begin="-${begin}s" repeatCount="indefinite" values="1;.75;.4;.15;.4;.75"/></g>`
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="256" height="256" shape-rendering="crispEdges"><defs>
<g id="mar"><path fill="${C.oscuro}" d="${runs(g, N, N, 1)}"/><path fill="${C.claro}" d="${runs(g, N, N, 2)}"/></g>
<g id="sueltas"><g transform="translate(12 76)">${nubeD(n1, n1w, n1h)}</g><g transform="translate(40 88)">${nubeD(n2, n2w, n2h)}</g></g></defs>
${estrella(50, 18, false, 3.52, 0.6)}${estrella(19, 47, false, 2.64, 1.7)}${estrella(107, 30, false, 5.28, 3.1)}${estrella(94, 45, true, 3.52, 2.2)}${estrella(73, 25, false, 2.64, 0.2)}
<g transform="translate(13 12)"><path fill="${C.borde}" d="${runs(luna, M, M, 1)}"/><path fill="${C.luna}" d="${runs(luna, M, M, 2)}"/><path fill="${C.lunaSombra}" d="${runs(luna, M, M, 3)}"/></g>
<g><use href="#sueltas"/><use href="#sueltas" x="-${N}"/>${mover(0, N, DUR)}</g>
<g><use href="#mar"/><use href="#mar" x="-${N}"/>${mover(0, N, DUR / 2)}</g>
</svg>
`
writeFileSync(out, svg)
console.log(`${out}: ${(svg.length / 1024).toFixed(1)} KB`)
