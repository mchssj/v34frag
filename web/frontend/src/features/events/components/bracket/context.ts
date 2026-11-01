import { createContext, useContext } from "react"

import type { Dest } from "../../lib/bracket"
import type { EventMatch } from "../../types"

/** Lo que comparten todas las fases de la Llave. */
export type BracketCtx = {
  /** Todas las partidas del torneo (para saber de dónde sale cada lado). */
  all: EventMatch[]
  /** Siembra de cada equipo (id → puesto). */
  seeds: ReadonlyMap<string, number>
  marks: ReadonlyMap<string, [Dest | null, Dest | null]>
  /** Equipo bajo el cursor: su camino queda marcado y lo demás se apaga. */
  hover: string | null
  onHover: (team: string | null) => void
}

export const BracketContext = createContext<BracketCtx>({
  all: [],
  seeds: new Map(),
  marks: new Map(),
  hover: null,
  onHover: () => {},
})

export const useBracket = () => useContext(BracketContext)
