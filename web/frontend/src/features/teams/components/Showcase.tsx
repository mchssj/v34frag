import { useQuery } from "@tanstack/react-query"
import { QueryState } from "@/components/brand/QueryState"
import { teamPinsOptions } from "@/features/pins/api"
import { PinTile, pinItem } from "@/features/pins/PinTile"

// --- Vitrina ------------------------------------------------------------

type Title = {
  id: string
  name: string
  ends_on: string | null
  /** Fin real (última partida); `ends_on` es el tentativo. */
  finished_at?: string | null
}

export function Showcase({
  teamId,
  titles,
  eventsPlayed,
}: {
  teamId: string
  titles: Title[]
  eventsPlayed: number
}) {
  // (replanteo 123) La vitrina muestra los pines de torneo: primero los mejores puestos.
  const pins = useQuery(teamPinsOptions(teamId))
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-baseline gap-2.5 text-xl font-bold tracking-[-0.4px]">
        Vitrina
        <span className="text-sm font-normal text-muted-foreground">
          {titles.length === 1 ? "1 título" : `${titles.length} títulos`} ·{" "}
          {eventsPlayed === 1
            ? "1 torneo jugado"
            : `${eventsPlayed} torneos jugados`}
        </span>
      </h2>
      <QueryState q={pins}>
        {(items) =>
          items.length === 0 ? (
            <p className="rounded-hero border border-dashed px-5 py-6 text-sm text-muted-foreground">
              Todavía no tiene pines de torneo.
            </p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-3 gap-y-5 rounded-hero border p-5">
              {items.map((p) => (
                <li key={p.id} className="min-w-0">
                  <PinTile item={pinItem(p)} size={108} showTeam={false} />
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </section>
  )
}
