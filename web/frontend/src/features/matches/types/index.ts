import type { Schemas } from "@/api/client"

// Tipos del módulo (los de la API y los propios).

// El `allOf` nulable de `side.team` queda como `TeamRef & Record<string, never>` en los esquemas
// generados (igual que en Torneos): acá vuelve a ser `TeamRef | null`.
type Side = Omit<Schemas["MatchSide"], "team"> & {
  team: Schemas["TeamRef"] | null
}

export type MatchSummary = Omit<Schemas["MatchSummary"], "side1" | "side2"> & {
  side1: Side
  side2: Side
}
