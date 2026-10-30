import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { TriangleAlertIcon } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import {
  advanceOf,
  groupLetter,
  noStandingsText,
  qualifies,
  standingTables,
  type StandingTable,
} from "./model"
import {
  eventStandingsOptions,
  type EventDetail,
  type Standing,
} from "./queries"
import { EmptyBox } from "./ui"

type Col = {
  label: string
  /** Nombre completo para lectores de pantalla y tooltip. */
  title?: string
  cell: (r: Standing) => React.ReactNode
  mono?: boolean
  muted?: boolean
  strong?: boolean
}

const rounds = (r: Standing) =>
  r.rounds_for == null ? "—" : `${r.rounds_for}:${r.rounds_against ?? 0}`

const STATE_LABEL = {
  active: "En carrera",
  qualified: "Clasificado",
  eliminated: "Eliminado",
} as const
const state = (r: Standing) => (r.state ? STATE_LABEL[r.state] : "—")

// Sin empates en el sistema (victoria 3, derrota 0): no hay columna E.
const COLUMNS: Record<Standing["stage"], Col[]> = {
  group: [
    { label: "PJ", title: "Partidas jugadas", cell: (r) => r.played },
    { label: "G", title: "Ganadas", cell: (r) => r.won },
    { label: "P", title: "Perdidas", cell: (r) => r.lost },
    { label: "Rondas", cell: rounds, mono: true, muted: true },
    {
      label: "Pts",
      title: "Puntos",
      cell: (r) => r.points ?? 0,
      mono: true,
      strong: true,
    },
  ],
  swiss: [
    {
      label: "Récord",
      cell: (r) => `${r.won}-${r.lost}`,
      mono: true,
      strong: true,
    },
    {
      label: "Dif.",
      title: "Diferencia de rondas",
      cell: (r) => r.rounds_diff,
      mono: true,
      muted: true,
    },
    { label: "Buchholz", cell: (r) => r.buchholz ?? "—", mono: true },
    { label: "Estado", cell: state },
  ],
  group_double: [
    { label: "G", title: "Ganadas", cell: (r) => r.won },
    { label: "P", title: "Perdidas", cell: (r) => r.lost },
    { label: "Rondas", cell: rounds, mono: true, muted: true },
    { label: "Estado", cell: state },
  ],
}

/** Posiciones: una tabla por grupo o fase suiza. */
export function StandingsTab({ event }: { event: EventDetail }) {
  const rows = useQuery(eventStandingsOptions(event.id)).data

  if (!rows) return <Skeleton className="h-[220px] rounded-hero" />
  const tables = standingTables(rows)
  if (tables.length === 0)
    return <EmptyBox>{noStandingsText(event.template)}</EmptyBox>

  const advance = advanceOf(event.template, event.config)
  return (
    <div className="flex flex-col gap-4">
      {event.tie_pending && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5 text-sm text-pretty"
        >
          <TriangleAlertIcon
            className="size-4 shrink-0 text-primary"
            aria-hidden
          />
          Hay un empate en el Grupo {groupLetter(event.tie_pending.grp)}: lo
          resuelve el organizador y después se arman los playoffs.
        </p>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-4">
        {tables.map((t) => (
          <Table key={t.key} table={t} advance={advance} />
        ))}
      </div>
    </div>
  )
}

function Table({ table, advance }: { table: StandingTable; advance: number }) {
  const cols = COLUMNS[table.stage]
  return (
    <section className="min-w-0 overflow-hidden rounded-[calc(var(--radius)+4px)] border bg-card">
      <h2 className="border-b px-4 py-3 text-sm font-semibold">
        {table.title}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-2 pl-4 text-left font-medium">
                #
              </th>
              <th scope="col" className="p-2 text-left font-medium">
                Equipo
              </th>
              {cols.map((c, i) => (
                <th
                  key={c.label}
                  scope="col"
                  className={cn(
                    "p-2 font-medium whitespace-nowrap",
                    i === cols.length - 1 && "pr-4"
                  )}
                >
                  {c.title ? (
                    <abbr title={c.title} className="no-underline">
                      {c.label}
                    </abbr>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => {
              const adv = qualifies(r, advance)
              return (
                <tr
                  key={r.team.id}
                  className={cn(
                    "border-b last:border-b-0",
                    adv && "bg-primary/5"
                  )}
                >
                  <td
                    className={cn(
                      "py-[9px] pr-2 pl-4 font-mono",
                      adv && "shadow-[inset_2px_0_0_var(--primary)]"
                    )}
                  >
                    {r.place}
                  </td>
                  <td className="px-2 py-[9px] font-medium">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Link
                        to="/teams/$id"
                        params={{ id: r.team.id }}
                        className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {r.team.name}
                      </Link>
                      {adv && (
                        <span className="text-[11px] font-medium text-primary">
                          Clasifica
                        </span>
                      )}
                      {r.tied && (
                        <span className="rounded bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
                          Empate
                        </span>
                      )}
                    </span>
                  </td>
                  {cols.map((c, i) => (
                    <td
                      key={c.label}
                      className={cn(
                        "px-2 py-[9px] text-center whitespace-nowrap",
                        c.mono && "font-mono",
                        c.muted && "text-muted-foreground",
                        c.strong && "font-semibold",
                        i === cols.length - 1 && "pr-4"
                      )}
                    >
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
