import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { Skeleton } from "@/components/ui/skeleton"
import { seasonsOptions } from "@/features/ranking/queries"
import { fmtDate } from "../format"
import { EmptyState, QueryError } from "../ui"

/** Las temporadas cerradas, de la más nueva a la más vieja, con las reglas que tuvieron. */
export function HistoryTab() {
  const seasons = useQuery(seasonsOptions)
  if (seasons.isError)
    return (
      <QueryError
        error={seasons.error}
        onRetry={() => void seasons.refetch()}
      />
    )
  if (seasons.isPending) return <Skeleton className="h-48 rounded-xl" />
  const closed = seasons.data.filter((s) => s.status === "closed")
  if (closed.length === 0)
    return <EmptyState>Todavía no terminó ninguna temporada.</EmptyState>

  return (
    <ul className="flex flex-col gap-2.5">
      {closed.map((s) => (
        <li
          key={s.id}
          className="flex flex-wrap items-center gap-4 rounded-xl border bg-card px-4 py-3.5"
        >
          <span className="flex min-w-[220px] flex-1 flex-col gap-0.5">
            <span className="font-semibold">
              Temporada {s.number} · {s.name}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {fmtDate(s.starts_at)} – {fmtDate(s.closed_at ?? s.ends_at)}
            </span>
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Campeón</span>
            <span className="font-semibold">
              {s.champion ? `🏆 ${s.champion.alias}` : "—"}
            </span>
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Medallas</span>
            <span className="font-mono">{s.medals}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            Top {s.top_n} · mínimo {s.min_matches} · reinicio {s.reset_pct} %
            sobre {s.reset_floor}
            {s.reset_all && " (todos)"}
          </span>
          <Link
            to="/ranking"
            search={{ season: s.id }}
            className="text-[13px] text-primary hover:underline"
          >
            Ver el ranking final
          </Link>
        </li>
      ))}
    </ul>
  )
}
