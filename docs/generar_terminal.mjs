// Marco "Terminal" (inspirado en 9.gif / 9.png, 2026-11-24): un monitor viejo de fósforo verde; la foto es la pantalla.
// Uso: node docs/generar_terminal.mjs marco.svg
// El velo sale de medir 9.png (el GIF pierde la transparencia parcial): rgb(0,68,5) con líneas que alternan entre
// el 11 % y el 38 % de opacidad y una franja de rgb(0,85,5) que baja la pantalla en 3,96 s.
import { writeFileSync } from "node:fs"

const out = process.argv[2]
if (!out) throw new Error("uso: node docs/generar_terminal.mjs marco.svg")

const X = 34.5, Y = 34.5, W = 187, H = 172, R = 12 // hueco de la pantalla: pisa la foto (32 a 224, radio 15,4)
const DUR = 3.96, PASO = 2.29
const n = (v) => +v.toFixed(2)

// Comprobación: el hueco entero queda dentro de la foto, también en las esquinas.
const cx = 32 + 15.36 - (X + R), d = Math.hypot(cx, 32 + 15.36 - (Y + R))
if (X < 32.5 || Y < 32.5 || X + W > 223.5 || Y + H > 223.5 || d + R > 15.36) throw new Error("el hueco se sale de la foto")

let lines = ""
for (let y = Y; y < Y + H - 0.5; y += PASO) lines += `M${X} ${n(y)}h${W}v1.15h-${W}z`
const slots = (x, w) => [0, 1, 2, 3, 4].map((i) => {
  const y = 213.5 + i * 4.6
  return `<rect x="${x}" y="${y}" width="${w}" height="2.2" rx=".9" fill="#070c0e"/><rect x="${x}" y="${n(y + 2.3)}" width="${w}" height=".7" rx=".35" fill="#35443f" opacity=".75"/>`
}).join("")

const rr = (x, y, w, h, r) => `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`
const hole = rr(X, Y, W, H, R)

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><defs>
<linearGradient id="crema" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0dfbd"/><stop offset=".12" stop-color="#e7d5b3"/><stop offset=".72" stop-color="#e0cca8"/><stop offset=".9" stop-color="#a8967b"/><stop offset="1" stop-color="#7d6f5c"/></linearGradient>
<linearGradient id="caja" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b4a42"/><stop offset=".08" stop-color="#424b41"/><stop offset=".4" stop-color="#2a3730"/><stop offset=".75" stop-color="#1a2624"/><stop offset=".86" stop-color="#161f21"/><stop offset="1" stop-color="#12171c"/></linearGradient>
<linearGradient id="brillo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff1d0" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="franja" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#006e14" stop-opacity="0"/><stop offset=".55" stop-color="#067a1c" stop-opacity=".3"/><stop offset=".78" stop-color="#12962c" stop-opacity=".42"/><stop offset="1" stop-color="#006e14" stop-opacity="0"/></linearGradient>
<radialGradient id="halo"><stop offset="0" stop-color="#1f8a3a" stop-opacity=".3"/><stop offset="1" stop-color="#1f8a3a" stop-opacity="0"/></radialGradient>
<clipPath id="pantalla"><path d="${hole}"/></clipPath>
<filter id="suave" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>
<path fill="url(#crema)" fill-rule="evenodd" d="${rr(1, 1, 254, 254, 15)}${hole}"/>
<path fill="none" stroke="#fff6df" stroke-opacity=".7" stroke-width="1" d="${rr(1.6, 1.6, 252.8, 252.8, 14.5)}"/>
<path fill="#0b1012" fill-opacity=".45" fill-rule="evenodd" d="${rr(4.6, 4.2, 246.8, 248, 14)}${hole}"/>
<path fill="url(#caja)" fill-rule="evenodd" d="${rr(5.6, 5.2, 244.8, 246, 13)}${hole}"/>
<rect x="18" y="8" width="220" height="9" rx="4.5" fill="url(#brillo)"/>
<path fill="none" stroke="#0a0f10" stroke-opacity=".7" stroke-width="5" d="${rr(X - 2.2, Y - 2.2, W + 4.4, H + 4.4, R + 2.2)}"/>
<path fill="none" stroke="#5d6b5e" stroke-opacity=".4" stroke-width=".8" d="${rr(X - 5, Y - 5, W + 10, H + 10, R + 5)}"/>
<ellipse cx="128" cy="212" rx="92" ry="12" fill="url(#halo)"/>
${slots(35, 82)}${slots(139, 82)}
<path d="M6 242.5h244" stroke="#05080b" stroke-width="1.8"/><path d="M6 244.2h244" stroke="#333d40" stroke-width=".8" opacity=".8"/>
<g clip-path="url(#pantalla)"><path fill="#004405" fill-opacity=".13" d="${hole}"/><path fill="#004405" fill-opacity=".31" d="${lines}"/>
<rect x="${X}" y="${Y - 20}" width="${W}" height="20" fill="url(#franja)"><animate attributeName="y" from="${Y - 20}" to="${Y + H}" dur="${DUR}s" repeatCount="indefinite"/></rect>
<path fill="none" stroke="#0a5c1c" stroke-opacity=".8" stroke-width="4" filter="url(#suave)" d="${hole}"/></g>
</svg>
`
writeFileSync(out, svg)
console.log(`${out}: ${(svg.length / 1024).toFixed(1)} KB`)
