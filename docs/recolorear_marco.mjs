// Cambia la paleta de un marco ya recortado (PNG RGBA): lleva un rango de tonos a otro, sin tocar la transparencia,
// el brillo ni la saturación. Sirve para marcos de una sola familia de color (ver la guía de arte, Fase 5).
// Uso: node docs/recolorear_marco.mjs <de>:<de> <a>:<a> entrada.png|carpeta salida.png|carpeta
//   Tonos en grados (0 rojo, 30 naranja, 60 amarillo, 120 verde, 195 celeste, 225 azul, 300 magenta).
//   El primer tono de origen va al primero de destino: 225:195 0:40 lleva el azul a rojo y el celeste a naranja.
import { readdirSync, mkdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { readPng, writePng } from "./png_rgba.mjs"

const [from, to, src, out] = process.argv.slice(2)
if (!out) throw new Error("uso: node docs/recolorear_marco.mjs 225:195 0:40 entrada salida")
const [f0, f1] = from.split(":").map(Number), [t0, t1] = to.split(":").map(Number)

// Distancia con signo entre tonos, por el camino corto (-180..180).
const delta = (a, b) => ((b - a + 540) % 360) - 180
function mapHue(h) {
  const span = delta(f0, f1), t = Math.min(1, Math.max(0, delta(f0, h) / span))
  return (t0 + t * delta(t0, t1) + 360) % 360
}

function recolor(inPath, outPath) {
  const { w, h, px } = readPng(inPath)
  for (let i = 0; i < w * h * 4; i += 4) {
    if (!px[i + 3]) continue
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min
    if (!c) continue // gris: sin tono que cambiar
    const hue = 60 * (max === r ? ((g - b) / c + 6) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4)
    const nh = mapHue(hue) / 60, x = c * (1 - Math.abs((nh % 2) - 1)), m = max - c
    const [rr, gg, bb] = nh < 1 ? [c, x, 0] : nh < 2 ? [x, c, 0] : nh < 3 ? [0, c, x] : nh < 4 ? [0, x, c] : nh < 5 ? [x, 0, c] : [c, 0, x]
    px[i] = Math.round((rr + m) * 255); px[i + 1] = Math.round((gg + m) * 255); px[i + 2] = Math.round((bb + m) * 255)
  }
  writePng(outPath, w, h, px)
}

// Comprobación del mapeo: los extremos y el medio del rango.
const near = (a, b) => Math.abs(delta(a, b)) < 0.01
if (!near(mapHue(f0), t0) || !near(mapHue(f1), t1) || !near(mapHue(f0 + delta(f0, f1) / 2), (t0 + delta(t0, t1) / 2 + 360) % 360))
  throw new Error("el mapeo de tonos no da los extremos pedidos")

if (statSync(src).isDirectory()) {
  mkdirSync(out, { recursive: true })
  for (const f of readdirSync(src).filter((n) => n.endsWith(".png"))) recolor(join(src, f), join(out, f))
} else recolor(src, out)
