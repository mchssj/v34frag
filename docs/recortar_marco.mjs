// Recorta un marco generado sobre fondo blanco: vuelve transparente el blanco conectado con los bordes y con el
// centro, con borde suave. Sin dependencias (zlib de Node, vía png_rgba.mjs). Uso: node docs/recortar_marco.mjs entrada.png salida.png
// La entrada es PNG RGBA de 8 bits; un WebP se convierte antes (ver la guía de arte, Fase 3).
import { readPng, writePng } from "./png_rgba.mjs"

const args = process.argv.slice(2), black = args.includes("--fondo-negro"), glow = black || args.includes("--brillo")
const [src, out] = args.filter((a) => !a.startsWith("--"))
if (!src || !out) throw new Error("uso: node docs/recortar_marco.mjs [--brillo | --fondo-negro] entrada.png salida.png")
const { w, h, px } = readPng(src)
const FILL = 60, LO = 12, HI = 60 // distancia al blanco: hasta FILL entra al relleno; el alfa sube de LO a HI
const dist = (i) => 255 - Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])
// Quita el blanco mezclado para que no quede un halo claro sobre fondos oscuros.
const unmix = (i, a) => {
  for (let k = 0; k < 3; k++) px[i * 4 + k] = a ? Math.round(Math.min(255, Math.max(0, (px[i * 4 + k] - 255 * (1 - a)) / a))) : 0
  px[i * 4 + 3] = Math.round(a * 255)
}
const share = (x0, y0, x1, y1, ok) => {
  let n = 0, hit = 0
  for (let y = (y0 * h) | 0; y < y1 * h; y++) for (let x = (x0 * w) | 0; x < x1 * w; x++) { n++; if (ok(px[(y * w + x) * 4 + 3])) hit++ }
  return hit / n
}

if (glow) {
  // --brillo: cada píxel pierde opacidad según qué tan blanco es ("color a alfa"). Para brillos y degradados que se
  // apagan de a poco; el relleno de abajo los deja como una niebla blanca. Los reflejos blancos también se vuelven
  // transparentes. Lo casi blanco (hasta LO) queda transparente del todo: el ruido del fondo, que en un video cambia en
  // cada cuadro y no deja comprimir la animación.
  // --fondo-negro: lo mismo al revés, para diseños claros o luminosos (fuego, neón, magia) generados sobre negro. La
  // opacidad sale del canal más brillante y el color se separa del negro dividiendo por ella: los núcleos casi blancos
  // quedan opacos y lo oscuro (también un personaje oscuro) se vuelve transparente.
  if (black)
    for (let i = 0; i < w * h; i++) {
      const o = i * 4, a = Math.max(0, Math.max(px[o], px[o + 1], px[o + 2]) - LO) / (255 - LO)
      for (let k = 0; k < 3; k++) px[o + k] = a ? Math.round(Math.min(255, px[o + k] / a)) : 0
      px[o + 3] = Math.round(a * 255)
    }
  else for (let i = 0; i < w * h; i++) unmix(i, Math.max(0, dist(i) - LO) / (255 - LO))
  const center = share(0.3, 0.3, 0.7, 0.7, (a) => a < 10), corner = share(0, 0, 0.02, 0.02, (a) => a < 10)
  console.log(`centro transparente ${(center * 100).toFixed(1)}%, esquina ${(corner * 100).toFixed(1)}%`)
  if (center < 0.9 || corner < 0.98) throw new Error(`el recorte no quedó como se esperaba: revisar que el centro y el fondo sean ${black ? "negros" : "blancos"}`)
  writePng(out, w, h, px)
  process.exit(0)
}

const bg = new Uint8Array(w * h), queue = []
const seed = (x, y) => { const i = y * w + x; if (!bg[i] && dist(i) < FILL) { bg[i] = 1; queue.push(i) } }
for (let k = 0; k < w; k++) { seed(k, 0); seed(k, h - 1) }
for (let k = 0; k < h; k++) { seed(0, k); seed(w - 1, k) }
seed(w >> 1, h >> 1)
while (queue.length) {
  const i = queue.pop(), x = i % w, y = (i / w) | 0
  if (x) seed(x - 1, y); if (x < w - 1) seed(x + 1, y); if (y) seed(x, y - 1); if (y < h - 1) seed(x, y + 1)
}

for (let i = 0; i < w * h; i++) {
  if (!bg[i]) continue
  const t = Math.min(1, Math.max(0, (dist(i) - LO) / (HI - LO)))
  unmix(i, t * t * (3 - 2 * t))
}

// Comprobación: el centro y la esquina exterior quedan transparentes; la franja del marco, con diseño.
const center = share(0.3, 0.3, 0.7, 0.7, (a) => a < 10), corner = share(0, 0, 0.02, 0.02, (a) => a < 10)
const band = share(0.04, 0.3, 0.11, 0.7, (a) => a > 245)
console.log(`centro transparente ${(center * 100).toFixed(1)}%, esquina ${(corner * 100).toFixed(1)}%, franja opaca ${(band * 100).toFixed(1)}%`)
// La franja solo tiene que tener algo de diseño: un boceto de trazos sueltos ronda el 20 %; un marco borrado, 0 %.
if (center < 0.98 || corner < 0.98 || band < 0.05) throw new Error("el recorte no quedó como se esperaba: revisar que el centro y el fondo sean blancos")
writePng(out, w, h, px)
