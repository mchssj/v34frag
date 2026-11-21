// Corta el hueco de la foto con la forma exacta de la web (cuadrado redondeado) en un marco pintado entero, sin
// recortar por color: sirve para cualquier diseño, también con fondo de color propio. Opcionalmente dibuja un contorno
// de color con brillo alrededor del hueco. Sin dependencias (png_rgba.mjs).
// Uso: node docs/hueco_marco.mjs entrada.png salida.png [color #rrggbb] [ancho en % del lado = 0.9]
//   Entrada y salida PNG RGBA de 8 bits (un PNG RGB se pasa antes con `ffmpeg -i x.png -vf format=rgba y.png`).
import { readPng, writePng } from "./png_rgba.mjs"

const [src, out, color, widthArg = "0.9"] = process.argv.slice(2)
if (!src || !out) throw new Error("uso: node docs/hueco_marco.mjs entrada.png salida.png [#color] [ancho %]")
const { w, h, px } = readPng(src)
if (w !== h) throw new Error(`el marco tiene que ser cuadrado (llegó ${w}x${h})`)

// La foto va de 12,5 % a 87,5 % con radio 8 % de su lado. El hueco es un poco más chico (13,3 %), así el marco pisa
// el borde de la foto y no queda espacio entre los dos.
const inset = 0.133 * w, half = w / 2 - inset, r = 0.08 * (w * 0.75)
// Distancia con signo al borde del cuadrado redondeado: negativa adentro del hueco, positiva afuera.
const sd = (x, y) => {
  const qx = Math.abs(x - w / 2) - (half - r), qy = Math.abs(y - h / 2) - (half - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}
const rgb = color ? [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) : null
const lw = (Number(widthArg) / 100) * w, glow = lw * 2.2

for (let y = 0; y < h; y++)
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, d = sd(x + 0.5, y + 0.5)
    if (rgb && d > -1 && d < lw + glow * 3) {
      // Contorno: el trazo sólido y un brillo que se apaga hacia afuera, mezclados sobre el diseño.
      const solid = Math.min(1, Math.max(0, Math.min(d + 1, lw - d + 0.5)))
      const g = d > lw ? Math.exp(-(d - lw) / glow) * 0.7 : 0
      const a = Math.max(solid, g)
      for (let k = 0; k < 3; k++) px[i + k] = Math.round(px[i + k] * (1 - a) + (solid ? 255 * 0.35 + rgb[k] * 0.65 : rgb[k]) * a)
    }
    // Hueco con borde suavizado de un píxel.
    px[i + 3] = Math.round(px[i + 3] * Math.min(1, Math.max(0, d + 0.5)))
  }

// Comprobación: el centro y el borde del hueco son transparentes; las esquinas de la imagen, opacas.
const alpha = (fx, fy) => px[((Math.floor(fy * h) * w + Math.floor(fx * w)) * 4) + 3]
if (alpha(0.5, 0.5) !== 0 || alpha(0.14, 0.5) !== 0 || alpha(0.5, 0.86) !== 0) throw new Error("el hueco no quedó transparente")
if (alpha(0.02, 0.02) < 250 || alpha(0.98, 0.98) < 250) throw new Error("las esquinas no quedaron opacas: ¿la entrada tiene transparencia?")
writePng(out, w, h, px)
console.log(`${out}: hueco cortado${rgb ? `, contorno ${color}` : ""}`)
