// Uso: node docs/generar_polaroid.mjs textura.png carpeta_salida [cuadros=40] [semilla=4]
// Marco "Polaroid" (inspiración 4.png, diseño propio): fotos instantáneas viejas apiladas, un clip y una cinta, y sobre
// la foto un velo de película vieja animado (sepia, parpadeo, fuga de luz, rayas, polvo y grano).
// El papel sale de una textura (flux) recortada con las formas exactas de la web: la ventana de la Polaroid de adelante
// pisa la foto 2 px (foto: 12,5 %, radio 8 %) y su margen ancho va debajo de la foto, sin taparla (Daniel, 2026-11-23).
// Escribe carpeta/c_001.png… a 256 px (dibuja a 512 y achica) para armar el WebP con libwebp_anim.
import { mkdirSync } from "node:fs"
import { readPng, writePng } from "./png_rgba.mjs"

const [texPath, out, cuadrosArg, semArg] = process.argv.slice(2)
if (!texPath || !out) throw new Error("uso: node docs/generar_polaroid.mjs textura.png carpeta [cuadros] [semilla]")
const CUADROS = +(cuadrosArg ?? 40)
let s = +(semArg ?? 4)
const azar = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
mkdirSync(out, { recursive: true })

const W = 512, F = 256 // se dibuja a 512 y se achica a 256
const tex = readPng(texPath)
const muestra = (x, y) => { // textura con repetición (en espejo, sin costuras)
  const m = (v, n) => { v = ((v % (2 * n)) + 2 * n) % (2 * n); return v < n ? v : 2 * n - 1 - v }
  const i = (m(Math.round(y), tex.h) * tex.w + m(Math.round(x), tex.w)) * 4
  return [tex.px[i], tex.px[i + 1], tex.px[i + 2]]
}

// Formas: rectángulo redondeado (distancia con signo) y rotación alrededor del centro.
const rr = (x, y, x0, y0, x1, y1, r) => {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = (x1 - x0) / 2 - r, hy = (y1 - y0) / 2 - r
  const qx = Math.abs(x - cx) - hx, qy = Math.abs(y - cy) - hy
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}
const rot = (x, y, cx, cy, ang) => {
  const c = Math.cos(ang), sn = Math.sin(ang), dx = x - cx, dy = y - cy
  return [cx + dx * c + dy * sn, cy - dx * sn + dy * c]
}
const FOTO = [64, 64, 448, 448], RF = 0.08 * 384 // la foto en la web, a 512
const VENT = [66, 66, 446, 446], RV = RF - 2 // la ventana pisa la foto 2 px
const POL = [16, 12, 496, 504] // Polaroid de adelante: márgenes finos y el ancho abajo (87,5 % → 98 %)
const ATRAS = [[-0.07, -6, 4, 0.8], [0.05, 8, -2, 0.88]] // [giro, dx, dy, brillo] de las dos de atrás

// Capa fija: papel, sombras, clip y cinta (RGBA a 512).
const capa = new Float32Array(W * W * 4)
const sobre = (i, r, g, b, a) => { // "over" en flotante, alfa no premultiplicado
  const ad = capa[i + 3], ao = a + ad * (1 - a)
  if (ao <= 0) return
  capa[i] = (r * a + capa[i] * ad * (1 - a)) / ao; capa[i + 1] = (g * a + capa[i + 1] * ad * (1 - a)) / ao
  capa[i + 2] = (b * a + capa[i + 2] * ad * (1 - a)) / ao; capa[i + 3] = ao
}
const cobertura = (d) => Math.max(0, Math.min(1, 0.5 - d)) // antialias de 1 px sobre una distancia con signo

