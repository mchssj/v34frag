import type { Schemas } from "@/api/client"

// Tipos del módulo (los de la API y los propios).

// Torneos: listado y detalle (handoff_torneos). Ver la bitácora 2026-10-25-torneos para lo que el
// backend todavía no tiene.

// En los esquemas generados, los `allOf` nulables (`champion`, `side.team`) quedan como
// `TeamRef & Record<string, never>`, y la respuesta de openapi-fetch los da como no nulos. Los datos
// reales traen null: se corrigen acá.
type TeamRef = Schemas["TeamRef"]

type Side = Omit<Schemas["MatchSide"], "team"> & { team: TeamRef | null }

export type EventSummary = Omit<Schemas["EventSummary"], "champion"> & {
  champion: TeamRef | null
}

export type EventDetail = Omit<Schemas["EventDetail"], "champion"> & {
  champion: TeamRef | null
}

export type EventMatch = Omit<Schemas["EventMatch"], "side1" | "side2"> & {
  side1: Side
  side2: Side
}

export type Registration = Schemas["Registration"]

export type LiveMatch = NonNullable<Schemas["LiveMatch"]>

export type Standing = Schemas["Standing"]
