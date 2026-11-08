// Buscador de la ayuda (plan docs/bitacora/2026-11-06-ayuda-buscar-en-el-texto).
import { normalize } from "./links"

export type Fragmento = { antes: string; match: string; despues: string }

const CONTEXTO = 60

/**
 * El pedazo del texto alrededor de lo buscado (ya normalizado), o null si no está. Sin tildes, el texto normalizado
 * tiene el mismo largo que el original en español (á, ñ, ü), así que la posición sirve para cortar el original.
 */
export function fragmento(texto: string, n: string): Fragmento | null {
  if (!n) return null
  const i = normalize(texto).indexOf(n)
  if (i < 0) return null
  const fin = i + n.length
  let desde = Math.max(0, i - CONTEXTO)
  let hasta = Math.min(texto.length, fin + CONTEXTO)
  // Se corta en un espacio para no partir palabras, sin pasar por encima de lo buscado.
  if (desde > 0) {
    const espacio = texto.indexOf(" ", desde)
    if (espacio >= 0 && espacio < i) desde = espacio + 1
  }
  if (hasta < texto.length) {
    const espacio = texto.lastIndexOf(" ", hasta)
    if (espacio > fin) hasta = espacio
  }
  return {
    antes: (desde > 0 ? "…" : "") + texto.slice(desde, i),
    match: texto.slice(i, fin),
    despues: texto.slice(fin, hasta) + (hasta < texto.length ? "…" : ""),
  }
}
