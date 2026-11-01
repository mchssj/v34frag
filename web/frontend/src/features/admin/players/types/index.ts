import type { Schemas } from "@/api/client"

// Tipos del módulo (los de la API y los propios).

// Administración › Jugadores: fichas, sus SteamID y los pedidos de !claim (contrato admin.md).

export type PlayerSummary = Schemas["PlayerSummary"]

export type PlayerDetail = Schemas["PlayerDetail"]

export type Medal = Schemas["Medal"]

export type SteamRequest = Schemas["AdminSteamRequest"]

export type SteamUnlinked = Schemas["SteamUnlinked"]

export type PlayerIp = Schemas["PlayerIp"]

// `force` (guardar igual con una palabra bloqueada) tiene default en la API: acá es opcional.
export type PlayerPatch = Omit<Schemas["AdminPlayerPatch"], "force"> & {
  force?: boolean
}

export type FichaFilter = "all" | "account" | "noaccount" | "nosteam"
