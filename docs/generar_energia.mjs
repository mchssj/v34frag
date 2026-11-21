// Uso: node docs/generar_energia.mjs carpeta_salida [semilla=3]
// Marco "Energía" (inspiración 7.gif): una línea fina y dentada de energía pegada al borde, con chispas que apuntan
// hacia adentro y aparecen y desaparecen, puntos de luz que recorren el borde y la línea
// que tiembla. Bordes duros, sin difuminado (pixel art). Genera un SVG por paleta, todos con la misma forma.
import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

const [dir, seedArg = "3"] = process.argv.slice(2)
if (!dir) throw new Error("uso: node docs/generar_energia.mjs carpeta [semilla]")

// [base, medio, claro, blanco]: la base es la línea; medio y claro, los puntos de luz; blanco, su centro.
export const PALETAS = {
  violeta: ["#6040e0", "#8a64f0", "#c8a8f4", "#f6efff"], // la de 7.gif
  toxico: ["#1f9e48", "#3fcf6a", "#a4f5b4", "#f0fff3"],
  ambar: ["#d0461c", "#f0802c", "#ffc778", "#fff6e0"],
  hielo: ["#1b74d0", "#3ab2f2", "#a6e6ff", "#f0fbff"],
  magenta: ["#cc2a8c", "#f058b4", "#ffacd9", "#fff0f8"],
}

const r1 = (v) => Math.round(v * 10) / 10
// Distancias al borde de la imagen. La foto empieza en 32: el borde interior (IN ± 2 de temblor) queda siempre sobre
// ella, para que no haya espacio entre el marco y la foto (Daniel, 2026-11-20; 7.gif deja ese espacio).
const OUT = 24, IN = 34, MID = (OUT + IN) / 2
const PER_SIDE = 34, DUR = 3

// Punto del perímetro de un cuadrado a `d` del borde: lado 0 arriba, 1 derecha, 2 abajo, 3 izquierda (horario).
function at(side, u, d) {
  const a = d + u * (256 - 2 * d)
  return [[a, d], [256 - d, a], [256 - a, 256 - d], [d, 256 - a]][side]
}

function build(seed) {
  let s = seed >>> 0 || 1
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) // misma semilla, misma forma
  const jit = (a) => (rand() * 2 - 1) * a

  // La línea: borde de afuera e interior dentados (evenodd). Cuatro poses que se alternan de golpe: tiembla.
  const ring = () => {
    const outer = [], inner = []
    for (let side = 0; side < 4; side++)
      for (let i = 0; i < PER_SIDE; i++) {
        const u = i / PER_SIDE
        outer.push(at(side, u, OUT + jit(1.5)))
        inner.push(at(side, u, IN + jit(2) + (rand() < 0.12 ? 2.5 : 0)))
      }
    const poly = (p) => "M" + p.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L") + "Z"
    return poly(outer) + poly(inner.reverse())
  }
  const poses = Array.from({ length: 4 }, ring)

  // Chispas: trazos cortos y finos desde el borde interior hacia adentro (unos pocos hacia afuera), y pedacitos sueltos
  // flotando por fuera de la línea (por dentro caerían sobre la foto). Todos parpadean.
  const chispas = Array.from({ length: 64 }, (_, k) => {
    const side = k % 4, u = 0.04 + rand() * 0.92, out = rand() < 0.15, suelto = !out && rand() < 0.35
    const len = out ? 1.5 + rand() * 2.5 : 2 + rand() * 6, w = 0.003 + rand() * 0.005
    const base = out ? OUT : suelto ? OUT - 2 - rand() * 3 : IN - 1
    const [ax, ay] = at(side, u - w, base), [bx, by] = at(side, u + w, base)
    const [tx, ty] = at(side, u + jit(0.006), out || suelto ? base - len : base + len)
    const steps = Array.from({ length: 12 }, () => (rand() < (suelto ? 0.3 : 0.5) ? 1 : 0))
    return { d: `M${r1(ax)} ${r1(ay)}L${r1(tx)} ${r1(ty)}L${r1(bx)} ${r1(by)}Z`, steps, dur: rand() < 0.5 ? 1.2 : 1.8 }
  })
  // Sin huecos: 7.gif abre tramos de la línea un momento, pero se ve como si el marco se rompiera (Daniel, 2026-11-20).
  return { poses, chispas }
}

