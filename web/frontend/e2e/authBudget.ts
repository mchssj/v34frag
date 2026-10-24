import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { test } from "@playwright/test"

// La API deja 10 logins y registros por minuto (ventana fija, por IP). Antes de cada uno, las
// pruebas esperan a que en los últimos 60 s haya menos de 10: si ningún tramo de 60 s pasa de
// 10, tampoco lo pasa ninguna ventana fija. Las marcas quedan en un archivo para que valgan
// entre corridas seguidas (las pruebas corren en serie, con un solo worker).
const LIMIT = 10
const WINDOW_MS = 61_000 // 1 s de margen por la latencia
const FILE = "e2e/.auth/auth-hits.json"

function read(): number[] {
  if (!existsSync(FILE)) return []
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as number[]
  } catch {
    return []
  }
}

/** Reserva un login o registro: espera si hace falta para no recibir un 429. */
export async function spendAuth() {
  const recent = read().filter((t) => Date.now() - t < WINDOW_MS)
  if (recent.length >= LIMIT) {
    // Libera el más viejo de los que sobran.
    const wait = recent[recent.length - LIMIT] + WINDOW_MS - Date.now()
    // La espera no cuenta para el tiempo máximo de la prueba.
    test.info().setTimeout(test.info().timeout + wait)
    await new Promise((r) => setTimeout(r, wait))
  }
  const now = Date.now()
  mkdirSync(dirname(FILE), { recursive: true })
  writeFileSync(
    FILE,
    JSON.stringify([...recent.filter((t) => now - t < WINDOW_MS), now])
  )
}
