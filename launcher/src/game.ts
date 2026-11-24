// Puente a los comandos de Rust (src-tauri/src/lib.rs). Fuera de Tauri (pnpm dev en el navegador) no hay juego.
import { invoke } from "@tauri-apps/api/core"

const inTauri = () => "__TAURI_INTERNALS__" in window

export type GameInfo = { dir: string; launcher: string }

const DIR_KEY = "cmleague.gameDir"
export const savedGameDir = () => {
  try {
    return localStorage.getItem(DIR_KEY)
  } catch {
    return null
  }
}
export const saveGameDir = (dir: string) => {
  try {
    localStorage.setItem(DIR_KEY, dir)
  } catch {
    /* sin almacenamiento */
  }
}

/** Busca ClientMod en la carpeta guardada o, si no hay, en las rutas comunes. */
export async function detectGame(dir?: string | null): Promise<GameInfo | null> {
  if (!inTauri()) return null
  return invoke<GameInfo | null>("game_detect", { dir: dir ?? null })
}

export const connectLine = (address: string, password: string) =>
  `connect ${address}; password ${password}`

export async function copyConnect(address: string, password: string) {
  await navigator.clipboard.writeText(connectLine(address, password))
}

/** Abre ClientMod conectado a la sala (plan, sección 4). Devuelve cómo lo abrió. */
export async function launchGame(dir: string, address: string, password: string): Promise<string> {
  if (!inTauri()) throw new Error("Abrir el juego solo funciona en el launcher instalado.")
  return invoke<string>("game_launch", { dir, address, password })
}

/** Ventana al frente, siempre visible mientras hay que aceptar, y parpadeo en la barra de tareas. */
export async function attention(on: boolean) {
  if (!inTauri()) return
  await invoke("window_attention", { on })
}
