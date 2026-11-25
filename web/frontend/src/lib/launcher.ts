import { toast } from "sonner"

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

/** Partida encontrada o servidor listo: trae la ventana del launcher al frente. */
export function launcherAttention() {
  void tauri()
    ?.invoke("window_attention")
    .catch(() => undefined)
}

// El mismo texto que "Copiar connect" del matchmaking (connectCommand en features/matchmaking/labels.ts).
const connectCommand = (address: string, password: string) =>
  `connect ${address}; password ${password}`

const message = (e: unknown) =>
  typeof e === "string" ? e : e instanceof Error ? e.message : String(e)

/**
 * Abre ClientMod conectado al servidor (por CMLauncher.exe y clientmod.ini). El connect también queda copiado, por si
 * hay que pegarlo en la consola. Si no encuentra ClientMod, pide la carpeta una vez.
 */
export async function openGame(address: string, password: string) {
  const t = tauri()
  if (!t) return
  await navigator.clipboard
    .writeText(connectCommand(address, password))
    .catch(() => undefined)
  try {
    toast.success(await t.invoke<string>("game_launch", { address, password }))
  } catch (e) {
    if (message(e) !== "NO_GAME") {
      toast.error(
        `${message(e)} El connect quedó copiado: pegalo en la consola (º).`
      )
      return
    }
    const dir = window.prompt(
      "No encontré ClientMod. ¿En qué carpeta lo instalaste? (la que tiene CMLauncher.exe)",
      "C:\\CSSv34_ClientMod"
    )
    if (!dir) {
      toast.info("El connect quedó copiado: pegalo en la consola (º).")
      return
    }
    try {
      await t.invoke("game_set_dir", { dir })
      toast.success(
        await t.invoke<string>("game_launch", { address, password })
      )
    } catch (e2) {
      toast.error(
        `${message(e2)} El connect quedó copiado: pegalo en la consola (º).`
      )
    }
  }
}

/**
 * Para los links "Conectar" (`steam://connect/...`): dentro del launcher abren ClientMod; fuera, el link sigue igual.
 */
export const launchOnClick =
  (address: string, password: string) => (e: { preventDefault(): void }) => {
    if (!inLauncher()) return
    e.preventDefault()
    void openGame(address, password)
  }