// Dentro de la ventana de adelante solo va el velo: ni el papel de atrás ni las sombras tapan la foto.
const fuera = (x, y) => 1 - cobertura(rr(x, y, ...VENT, RV))
const polaroid = (ang, dx, dy, brillo, conVentana) => {
  const cx = (POL[0] + POL[2]) / 2 + dx, cy = (POL[1] + POL[3]) / 2 + dy
  // sombra suave debajo
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const [u, v] = rot(x - 2, y - 3, cx, cy, ang)
    const d = rr(u - dx, v - dy, ...POL, 6)
    if (d < 8) sobre((y * W + x) * 4, 30, 20, 12, 0.28 * Math.max(0, Math.min(1, (8 - d) / 8)) * fuera(x, y))
  }
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const [u, v] = rot(x, y, cx, cy, ang), px0 = u - dx, py0 = v - dy
    const d = rr(px0, py0, ...POL, 5)
    let a = cobertura(d)
    a *= conVentana ? 1 - cobertura(rr(px0, py0, ...VENT, RV)) : fuera(x, y)
    if (a <= 0) continue
    let [r, g, b] = muestra(u * 1.6 + 300 * dx, v * 1.6 + 300 * dy)
    const borde = Math.max(0, Math.min(1, (-d) / 10)) // bordes gastados: más oscuros
    let k = brillo * (0.8 + 0.2 * borde)
    if (conVentana) { // sombra fina del lado de adentro, junto a la ventana
      const dv = rr(px0, py0, ...VENT, RV)
      if (dv > 0 && dv < 4) k *= 0.82 + 0.045 * dv
    }
    sobre((y * W + x) * 4, r * k, g * k, b * k, a)
  }
}
for (const [ang, dx, dy, br] of ATRAS) polaroid(ang, dx, dy, br, false)
polaroid(0, 0, 0, 1, true)

// Cinta: tira naranja translúcida en la esquina de arriba a la derecha, con los extremos cortados en zigzag.
{
  const cx = 428, cy = 76, ang = -0.75, L = 68, A = 20
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const [u, v] = rot(x, y, cx, cy, ang), du = u - cx, dv = v - cy
    const diente = 3 * Math.abs(((dv / 5) % 2 + 2) % 2 - 1) // zigzag en los extremos
    const d = Math.max(Math.abs(du) - (L - diente), Math.abs(dv) - A)
    const a = cobertura(d) * 0.72
    if (a > 0) { const [r] = muestra(u * 2, v * 2); const t = 0.9 + 0.1 * (r / 255); sobre((y * W + x) * 4, 236 * t, 156 * t, 72 * t, a) }
  }
}
// Clip: alambre rosado de dos vueltas, arriba a la izquierda, mitad sobre el papel y mitad afuera.
{
  const cx = 66, cy = 58, ang = 0.35
  const vuelta = (u, v, x0, y0, x1, y1, r) => Math.abs(rr(u, v, x0, y0, x1, y1, r))
  for (let y = 0; y < 140; y++) for (let x = 0; x < 160; x++) {
    const [u, v] = rot(x, y, cx, cy, ang)
    const d = Math.min(vuelta(u, v, cx - 13, cy - 44, cx + 13, cy + 40, 13), vuelta(u, v, cx - 7, cy - 30, cx + 7, cy + 30, 7))
    const i = (y * W + x) * 4
    if (d < 5) sobre(i, 140, 50, 60, cobertura(d - 4)) // contorno
    if (d < 3.4) sobre(i, 228, 120, 130, cobertura(d - 2.6))
    if (d < 1.2) sobre(i, 250, 190, 196, cobertura(d - 0.6) * 0.8) // brillo
  }
}

// Velo de película: sobre la ventana, igual que en 4.png (marrón cálido al 40 %, fuga de luz a la izquierda).
const enVentana = (x, y) => cobertura(rr(x, y, ...VENT, RV))
const rayas = Array.from({ length: 10 }, () => ({ x: 70 + azar() * 372, desde: Math.floor(azar() * CUADROS), dura: 1 + Math.floor(azar() * 3), claro: azar() < 0.7 }))
const motas = Array.from({ length: 70 }, () => ({ x: 70 + azar() * 372, y: 70 + azar() * 372, r: 0.8 + azar() * 1.8, cuadro: Math.floor(azar() * CUADROS), claro: azar() < 0.5 }))
const parpadeo = Array.from({ length: CUADROS }, () => azar())

