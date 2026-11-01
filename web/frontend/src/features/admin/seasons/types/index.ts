import type { Schemas } from "@/api/client"

// Tipos del módulo (los de la API y los propios).

// Administración › Temporadas (contrato temporadas.md, sección 8f).

export type Season = Schemas["Season"]

export type SeasonTier = Schemas["SeasonTier"]

export type SeasonConfig = Schemas["SeasonConfig"]

export type SeasonPatch = Schemas["SeasonPatch"]

export type SeasonPreviewRow = Schemas["SeasonPreviewRow"]

export type PreviewParams = {
  top_n: number
  min_matches: number
  reset_pct: number
  reset_floor: number
  reset_all: boolean
}

export type PreviewFilter = "medal" | "reset" | undefined
