// Copos que caen sobre la foto de un marco animado, cuadro por cuadro (como 1.png de inspiraciones: puntos blancos
// translúcidos y algún copo con forma). Bucle exacto: cada copo baja un número entero de veces el alto de la foto por
// ciclo y vuelve a entrar arriba; aparece y se apaga cerca de los bordes, así no salta.
// Uso: node docs/copos_marco.mjs carpeta_entrada carpeta_salida [cantidad=14] [semilla=7]
// Los cuadros son PNG RGBA cuadrados (c_001.png…), del tamaño final (ej. 256).
import { readdirSync, mkdirSync } from "node:fs"
import { readPng, writePng } from "./png_rgba.mjs"

const [src, out, cantArg, semArg] = process.argv.slice(2)
if (!src || !out) throw new Error("uso: node docs/copos_marco.mjs carpeta_entrada carpeta_salida [cantidad] [semilla]")
const archivos = readdirSync(src).filter((f) => f.endsWith(".png")).sort()
const N = archivos.length, cantidad = +(cantArg ?? 14)
let s = +(semArg ?? 7)
const azar = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
mkdirSync(out, { recursive: true })

const { w } = readPng(`${src}/${archivos[0]}`)
const x0 = w * 0.135, x1 = w * 0.865, y0 = w * 0.125, y1 = w * 0.875, alto = y1 - y0, borde = w * 0.06 // zona de la foto
const copos = Array.from({ length: cantidad }, (_, k) => ({
  x: x0 + azar() * (x1 - x0), fase: azar(), vueltas: azar() < 0.7 ? 1 : 2, // bajadas completas por ciclo
  r: w * (0.005 + azar() * 0.009), opacidad: 0.55 + azar() * 0.35,
  vaiven: w * (0.004 + azar() * 0.01), ondas: 1 + Math.floor(azar() * 2), // vaivén con un número entero de ondas
  forma: k < 2, // los dos primeros son copos con forma (asterisco de 3 trazos)
}))
const pos = (c, t) => { // t en [0, 1): posición del copo y cuánto se ve (aparece y se apaga en los bordes)
  const y = y0 + ((c.fase + t * c.vueltas) % 1) * alto
  const x = c.x + Math.sin(2 * Math.PI * (c.ondas * t + c.fase)) * c.vaiven
  return { x, y, ver: Math.min(1, (y - y0) / borde, (y1 - y) / borde) }
}
// Bucle exacto: en t = 1 cada copo vuelve a donde estaba en t = 0.
for (const c of copos) { const a = pos(c, 0), b = pos(c, 1); if (Math.hypot(a.x - b.x, a.y - b.y) > 0.01) throw new Error("el copo no cierra el bucle") }

const pintar = (px, x, y, a, rgb) => { // "over" de un píxel
  if (a <= 0 || x < 0 || y < 0 || x >= w || y >= w) return
  const i = (y * w + x) * 4, ad = px[i + 3] / 255, ao = a + ad * (1 - a)
  for (let k = 0; k < 3; k++) px[i + k] = Math.round((rgb[k] * a + px[i + k] * ad * (1 - a)) / ao)
  px[i + 3] = Math.round(ao * 255)
}
const BLANCO = [255, 255, 255], CELESTE = [150, 190, 235]
const segmento = (px, cx, cy, ang, largo, ancho, a, rgb) => {
  const dx = Math.cos(ang), dy = Math.sin(ang)
  for (let y = Math.floor(cy - largo - 2); y <= cy + largo + 2; y++) for (let x = Math.floor(cx - largo - 2); x <= cx + largo + 2; x++) {
    const px0 = x + 0.5 - cx, py0 = y + 0.5 - cy, t = Math.max(-largo, Math.min(largo, px0 * dx + py0 * dy))
    const d = Math.hypot(px0 - t * dx, py0 - t * dy)
    pintar(px, x, y, a * Math.max(0, Math.min(1, ancho + 0.5 - d)), rgb)
  }
}
archivos.forEach((f, n) => {
  const { w: ww, h, px } = readPng(`${src}/${f}`)
  for (const c of copos) {
    const { x, y, ver } = pos(c, n / N), a = c.opacidad * Math.max(0, ver)
    if (a <= 0) continue
    if (c.forma) {
      for (let k = 0; k < 3; k++) segmento(px, x, y, (k * Math.PI) / 3 + c.fase, c.r * 2.6, 0.9, a * 0.6, CELESTE)
      for (let k = 0; k < 3; k++) segmento(px, x, y, (k * Math.PI) / 3 + c.fase, c.r * 2.4, 0.45, a, BLANCO)
      continue
    }
    const R = c.r + 1.5
    for (let yy = Math.floor(y - R); yy <= y + R; yy++) for (let xx = Math.floor(x - R); xx <= x + R; xx++) {
      const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y)
      pintar(px, xx, yy, a * 0.6 * Math.max(0, Math.min(1, c.r + 1 - d)), CELESTE) // contorno suave, para fotos claras
      pintar(px, xx, yy, a * Math.max(0, Math.min(1, c.r + 0.5 - d)), BLANCO)
    }
  }
  writePng(`${out}/${f}`, ww, h, px)
})
console.log(`copos: ${cantidad} en ${N} cuadros`)