for (let n = 0; n < CUADROS; n++) {
  const px = new Float32Array(capa)
  const fl = (parpadeo[n] - 0.5) * 0.05, fase = Math.sin((2 * Math.PI * n) / CUADROS) // la fuga respira una vez por ciclo
  const debajo = (i, r, g, b, a) => { // el velo va debajo del papel: solo donde el papel no tapa
    const ad = px[i + 3], aVelo = a * (1 - ad), ao = ad + aVelo
    if (aVelo <= 0) return
    px[i] = (px[i] * ad + r * aVelo) / ao; px[i + 1] = (px[i + 1] * ad + g * aVelo) / ao; px[i + 2] = (px[i + 2] * ad + b * aVelo) / ao; px[i + 3] = ao
  }
  const velo = new Float32Array(W * W * 4) // se arma aparte y después va debajo del papel
  const pon = (x, y, r, g, b, a) => { // "over" dentro del velo
    if (x < 0 || y < 0 || x >= W || y >= W || a <= 0) return
    const i = (y * W + x) * 4, ad = velo[i + 3], ao = a + ad * (1 - a)
    velo[i] = (r * a + velo[i] * ad * (1 - a)) / ao; velo[i + 1] = (g * a + velo[i + 1] * ad * (1 - a)) / ao
    velo[i + 2] = (b * a + velo[i + 2] * ad * (1 - a)) / ao; velo[i + 3] = ao
  }
  for (let y = 60; y < 452; y++) for (let x = 60; x < 452; x++) {
    const w = enVentana(x, y); if (!w) continue
    const fuga = Math.max(0, 1 - (x - 66) / 110) * (0.75 + 0.25 * fase) // fuga de luz rojiza desde la izquierda
    const grano = (azar() - 0.5) * 0.06
    pon(x, y, 125 + fl * 200, 100 + fl * 160, 80 + fl * 120, (0.4 + fl + grano) * w)
    if (fuga > 0) pon(x, y, 182, 130, 95, 0.42 * fuga * w)
  }
  for (const r of rayas) if (((n - r.desde + CUADROS) % CUADROS) < r.dura) {
    const xx = r.x + (azar() - 0.5) * 6
    for (let y = 66; y < 446; y++) { const a = 0.35 * (0.6 + 0.4 * Math.sin(y / 9 + r.x)) * enVentana(xx, y); pon(Math.round(xx), y, r.claro ? 235 : 40, r.claro ? 222 : 30, r.claro ? 200 : 20, a) }
  }
  for (const m of motas) if (m.cuadro === n || m.cuadro === (n + 1) % CUADROS) {
    for (let y = Math.floor(m.y - 3); y <= m.y + 3; y++) for (let x = Math.floor(m.x - 3); x <= m.x + 3; x++) {
      const a = 0.6 * cobertura(Math.hypot(x + 0.5 - m.x, y + 0.5 - m.y) - m.r) * enVentana(x, y)
      pon(x, y, m.claro ? 240 : 30, m.claro ? 230 : 22, m.claro ? 210 : 15, a)
    }
  }
  for (let i = 0; i < W * W * 4; i += 4) if (velo[i + 3] > 0) debajo(i, velo[i], velo[i + 1], velo[i + 2], velo[i + 3])
  // achica 2:1 (promedio de 4 píxeles, ponderado por alfa) y escribe
  const o = Buffer.alloc(F * F * 4)
  for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) {
    let r = 0, g = 0, b = 0, a = 0
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const i = ((2 * y + dy) * W + 2 * x + dx) * 4, aa = px[i + 3]; r += px[i] * aa; g += px[i + 1] * aa; b += px[i + 2] * aa; a += aa }
    const j = (y * F + x) * 4
    if (a > 0) { o[j] = Math.round(r / a); o[j + 1] = Math.round(g / a); o[j + 2] = Math.round(b / a) }
    o[j + 3] = Math.round((a / 4) * 255)
  }
  writePng(`${out}/c_${String(n + 1).padStart(3, "0")}.png`, F, F, o)
}
// Comprobación: el centro de la foto queda cubierto solo por el velo (~40 %), las esquinas del lienzo transparentes y
// el margen de abajo (debajo de la foto) opaco.
{
  const { px } = readPng(`${out}/c_001.png`), al = (x, y) => px[(y * F + x) * 4 + 3] / 255
  const centro = al(160, 128), esquina = al(1, 1), margen = al(128, 238)
  console.log(`velo en el centro ${centro.toFixed(2)}, esquina ${esquina.toFixed(2)}, margen de abajo ${margen.toFixed(2)}`)
  if (centro < 0.3 || centro > 0.55 || esquina > 0.05 || margen < 0.95) throw new Error("la composición no quedó como se esperaba")
}
console.log(`polaroid: ${CUADROS} cuadros en ${out}`)
