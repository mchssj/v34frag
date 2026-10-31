import { type MatchesSearch } from "../lib/search"

import { MixKpis } from "../components/MixKpis"
import { Filters } from "../components/MatchFilters"
import type { Patch } from "../components/MatchFilters"
import { LiveBlock } from "../components/LiveBlock"
import { MatchesTable } from "../components/MatchesTable"

export function MatchesList({
  search,
  onChange,
}: {
  search: MatchesSearch
  /** Cambia la URL; cualquier cambio de filtro vuelve a la página 1. */
  onChange: (patch: Patch) => void
}) {
  const showLive = !search.kind || search.kind === "mix"
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.4px]">Partidas</h1>
        <p className="max-w-[72ch] text-sm text-pretty text-muted-foreground">
          Mixes, PCW y partidos de torneo jugados en el servidor. Cada mix
          actualiza el ELO de quienes jugaron; quien juega sin cuenta aparece
          como invitado con su nombre del juego.
        </p>
      </div>
      <MixKpis />
      <div
        id="lista-partidas"
        className="scroll-mt-4 overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]"
      >
        <Filters search={search} onChange={onChange} />
        {showLive && <LiveBlock />}
        <MatchesTable search={search} onChange={onChange} />
      </div>
    </section>
  )
}
