import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { TeamCrest } from "@/components/brand/TeamCrest"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { eventMatchesOptions } from "@/features/events/api/queries"
import type { EventDetail, EventMatch } from "@/features/events/types"
import { EmptyState, QueryError, TableBox } from "../../components/ui"
import { fmtDateTime } from "../../lib/format"
import { MatchSheet } from "./MatchSheet"

const STATUS: Record<
  EventMatch["status"],
  { label: string; variant: "muted" | "live" | "win" | "danger" }
> = {
  upcoming: { label: "Por jugar", variant: "muted" },
  live: { label: "En curso", variant: "live" },
  finished: { label: "Terminada", variant: "win" },
  cancelled: { label: "Cancelada", variant: "danger" },
}

/** Partidas del torneo: horario (a mano), servidor y resultado de cada una. */
export function MatchesTab({ event }: { event: EventDetail }) {
  const list = useQuery(eventMatchesOptions(event.id))
  const [open, setOpen] = useState<EventMatch | null>(null)
  const [onlyPending, setOnlyPending] = useState(true)
  if (list.isError)
    return <QueryError error={list.error} onRetry={() => void list.refetch()} />
  if (!list.data) return <Skeleton className="h-80 rounded-xl" />
  if (list.data.length === 0)
    return (
      <EmptyState>
        El fixture todavía no está generado: las partidas aparecen al generarlo
        (pestaña Resumen).
      </EmptyState>
    )
  const rows = onlyPending
    ? list.data.filter((m) => m.status === "upcoming" || m.status === "live")
    : list.data
  const current = open && list.data.find((m) => m.id === open.id)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={onlyPending ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyPending(true)}
        >
          Pendientes
        </Button>
        <Button
          variant={onlyPending ? "outline" : "default"}
          size="sm"
          onClick={() => setOnlyPending(false)}
        >
          Todas
        </Button>
        <span className="text-xs text-muted-foreground">
          Las partidas sin horario quedan así hasta que alguien lo ponga: no hay
          horarios automáticos.
        </span>
      </div>
      {rows.length === 0 ? (
        <EmptyState>
          No quedan partidas pendientes en las fases armadas.
        </EmptyState>
      ) : (
        <TableBox>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Partida</th>
                  <th className="px-3 py-2 font-medium">Cruce</th>
                  <th className="px-3 py-2 font-medium">Horario</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 text-muted-foreground">
                      {m.label} · BO{m.best_of}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <Side team={m.side1.team} name={m.side1.name} />
                        <span className="font-mono text-xs text-muted-foreground">
                          {m.status === "upcoming"
                            ? "vs"
                            : `${m.side1.score ?? 0} : ${m.side2.score ?? 0}`}
                        </span>
                        <Side team={m.side2.team} name={m.side2.name} />
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {m.starts_at ? (
                        fmtDateTime(m.starts_at)
                      ) : (
                        <span className="text-muted-foreground">
                          Sin horario
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS[m.status].variant}>
                        {STATUS[m.status].label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpen(m)}
                      >
                        Gestionar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableBox>
      )}
      <MatchSheet
        event={event}
        match={current ?? null}
        onClose={() => setOpen(null)}
      />
    </div>
  )
}

function Side({
  team,
  name,
}: {
  team: EventMatch["side1"]["team"]
  name: string | null
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {team ? (
        <TeamCrest team={team} size="xs" />
      ) : (
        <span
          className="size-5 shrink-0 rounded border border-dashed"
          aria-hidden
        />
      )}
      <span className="truncate">{team?.name ?? name ?? "Por definir"}</span>
    </span>
  )
}
