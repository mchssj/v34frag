// Uso: node docs/generar_codigo.mjs salida.svg [semilla=11]
// Marco "Código" (boceto aprobado el 2026-11-20): franja verde oscura con lluvia de caracteres cayendo por todo el
// borde, estilo terminal. SVG estático: el SVG cargado como imagen no ejecuta scripts ni carga fuentes externas, así que
// los caracteres son ASCII (sin katakana, que en algunas computadoras sale como cuadrados) en monoespaciada genérica.
import { writeFileSync } from "node:fs"

const [out, seedArg = "11"] = process.argv.slice(2)
if (!out) throw new Error("uso: node docs/generar_codigo.mjs salida.svg [semilla]")
let s = Number(seedArg) >>> 0 || 1
const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) // misma semilla, mismo SVG
const CH = "0123456789ABCDEFXZ<>/#$%&*+=:;"
const STEP = 9 // separación vertical entre caracteres
const esc = (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c

// Una columna: el mismo texto dos veces seguido, que baja una vuelta y empieza de nuevo sin salto. La degradación
// (cola apagada, cabeza clara) es un degradado que se repite cada `len` caracteres y se mueve con el texto.
let n = 0
function column(x, y0, len, dur) {
  const chars = Array.from({ length: len }, () => CH[Math.floor(rand() * CH.length)])
  const text = [...chars, ...chars].map(esc).join("")
  // Una x y una y por carácter: con una sola x, cada carácter avanza a la derecha del anterior.
  const ys = Array.from({ length: len * 2 }, (_, i) => y0 + i * STEP).join(" ")
  const xs = Array(len * 2).fill(x).join(" ")
  const id = `c${n++}`, L = len * STEP
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${y0 - STEP}" x2="0" y2="${y0 - STEP + L}" spreadMethod="repeat">
      <stop offset="0" stop-color="#2bd96a" stop-opacity=".15"/><stop offset=".9" stop-color="#2bd96a"/><stop offset=".97" stop-color="#d6ffe4"/><stop offset="1" stop-color="#2bd96a" stop-opacity=".15"/>
    </linearGradient>
    <g><text x="${xs}" y="${ys}" fill="url(#${id})">${text}</text>
      <animateTransform attributeName="transform" type="translate" values="0 ${-L};0 0" dur="${dur.toFixed(2)}s" repeatCount="indefinite"/></g>`
}

const cols = []
for (const x of [6, 15, 24, 234, 243]) cols.push(column(x, -20, 32, 2.2 + rand() * 1.8)) // costados: columnas largas
for (let x = 36; x < 222; x += 9) {
  cols.push(column(x, -20, 6, 1.6 + rand() * 1.6)) // arriba
  cols.push(column(x, 220, 6, 1.6 + rand() * 1.6)) // abajo
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <!-- Código: lluvia de caracteres verdes por todo el borde, estilo terminal. Generado con docs/generar_codigo.mjs
       (semilla ${seedArg}). -->
  <defs>
    <mask id="franja" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
      <rect width="256" height="256" fill="#fff"/><rect x="34" y="34" width="188" height="188" rx="14" fill="#000"/>
    </mask>
    <filter id="brillo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g mask="url(#franja)">
    <rect x="3" y="3" width="250" height="250" rx="14" fill="#03140a"/>
    <g font-family="ui-monospace, Consolas, 'Courier New', monospace" font-size="8.5" font-weight="700" text-anchor="middle">
    ${cols.join("\n    ")}
    </g>
  </g>
  <rect x="3" y="3" width="250" height="250" rx="14" fill="none" stroke="#1d7a40" stroke-width="2"/>
  <rect x="32.5" y="32.5" width="191" height="191" rx="15" fill="none" stroke="#2bd96a" stroke-width="2.5" filter="url(#brillo)"/>
</svg>
`
// Comprobación: cada columna tiene una x y una y por carácter (si no, se tuerce o el bucle salta).
let columnas = 0
for (const m of svg.matchAll(/<text x="([^"]+)" y="([^"]+)"[^>]*>([^<]*)<\/text>/g)) {
  const glyphs = m[3].replace(/&(lt|gt|amp);/g, "x").length
  if (m[1].split(" ").length !== glyphs || m[2].split(" ").length !== glyphs) throw new Error("una columna no tiene una posición por carácter")
  columnas++
}
if (columnas !== cols.length) throw new Error(`se esperaban ${cols.length} columnas y se encontraron ${columnas}`)
writeFileSync(out, svg)
console.log(`${out}: ${(svg.length / 1024).toFixed(1)} KB`)
