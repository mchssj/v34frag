import { toast } from "sonner"

import { LAUNCHER } from "@/config/site"

// Puente con el launcher de escritorio (launcher/ en el repo, docs/bitacora/2026-11-24-launcher-escritorio): la misma
// web abierta en una ventana propia. Fuera del launcher no hace nada y la web se comporta como siempre.
//
// Se habla con la parte nativa por el IPC de Tauri, sin sumar @tauri-apps/api a la web. El launcher solo le da estos
// comandos a https://cmleague.lat (launcher/src-tauri/capabilities/web.json).

type TauriInternals = {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>
}

function tauri(): TauriInternals | null {
  const w = window as unknown as { __TAURI_INTERNALS__?: TauriInternals }
  return w.__TAURI_INTERNALS__ ?? null
}

/** Si la web está abierta dentro del launcher. */
export const inLauncher = () => tauri() !== null

/**
 * Los accesos al launcher (menú lateral, menú de la cuenta, link de Jugar): solo en la web, nunca dentro del launcher,
 * y solo con el launcher publicado (Daniel, 2026-11-26).
 */
export const showLauncherLinks = () => LAUNCHER.published && !inLauncher()

/**
 * Partida encontrada (`found`) o servidor listo (`server`): aviso de Windows y la ventana del launcher al frente
 * (según su Configuración).
 */
export function launcherAttention(kind: "found" | "server" = "found") {
  void tauri()
    ?.invoke("window_attention", { kind })
    .catch(() => undefined)
}

/** Estado del matchmaking para la bandeja y Discord. `since` en milisegundos. */
export type LauncherStatus = {
  state: "idle" | "queue" | "found" | "lobby" | "live"
  mode?: string | null
  map?: string | null
  since?: number | null
  score?: string | null
}

export function launcherStatus(status: LauncherStatus) {
  void tauri()
    ?.invoke("launcher_status", { status })
    .catch(() => undefined)
}

/** Lo que la web necesita de la Configuración del launcher. `shop_theme_id` null: el tema equipado en el perfil. */
export type LauncherPrefs = {
  shop_theme: boolean
  shop_theme_id: string | null
}

export async function launcherPrefs(): Promise<LauncherPrefs | null> {
  const t = tauri()
  if (!t) return null
  return t.invoke<LauncherPrefs>("launcher_prefs").catch(() => null)
}

const PREFS_EVENT = "cmleague-launcher-prefs"

/** Avisa que cambió la Configuración del launcher a quien la escucha (`onLauncherPrefsChanged`). */
function prefsChanged() {
  window.dispatchEvent(new Event(PREFS_EVENT))
}

export function onLauncherPrefsChanged(fn: () => void) {
  window.addEventListener(PREFS_EVENT, fn)
  return () => window.removeEventListener(PREFS_EVENT, fn)
}

/**
 * Tema del launcher: `null` sin tema, `"profile"` el equipado en el perfil, o el id de un tema de la tienda.
 */
export async function launcherSetTheme(theme: string | null) {
  const t = tauri()
  if (!t) return null
  const prefs = await t.invoke<LauncherPrefs>("launcher_set_theme", {
    on: theme !== null,
    theme: theme === "profile" ? null : theme,
  })
  prefsChanged()
  return prefs
}

/** Colores de la barra de título ("#rrggbb"); null vuelve a los de fábrica. */
export function launcherWindowTheme(
  caption: string | null,
  border: string | null
) {
  void tauri()
    ?.invoke("window_theme", { caption, border })
    .catch(() => undefined)
}

/** Abre la ventana de Configuración del launcher. */
export function openLauncherSettings() {
  void tauri()
    ?.invoke("settings_open")
    .catch(() => undefined)
}

/**
 * Funciones que el launcher llama desde la parte nativa (por ejemplo "Aceptar partida" en la bandeja). Devuelve cómo
 * sacarlas.
 */
export function registerLauncherHandlers(handlers: { accept?: () => void }) {
  if (!inLauncher()) return () => undefined
  const w = window as unknown as {
    __cmleagueLauncher?: Record<string, (() => void) | undefined>
  }
  const bag = (w.__cmleagueLauncher ??= {})
  Object.assign(bag, handlers)
  return () => {
    for (const key of Object.keys(handlers))
      if (bag[key] === handlers[key as keyof typeof handlers]) delete bag[key]
  }
}

// El mismo texto que "Copiar connect" del matchmaking (connectCommand en features/matchmaking/labels.ts).
const connectCommand = (address: string, password?: string | null) =>
  password ? `connect ${address}; password ${password}` : `connect ${address}`

const message = (e: unknown) =>
  typeof e === "string" ? e : e instanceof Error ? e.message : String(e)

/**
 * Abre ClientMod conectado al servidor (por CMLauncher.exe y clientmod.ini). El connect también queda copiado, por si
 * hay que pegarlo en la consola. Si no encuentra ClientMod, abre una vez el selector de carpetas. Sin contraseña: SourceTV.
 */
export async function openGame(address: string, password?: string | null) {
  const t = tauri()
  if (!t) return
  const pw = password || null
  await navigator.clipboard
    .writeText(connectCommand(address, pw))
    .catch(() => undefined)
  const launch = () =>
    t.invoke<string>("game_launch", { address, password: pw })
  try {
    toast.success(await launch())
  } catch (e) {
    if (message(e) !== "NO_GAME") {
      toast.error(
        `${message(e)} El connect quedó copiado: pégalo en la consola (º).`
      )
      return
    }
    // El selector de carpetas de Windows: la web nunca manda una ruta (el launcher abre CMLauncher.exe como
    // administrador).
    toast.info(
      "No encontramos ClientMod: elige la carpeta donde lo instalaste (la que tiene CMLauncher.exe)."
    )
    try {
      const picked = await t.invoke<unknown>("game_pick_dir")
      if (!picked) {
        toast.info("El connect quedó copiado: pégalo en la consola (º).")
        return
      }
      toast.success(await launch())
    } catch (e2) {
      toast.error(
        `${message(e2)} El connect quedó copiado: pégalo en la consola (º).`
      )
    }
  }
}

/** Fuera del launcher: `steam://` no abre ClientMod, así que se copia el connect para pegarlo en la consola. */
async function copyForConsole(address: string, password?: string | null) {
  try {
    await navigator.clipboard.writeText(connectCommand(address, password))
    toast.success(
      "Connect copiado: pégalo en la consola del juego (º)",
      LAUNCHER.published
        ? {
            description: "Con el launcher de CMLeague entras con un clic.",
            action: {
              label: "Ver el launcher",
              onClick: () => window.location.assign("/launcher"),
            },
          }
        : undefined
    )
  } catch {
    toast.error(
      `No se pudo copiar. Escribe en la consola: ${connectCommand(address, password)}`
    )
  }
}

/**
 * Para los links "Conectar" (`steam://connect/...`): dentro del launcher abren ClientMod; en el navegador copian el
 * connect (ClientMod no es de Steam y el link no lo abre). El href queda para "copiar dirección".
 */
export const launchOnClick =
  (address: string, password?: string | null) =>
  (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (inLauncher()) void openGame(address, password)
    else void copyForConsole(address, password)
  }

// Al cambiar la Configuración en su ventana, el launcher llama a window.__cmleagueLauncher.prefsChanged().
if (typeof window !== "undefined" && inLauncher()) {
  const w = window as unknown as {
    __cmleagueLauncher?: Record<string, (() => void) | undefined>
  }
  ;(w.__cmleagueLauncher ??= {}).prefsChanged = prefsChanged
}
