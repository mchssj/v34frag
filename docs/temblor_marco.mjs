// "Línea que tiembla" (boil): N copias de un marco ya recortado, cada una con una deformación suave y distinta de
// pocos píxeles, para alternarlas en bucle como un dibujo animado a mano. Sin costo de Replicate.
// Uso: node docs/temblor_marco.mjs entrada.png carpeta_salida [cuadros=4] [amplitud=0.004] [semilla=1]
//   amplitud: desplazamiento máximo como fracción del lado (0.004 = 2 px a 512).
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { readPng, writePng } from "./png_rgba.mjs"

const [src, out, n = "4", amp = "0.004", seed = "1"] = process.argv.slice(2)
if (!out) throw new Error("uso: node docs/temblor_marco.mjs entrada.png carpeta [cuadros] [amplitud] [semilla]")
const { w, h, px } = readPng(src)
const A = Number(amp) * w

let s = Number(seed) >>> 0 || 1
const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) // reproducible: misma semilla, mismos cuadros

// Campo de desplazamiento suave: suma de ondas de baja frecuencia (2 a 5 vueltas por lado) con fase al azar.
function field() {
  const waves = Array.from({ length: 4 }, () => ({
    fx: (2 + rand() * 3) * 2 * Math.PI / w, fy: (2 + rand() * 3) * 2 * Math.PI / h,
    px: rand() * 2 * Math.PI, py: rand() * 2 * Math.PI,
  }))
  return (x, y) => {
    let dx = 0, dy = 0
    for (const v of waves) { dx += Math.sin(y * v.fy + v.px) ; dy += Math.sin(x * v.fx + v.py) }
    return [(dx / waves.length) * A * 2, (dy / waves.length) * A * 2]
  }
}

// Muestreo bilineal con color premultiplicado, para que los bordes de la tinta no se ensucien.
function sample(x, y, o) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0
  let r = 0, g = 0, b = 0, a = 0
  for (const [xx, yy, wt] of [[x0, y0, (1 - fx) * (1 - fy)], [x0 + 1, y0, fx * (1 - fy)], [x0, y0 + 1, (1 - fx) * fy], [x0 + 1, y0 + 1, fx * fy]]) {
    if (xx < 0 || yy < 0 || xx >= w || yy >= h || !wt) continue
    const i = (yy * w + xx) * 4, al = px[i + 3] / 255
    r += px[i] * al * wt; g += px[i + 1] * al * wt; b += px[i + 2] * al * wt; a += al * wt
  }
  o[0] = a ? r / a : 0; o[1] = a ? g / a : 0; o[2] = a ? b / a : 0; o[3] = a * 255
}

const inkOf = (buf) => { let t = 0; for (let i = 3; i < buf.length; i += 4) t += buf[i]; return t }
const ink = inkOf(px)
mkdirSync(out, { recursive: true })
const tmp = [0, 0, 0, 0]
for (let k = 1; k <= Number(n); k++) {
  const f = field(), dst = Buffer.alloc(px.length)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [dx, dy] = f(x, y)
      sample(x + dx, y + dy, tmp)
      const i = (y * w + x) * 4
      for (let c = 0; c < 4; c++) dst[i + c] = Math.round(Math.min(255, Math.max(0, tmp[c])))
    }
  // Comprobación: la deformación mueve la tinta, no la agrega ni la borra (±5 %).
  const ratio = inkOf(dst) / ink
  if (Math.abs(ratio - 1) > 0.05) throw new Error(`el cuadro ${k} cambió la cantidad de tinta (${(ratio * 100).toFixed(1)} %)`)
  writePng(join(out, `c_${String(k).padStart(3, "0")}.png`), w, h, dst)
}
console.log(`${n} cuadros en ${out}, desplazamiento máximo ${A.toFixed(1)} px`)