function svg(name, [base, medio, claro, blanco], { poses, chispas }) {
  const kt = (n) => Array.from({ length: n }, (_, i) => r1((i / n) * 1000) / 1000).join(";")
  const center = `M${MID} ${256 - MID}V${MID}H${256 - MID}V${256 - MID}Z` // empieza abajo a la izquierda, en sentido horario
  // Puntos de luz: tres capas del mismo trazo (medio ancho, claro, blanco fino) recorriendo el borde, difuminadas y
  // recortadas con la forma de la línea, así brillan por dentro y siguen su borde dentado.
  const luz = (color, width, dash) => `<path d="${center}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" pathLength="100" stroke-dasharray="${dash}">
      <animate attributeName="stroke-dashoffset" values="0;-100" dur="${DUR}s" repeatCount="indefinite"/>
    </path>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" shape-rendering="crispEdges">
  <!-- Energía (${name}): línea de energía dentada con chispas y puntos de luz que recorren el borde (inspiración 7.gif).
       Generado con docs/generar_energia.mjs. Ciclo de ${DUR} s. -->
  <defs>
    <path id="linea" fill-rule="evenodd" d="${poses[0]}">
      <animate attributeName="d" values="${poses.join(";")}" calcMode="discrete" dur=".6s" repeatCount="indefinite"/>
    </path>
    <clipPath id="dentro"><use href="#linea"/></clipPath>
    <filter id="suave" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="nucleo" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation=".7"/></filter>
  </defs>
  <g>
    <use href="#linea" fill="${base}"/>
    <!-- Rellenos de las esquinas: la foto tiene las esquinas redondeadas y la línea no; sin esto queda un hueco ahí. -->
    <path fill="${base}" d="${[[IN - 1, IN - 1, 1, 1], [256 - IN + 1, IN - 1, -1, 1], [256 - IN + 1, 256 - IN + 1, -1, -1], [IN - 1, 256 - IN + 1, 1, -1]].map(([x, y, sx, sy]) => `M${x} ${y}h${sx * 10}L${x} ${y + sy * 10}Z`).join("")}"/>
    <g fill="${base}">
      ${chispas.map((c) => `<path d="${c.d}" opacity="${c.steps[0]}"><animate attributeName="opacity" values="${c.steps.join(";")}" keyTimes="${kt(12)}" calcMode="discrete" dur="${c.dur}s" repeatCount="indefinite"/></path>`).join("\n      ")}
    </g>
    <g clip-path="url(#dentro)" shape-rendering="auto">
      <g filter="url(#suave)">
        ${luz(medio, 12, "12 21.3 9 24.4 16 17.3")}
        ${luz(claro, 7, "0 2 8 23.3 0 2 5 26.4 0 2 12 19.3")}
      </g>
      <g filter="url(#nucleo)">${luz(blanco, 2.4, "0 4 4 25.3 0 4 1 28.4 0 5 6 22.3")}</g>
    </g>
  </g>
</svg>
`
}

// Comprobaciones: cada paleta tiene sus cuatro colores; las poses de la línea tienen los mismos comandos; las capas de
// luz suman 100 (un ciclo exacto del recorrido, sin salto).
const forma = build(Number(seedArg))
const cmds = forma.poses.map((d) => d.replace(/[^MLZ]/g, ""))
if (new Set(cmds).size !== 1) throw new Error("las poses de la línea no tienen los mismos comandos")
for (const dash of ["12 21.3 9 24.4 16 17.3", "0 2 8 23.3 0 2 5 26.4 0 2 12 19.3", "0 4 4 25.3 0 4 1 28.4 0 5 6 22.3"]) {
  const total = dash.split(" ").map(Number).reduce((a, b) => a + b, 0)
  if (Math.abs(total - 100) > 0.01) throw new Error(`el trazo "${dash}" suma ${total}, no 100`)
}
mkdirSync(dir, { recursive: true })
for (const [name, pal] of Object.entries(PALETAS)) {
  if (pal.length !== 4) throw new Error(`la paleta ${name} no tiene 4 colores`)
  const file = join(dir, `energia-${name}.svg`), out = svg(name, pal, forma)
  writeFileSync(file, out)
  console.log(`${file}: ${(out.length / 1024).toFixed(1)} KB`)
}
