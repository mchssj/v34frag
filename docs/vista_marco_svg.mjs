// Uso: node docs/vista_marco_svg.mjs marco.svg vista.html [segundos separados por coma], y la captura con Chrome sin
// ventana (ver la guía de arte). Arma una página con el SVG en 6 momentos del ciclo (animación pausada), sobre tema claro
// y oscuro y con un avatar de prueba en el lugar que usa la web (inset 12,5 %, radio 8 %).
import { readFileSync, writeFileSync } from "node:fs"

const [svgPath, out, at = "0,0.33,0.67,1,1.33,1.67"] = process.argv.slice(2)
const svg = readFileSync(svgPath, "utf8").replace(/<!--[\s\S]*?-->/g, "")
const times = at.split(",").map(Number)
const cell = (t, bg, i) => `<div class="c" style="background:${bg}"><div class="av"></div>${svg.replace("<svg ", `<svg data-t="${t}" `).replace(/id="(\w+)"/g, `id="$1${i}"`).replace(/href="#(\w+)"/g, `href="#$1${i}"`).replace(/url\(#(\w+)\)/g, `url(#$1${i})`)}</div>`
let i = 0
const rows = ["#f4f4f7", "#14151c"].map((bg) => `<div class="r">${times.map((t) => cell(t, bg, i++)).join("")}</div>`).join("")
writeFileSync(out, `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#888}.r{display:flex}.c{position:relative;width:200px;height:200px}
.c svg{position:absolute;inset:0;width:200px;height:200px}
.av{position:absolute;inset:12.5%;border-radius:8%;background:linear-gradient(135deg,#c76b6b,#a36ad1 50%,#5a7fd6)}
</style>${rows}<script>for (const s of document.querySelectorAll("svg")) { s.pauseAnimations(); s.setCurrentTime(+s.dataset.t) }</script>`)
