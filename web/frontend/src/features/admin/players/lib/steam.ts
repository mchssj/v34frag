import type { SteamRequest } from "../types"

/** Por qué no se puede aprobar un pedido pendiente (null si se puede). */
export function requestBlock(r: SteamRequest): string | null {
  if (r.status !== "pending") return null
  if (r.kind === "add" && r.shares_match)
    return "Comparte partidas con otro SteamID de la ficha: no se puede aprobar (jugó con los dos a la vez)."
  if (r.kind === "remove" && r.player_steam_count <= 1)
    return "Es el único SteamID de la ficha: no se puede quitar."
  return null
}
