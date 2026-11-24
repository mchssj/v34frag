// Uso: node docs/generar_pintura.mjs salida.svg
// Marco "Pintura" (inspiración 6.png, diseño propio): una ventana de programa de dibujo de los 90 en rosa pastel. La foto
// es el lienzo; arriba van la barra de título y la de menú, a la izquierda las herramientas, a la derecha y abajo las
// barras de desplazamiento y abajo la paleta. Animación: la herramienta seleccionada salta de una a otra.
// Todo entra en el 12,5 % de cada borde. El lienzo blanco rellena las esquinas redondeadas de la foto: el marco la pisa
// 2 px en todo el contorno.
import { writeFileSync } from "node:fs"

const [out] = process.argv.slice(2)
if (!out) throw new Error("uso: node docs/generar_pintura.mjs salida.svg")

const C = { rosa: "#f7d9f5", claro: "#fff4fd", sombra: "#c79ad6", borde: "#8f62bd", tinta: "#6b4c8a", hundido: "#ecc3ec", lienzo: "#ffffff" }
const caja = (x, y, w, h, fill = C.rosa, hundida = false) => {
  const [a, b] = hundida ? [C.sombra, C.claro] : [C.claro, C.sombra] // biselado: claro arriba e izquierda, oscuro abajo y derecha
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/><path d="M${x} ${y + h}V${y}H${x + w}" fill="none" stroke="${a}"/><path d="M${x + w} ${y}V${y + h}H${x}" fill="none" stroke="${b}"/>`
}

// Iconos propios en una celda de 11 px (centro 0,0), trazos de 1 px.
const t = `fill="none" stroke="${C.tinta}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"`
const ICONOS = [
  `<path d="M-3 -2 0 -4 3 -1 1 3 -3 2Z" ${t} stroke-dasharray="1.5 1"/>`, // selección libre
  `<rect x="-3.5" y="-3.5" width="7" height="7" ${t} stroke-dasharray="1.5 1"/>`, // selección
  `<path d="M-4 1 0 -3 4 1 0 5Z" ${t}/><path d="M-2 3 2 -1" ${t}/>`, // goma
  `<path d="M-3 -1 1 -4 4 0 0 3Z" ${t}/><path d="M3 2q1 2 0 3" ${t}/>`, // balde
  `<path d="M-3 4 2 -1M1 -3l3 3M2 -4a1.5 1.5 0 0 1 2 2" ${t}/>`, // gotero
  `<circle cx="-1" cy="-1" r="2.6" ${t}/><path d="M1 1 4 4" ${t}/>`, // lupa
  `<path d="M-3 4 3 -2 4 -1 -2 5ZM-3 4 -4 5" ${t}/>`, // lápiz
  `<path d="M3 -4 -1 1" ${t}/><path d="M-1 1q-3 0 -3 4q3 0 3-3Z" fill="${C.tinta}" stroke="none"/>`, // pincel
  `<path d="M0 -3h2v5h-2z" ${t}/><circle cx="-3" cy="-2" r=".5" fill="${C.tinta}"/><circle cx="-4" cy="0" r=".5" fill="${C.tinta}"/><circle cx="-3" cy="2" r=".5" fill="${C.tinta}"/>`, // aerosol
  `<path d="M-3 4 0 -4 3 4M-2 1.5h4" ${t}/>`, // texto
  `<path d="M-4 4 4 -4" ${t}/>`, // línea
  `<path d="M-4 3q2-8 4-1t4-5" ${t}/>`, // curva
  `<rect x="-4" y="-3" width="8" height="6" ${t}/>`, // rectángulo
  `<path d="M-4 3-2-3 3-4 4 1 0 4Z" ${t}/>`, // polígono
  `<ellipse rx="4" ry="3" ${t}/>`, // elipse
  `<rect x="-4" y="-3" width="8" height="6" rx="2" ${t}/>`, // rectángulo redondeado
]
const COL = [6, 18], FILA0 = 33, PASO = 12.5, LADO = 11
const celda = (k) => [COL[k % 2], FILA0 + Math.floor(k / 2) * PASO]

// Animación: herramienta seleccionada (botón hundido), igual que en 6.png: salta cada ~1,4 s.
const SECUENCIA = [6, 10, 12, 14, 7], DUR = SECUENCIA.length * 1.4
const keyTimes = SECUENCIA.map((_, k) => (k / SECUENCIA.length).toFixed(3)).join(";")
const sel = (eje) => SECUENCIA.map((k) => celda(k)[eje]).join(";")
const seleccion = `<rect width="${LADO}" height="${LADO}" fill="${C.hundido}" x="${celda(SECUENCIA[0])[0]}" y="${celda(SECUENCIA[0])[1]}">
      <animate attributeName="x" calcMode="discrete" dur="${DUR}s" repeatCount="indefinite" keyTimes="${keyTimes}" values="${sel(0)}"/>
      <animate attributeName="y" calcMode="discrete" dur="${DUR}s" repeatCount="indefinite" keyTimes="${keyTimes}" values="${sel(1)}"/>
    </rect>
    <path d="M0 ${LADO}V0H${LADO}" fill="none" stroke="${C.sombra}" transform="translate(${celda(SECUENCIA[0]).join(" ")})">
      <animateTransform attributeName="transform" type="translate" calcMode="discrete" dur="${DUR}s" repeatCount="indefinite" keyTimes="${keyTimes}" values="${SECUENCIA.map((k) => celda(k).join(" ")).join(";")}"/>
    </path>`
const botones = ICONOS.map((ic, k) => {
  const [x, y] = celda(k)
  return `${caja(x, y, LADO, LADO)}`
}).join("")
const iconos = ICONOS.map((ic, k) => { const [x, y] = celda(k); return `<g transform="translate(${x + LADO / 2} ${y + LADO / 2})">${ic}</g>` }).join("")

// Paleta: 2 filas de 16 colores pastel, y el color actual a la izquierda.
const COLORES = ["#000000", "#8a8a9a", "#b0567c", "#e87fa8", "#f6b2c8", "#ffffff", "#7a6ad8", "#c58ae8", "#b5a0f0", "#9ad0f0", "#bde8f8", "#6aa0e0", "#e8a0d8", "#f0c0e0", "#ffd8b0", "#f8e8a0",
  "#505060", "#d0d0dc", "#7fd0c8", "#c070e0", "#e070b8", "#a070c0", "#f090c0", "#ffe0f0", "#e0b0b8", "#d8c0f0", "#a8b8f0", "#c8e8ff", "#b0f0e0", "#f8c8d8", "#e8d8ff", "#fff0c8"]
const paleta = COLORES.map((c, k) => {
  const x = 26 + (k % 16) * 14, y = 238 + Math.floor(k / 16) * 7.5
  return `<rect x="${x}" y="${y}" width="13" height="6.5" fill="${c}" stroke="${C.sombra}" stroke-width=".8"/>`
}).join("")

// Hueco de la foto: la foto de la web (32-224, radio 15,4) achicada 2 px.
const R = 13.4, H0 = 34, H1 = 222
const hueco = `M${H0 + R} ${H0}A${R} ${R} 0 0 0 ${H0} ${H0 + R}V${H1 - R}A${R} ${R} 0 0 0 ${H0 + R} ${H1}H${H1 - R}A${R} ${R} 0 0 0 ${H1} ${H1 - R}V${H0 + R}A${R} ${R} 0 0 0 ${H1 - R} ${H0}Z`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <!-- Pintura: ventana de programa de dibujo de los 90 en rosa pastel; la foto es el lienzo y la herramienta seleccionada
       salta de una a otra (inspiración 6.png, diseño propio, iconos propios). Generado con docs/generar_pintura.mjs. -->
  <defs>
    <linearGradient id="titulo" x1="0" x2="1"><stop offset="0" stop-color="#b98be6"/><stop offset="1" stop-color="#e8c4f4"/></linearGradient>
  </defs>
  <!-- ventana, con el hueco de la foto -->
  <path d="M1 1H255V255H1ZM${hueco.slice(1)}" fill="${C.rosa}" fill-rule="evenodd" stroke="${C.borde}" stroke-width="1.5"/>
  <path d="M3 253V3H253" fill="none" stroke="${C.claro}"/><path d="M253 3V253H3" fill="none" stroke="${C.sombra}"/>
  <!-- lienzo blanco alrededor de la foto (rellena sus esquinas) y su borde hundido -->
  <path d="M31 31H225V225H31Z${hueco}" fill="${C.lienzo}" fill-rule="evenodd"/>
  <path d="M30 226V30H226" fill="none" stroke="${C.sombra}" stroke-width="2"/><path d="M226 30V226H30" fill="none" stroke="${C.claro}"/>
  <!-- barra de título: icono propio (paleta de pintor) y los tres botones -->
  <rect x="4" y="4" width="248" height="12" fill="url(#titulo)"/>
  <g transform="translate(10 10)"><ellipse rx="4.5" ry="3.6" fill="#fff4fd" stroke="${C.tinta}" stroke-width=".8"/><circle cx="-1.8" cy="-1" r=".9" fill="#e070b8"/><circle cx=".6" cy="-1.6" r=".9" fill="#7a6ad8"/><circle cx="2.2" cy=".4" r=".9" fill="#7fd0c8"/></g>
  ${caja(221, 6, 9, 8)}<path d="M223 12h5" stroke="${C.tinta}"/>
  ${caja(231, 6, 9, 8)}<rect x="233" y="8" width="5" height="4" fill="none" stroke="${C.tinta}" stroke-width=".8"/>
  ${caja(242, 6, 9, 8)}<path d="M244 8l5 4M249 8l-5 4" stroke="${C.tinta}" stroke-width=".9"/>
  <!-- barra de menú: palabras como rayitas -->
  <g fill="${C.sombra}"><rect x="7" y="21" width="12" height="3" rx="1"/><rect x="24" y="21" width="14" height="3" rx="1"/><rect x="43" y="21" width="10" height="3" rx="1"/><rect x="58" y="21" width="16" height="3" rx="1"/><rect x="79" y="21" width="11" height="3" rx="1"/></g>
  <!-- herramientas -->
  ${botones}
  <g>
    ${seleccion}
  </g>
  ${iconos}
  ${caja(6, 135, 23, 50, C.rosa, true)}
  <!-- barras de desplazamiento -->
  ${caja(228, 32, 10, 192, C.hundido, true)}${caja(228, 32, 10, 10)}<path d="M231 39l2-3 2 3" fill="none" stroke="${C.tinta}"/>${caja(228, 214, 10, 10)}<path d="M231 217l2 3 2-3" fill="none" stroke="${C.tinta}"/>${caja(228, 44, 10, 40)}
  ${caja(32, 227, 192, 9, C.hundido, true)}${caja(32, 227, 10, 9)}<path d="M39 229l-3 2.5 3 2.5" fill="none" stroke="${C.tinta}"/>${caja(214, 227, 10, 9)}<path d="M217 229l3 2.5-3 2.5" fill="none" stroke="${C.tinta}"/>${caja(44, 227, 70, 9)}
  <!-- paleta y color actual -->
  ${caja(6, 238, 16, 14, C.rosa, true)}<rect x="12" y="244" width="7" height="6" fill="#ffffff" stroke="${C.sombra}" stroke-width=".8"/><rect x="8" y="240" width="7" height="6" fill="#e87fa8" stroke="${C.tinta}" stroke-width=".8"/>
  ${paleta}
</svg>
`
writeFileSync(out, svg)
console.log(`pintura: ${ICONOS.length} herramientas, ${COLORES.length} colores, ${Buffer.byteLength(svg)} bytes`)
