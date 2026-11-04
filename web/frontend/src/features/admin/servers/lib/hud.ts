import type { AdminServer } from "../types"

// HUD del relay en el VPS (bitácora 2026-10-29-frontend-hud): puerto, interruptor, clave y las líneas del cfg de cada
// servidor. El relay lee los cambios de la base cada 30 segundos.

export const HUD_PORT_MIN = 27500

export const HUD_PORT_MAX = 27519

type Hud = AdminServer["hud"]

/** Chip del HUD en la fila y en el panel. */
export function hudChip(hud: Hud): {
  text: string
  tone: "win" | "warn" | "neutral"
} {
  if (hud.port === null) return { text: "Sin HUD", tone: "neutral" }
  if (!hud.enabled) return { text: `Apagado · ${hud.port}`, tone: "neutral" }
  if (hud.receiving) return { text: "Recibiendo", tone: "win" }
  return { text: "Activo · sin señal", tone: "warn" }
}

/** El puerto escrito, o un error para mostrar. Vacío = sin HUD. */
export function parseHudPort(
  raw: string
): { port: number | null } | { error: string } {
  const t = raw.trim()
  if (t === "") return { port: null }
  const n = Number(t)
  if (!Number.isInteger(n) || n < HUD_PORT_MIN || n > HUD_PORT_MAX)
    return {
      error: `El puerto tiene que estar entre ${HUD_PORT_MIN} y ${HUD_PORT_MAX}.`,
    }
  return { port: n }
}
