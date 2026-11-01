import type { Schemas } from "@/api/client"

// Tipos del módulo (los de la API y los propios).

// Administración › Baneos: la lista única de todos los servidores (contrato admin.md).

export type Ban = Schemas["Ban"]

export type BanStatus = Ban["status"]

export type BanSource = Ban["source"]

export type BanCreate = Schemas["BanCreate"]

export type BanPatch = Schemas["BanPatch"]

/** Orden de la lista: los más recientes primero, o los que vencen antes (los permanentes al final). */
export type BanSort = "recent" | "soon"

export type BanFilters = {
  source?: BanSource
  server?: string
  q?: string
  sort: BanSort
}

/** A quién alcanza un baneo: la ficha o, si no tiene, el SteamID. */
export type BanPerson =
  { kind: "player"; id: string } | { kind: "steam"; steamId: string }
