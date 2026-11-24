// Recorta un personaje sobre un fondo claro liso o en degradé: relleno desde los bordes que avanza mientras el color
// cambia poco entre vecinos (sigue el degradé) y se frena en los contornos. Uso: node docs/recortar_personaje.mjs entrada salida [paso] [claro]
import { readPng, writePng } from "./png_rgba.mjs"

const [src, out, pasoArg, claroArg] = process.argv.slice(2)
const PASO = +(pasoArg ?? 7), CLARO = +(claroArg ?? 170) // diferencia máxima entre vecinos; brillo mínimo del fondo
const { w, h, px } = readPng(src)
const fondo = new Uint8Array(w * h)
const luz = (i) => Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])
const dif = (a, b) => Math.max(...[0, 1, 2].map((k) => Math.abs(px[a * 4 + k] - px[b * 4 + k])))
const cola = []
for (let x = 0; x < w; x++) cola.push(x, (h - 1) * w + x)
for (let y = 0; y < h; y++) cola.push(y * w, y * w + w - 1)
for (const i of cola) fondo[i] = luz(i) >= CLARO ? 1 : 0
const pila = cola.filter((i) => fondo[i])
while (pila.length) {
  const i = pila.pop(), x = i % w, y = (i / w) | 0
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
    const j = ny * w + nx
    if (!fondo[j] && luz(j) >= CLARO && dif(i, j) <= PASO) { fondo[j] = 1; pila.push(j) }
  }
}
// Apertura de R px: borra los trazos sueltos más finos que 2R+1 (un arco del fondo pegado al pelo, el contorno de un
// lazo hueco). Los contornos pegados al relleno sobreviven porque la ventana entra contra el relleno.
const R = 3
const caja = (src, keep) => { // keep(v) sobre la ventana: mínimo (erosión) o máximo (dilatación), separable
  const tmp = new Uint8Array(w * h), dst = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = keep ? 1 : 0; for (let d = -R; d <= R; d++) { const xx = Math.min(w - 1, Math.max(0, x + d)); v = keep ? v & src[y * w + xx] : v | src[y * w + xx] } tmp[y * w + x] = v }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = keep ? 1 : 0; for (let d = -R; d <= R; d++) { const yy = Math.min(h - 1, Math.max(0, y + d)); v = keep ? v & tmp[yy * w + x] : v | tmp[yy * w + x] } dst[y * w + x] = v }
  return dst
}
// Manchas sueltas (ruido del fondo que el relleno no alcanzó): todo grupo opaco de menos de MIN píxeles pasa a fondo.
// También los restos sueltos del fondo (un arco de contorno, un montón de nieve aparte): menos del 3 % del grupo mayor.
const MIN = 400
const limpiar = (proporcion) => {
  const visto = new Uint8Array(w * h), grupos = []
  for (let s = 0; s < w * h; s++) {
    if (fondo[s] || visto[s]) continue
    const grupo = [s]; visto[s] = 1
    for (let k = 0; k < grupo.length; k++) {
      const i = grupo[k], x = i % w, y = (i / w) | 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, j = ny * w + nx
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && !fondo[j] && !visto[j]) { visto[j] = 1; grupo.push(j) }
      }
    }
    grupos.push(grupo)
  }
  const mayor = Math.max(...grupos.map((g) => g.length))
  for (const g of grupos) if (g.length < Math.max(MIN, mayor * proporcion)) for (const i of g) fondo[i] = 1
}
limpiar(0.03)
// La apertura va después del filtro de grupos: si fuera antes, separaría piezas unidas por un cuello fino (el pompón del
// gorro) y el filtro las borraría como restos sueltos. Después, una pasada solo con MIN quita los puntos que dejó.
const solido = fondo.map((f) => 1 - f), abierto = caja(caja(solido, true), false)
for (let i = 0; i < w * h; i++) if (!abierto[i]) fondo[i] = 1
limpiar(0)
let x0 = w, y0 = h, x1 = 0, y1 = 0
for (let i = 0; i < w * h; i++) if (!fondo[i]) { const x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
console.log(`caja del personaje: x ${x0}-${x1}, y ${y0}-${y1}`)
// Borde suave: un píxel del dibujo pegado al fondo queda a media opacidad.
for (let i = 0; i < w * h; i++) {
  if (fondo[i]) { px[i * 4 + 3] = 0; continue }
  const x = i % w, y = (i / w) | 0
  const vecinos = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => fondo[(y + dy) * w + x + dx]).length
  if (vecinos) px[i * 4 + 3] = 255 - vecinos * 50
}
const transparente = fondo.reduce((a, b) => a + b, 0) / (w * h)
console.log(`fondo transparente: ${(transparente * 100).toFixed(1)} %`)
if (transparente < 0.2 || transparente > 0.9) throw new Error("el relleno no separó el fondo: revisar PASO y CLARO")
writePng(out, w, h, px)
