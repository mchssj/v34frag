import type { Schemas } from "@/api/client"

// Tipos del módulo (los de la API y los propios).

export type MixItem = Schemas["MixItem"]

export type MixStats = Schemas["MixStats"]

export type LiveMixDetail = Schemas["LiveMixDetail"]

export type EloChoice = Schemas["DeleteMixBody"]["elo"]
