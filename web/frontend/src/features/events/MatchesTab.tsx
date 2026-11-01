import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "cn"

import { Skeleton } from "@/components/ui/skeleton"
import { MATCH_STATUS, scoreText, sidesOf } from "./model"
import { eventMatchesOptions, type EventMatch } from "./queries"
import { EmptyBox } from "./ui"

function whenText(m: EventMatch) {
  const at = m.starts_at ?? m.played_at
  return at
    ? format(parseISO(at), "d MMM · HH:mm", { locale: es })
    : "Sin fecha"
}

/** Partidas del torneo en el orden de la llave. */
export function MatchesTab({ eventId }: { eventId: string }) {
  const matches = useQuery(eventMatchesOptions(eventId)).data

  if (!matches) return <Skeleton className="h-[260px] rounded-hero" />
  const list = matches.filter((m) => !m.bye)
  if (list.length === 0)
    return (
      <EmptyBox>
        Las partidas aparecen cuando se arma el fixture del torneo.
      </EmptyBox>
    )

  return (
    <ul
      aria-label="Partidas del torneo"
      className="overflow-hidden rounded-[calc(var(--radius)+4px)] border bg-card"
    >
      {list.map((m) => {
        const [a, b] = sidesOf(m)
        const st = MATCH_STATUS[m.status]
        return (
          <li key={m.id} className="border-b last:border-b-0">
            <Link
              to="/match/$id"
              params={{ id: m.id }}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 text-sm transition-colors outline-none hover:bg-muted focus-visible:bg-muted sm:grid-cols-[140px_minmax(0,1fr)_80px_minmax(0,1fr)_90px]"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-medium">
                  {m.label ?? "Partida"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {whenText(m)}
                </span>
              </span>
              <span
                className={cn(
                  "inline-flex h-5 items-center justify-self-end rounded px-1.5 text-[10px] font-semibold sm:order-last",
                  st.className
                )}
              >
                {st.label}
              </span>
              {/* En teléfono, los equipos y el marcador ocupan una fila entera. */}
              <span className="col-span-2 grid grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] items-center gap-3 sm:col-span-3 sm:grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)]">
                <span
                  className={cn(
                    "truncate text-right",
                    a.won && "font-semibold",
                    !a.teamId && "text-muted-foreground"
                  )}
                >
                  {a.name}
                </span>
                <span className="text-center font-mono text-[15px] font-semibold">
                  {scoreText(m)}
                </span>
                <span
                  className={cn(
                    "truncate",
                    b.won && "font-semibold",
                    !b.teamId && "text-muted-foreground"
                  )}
                >
                  {b.name}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
