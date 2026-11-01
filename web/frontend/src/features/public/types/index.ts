import type { Schemas } from "@/api/client"

// Tipos del módulo (los de la API y los propios).

// Datos públicos (sin sesión) de la landing y las tarjetas laterales del auth.

export type MatchSummary = Schemas["MatchSummary"]

export type EventSummary = Schemas["EventSummary"]

export type PlayerSummary = Schemas["PlayerSummary"]

export type ServerStatus = Schemas["ServerStatusItem"]
