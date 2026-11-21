// Uso: node docs/generar_destellos.mjs salida.svg [relleno] [contorno] [contorno_suave]  (por defecto, la paleta de 3.gif)
// Genera marcos/destellos.svg: cada esquina es una copia propia con su desfase (las copias con <use> comparten el reloj
// de la animación y se encenderían todas a la vez).
import { writeFileSync } from "node:fs"

const [out, fill = "#e0f0ff", line = "#6060a0", soft = "#8080c0"] = process.argv.slice(2)
const DUR = 2 // segundos del ciclo completo
// begin negativo: la animación arranca ya en marcha, sin un primer ciclo con todo quieto.
const begin = (k) => `${(-(DUR - (k * DUR) / 4) % DUR).toFixed(2)}s`
const anim = (k, attr, type, values, keyTimes) =>
  `<animate${type ? "Transform" : ""} attributeName="${attr}"${type ? ` type="${type}"` : ""} values="${values}" keyTimes="${keyTimes}" dur="${DUR}s" begin="${begin(k)}" repeatCount="indefinite"/>`

const corner = (k) => `
  <g transform="rotate(${k * 90} 128 128)">
    <g transform="translate(20 22)"><g transform="scale(0)">
      ${anim(k, "transform", "scale", "0;2.1;1.8;0;0", "0;.1;.22;.4;1")}
      <use href="#estrella"/>
    </g></g>
    <g transform="translate(46 13)"><g transform="scale(0)">
      ${anim(k, "transform", "scale", "0;0;1.05;.85;0;0", "0;.08;.18;.28;.45;1")}
      <use href="#estrella"/>
    </g></g>
    <circle cx="12" cy="46" r="3" fill="${fill}" stroke="${line}" stroke-width="1.2" opacity="0">
      ${anim(k, "opacity", null, "0;1;1;0;0", "0;.15;.4;.55;1")}
    </circle>
    <g transform="translate(34 34)"><g opacity="0">
      ${anim(k, "opacity", null, "0;0;1;1;0;0", "0;.3;.4;.55;.7;1")}
      ${anim(k, "transform", "rotate", "-150;-150;-30;30;30", "0;.3;.55;.7;1")}
      <use href="#luna"/>
    </g></g>
  </g>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <!-- Destellos: estrellas de cuatro puntas y un arco creciente que se encienden por turnos en cada esquina, en sentido
       horario (inspiración 3.gif). Generado con un script; para otra paleta, cambiar los tres colores. Ciclo de ${DUR} s. -->
  <defs>
    <path id="estrella" d="M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10Z" fill="${fill}" stroke="${line}" stroke-width="1.5" stroke-linejoin="round"/>
    <path id="luna" d="M-24 0A24 24 0 0 1 24 0 26 19 0 0 0-24 0Z" fill="${fill}" stroke="${soft}" stroke-width="1.3" stroke-linejoin="round"/>
    <rect id="rombo" x="-5.5" y="-5.5" width="11" height="11" rx="3" transform="rotate(45)" fill="${fill}" stroke="${line}" stroke-width="1.2"/>
  </defs>${[0, 1, 2, 3].map(corner).join("")}
  <g>
    <use href="#rombo" transform="translate(11 128)"/><use href="#rombo" transform="translate(245 128)"/>
    <use href="#rombo" transform="translate(128 11)"/><use href="#rombo" transform="translate(128 245)"/>
    <animate attributeName="opacity" values=".35;1;.35" dur="${DUR}s" repeatCount="indefinite"/>
  </g>
</svg>
`
// Comprobación: un desfase distinto por esquina, todos dentro del ciclo.
const begins = [0, 1, 2, 3].map(begin)
if (new Set(begins).size !== 4 || begins.some((b) => parseFloat(b) > 0 || parseFloat(b) <= -DUR)) throw new Error(`desfases mal: ${begins}`)
writeFileSync(out, svg)
console.log(`${out}: ${svg.length} bytes, desfases ${begins.join(" ")}`)
