import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"

import { Skeleton } from "@/components/ui/skeleton"
import {
  boText,
  closesText,
  dateRange,
  prizeText,
  progressRatio,
  sortEvents,
  TEMPLATE_LABEL,
} from "./model"
import { eventListOptions, type EventSummary } from "./queries"
import { EmptyBox, EventBanner, StatusChip } from "./ui"

export type ListFilter = "registration" | "in_progress" | "finished"

const FILTERS: { id: ListFilter | undefined; label: string }[] = [
  { id: undefined, label: "Todos" },
  { id: "registration", label: "Inscripciones" },
  { id: "in_progress", label: "En curso" },
  { id: "finished", label: "Finalizados" },
]

const EMPTY: Record<ListFilter | "all", string> = {
  all: "Todavía no hay torneos.",
  registration: "No hay torneos con inscripciones abiertas.",
  in_progress: "No hay torneos en curso.",
  finished: "Todavía no terminó ningún torneo.",
}

/** Listado de torneos con el filtro segmentado. */
export function EventList({
  filter,
  onFilter,
}: {
  filter: ListFilter | undefined
  onFilter: (f: ListFilter | undefined) => void
}) {
  const { data, isPending, error } = useQuery(eventListOptions)
  const events = sortEvents(
    (data ?? []).filter((e) => !filter || e.status === filter)
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-[-0.4px]">
            Torneos y copas
          </h1>
          <p className="text-sm text-pretty text-muted-foreground">
            Inscribe a tu equipo, sigue la llave y revisa los campeones
            anteriores.
          </p>
        </div>
        <div
          role="group"
          aria-label="Filtrar por estado"
          className="inline-flex h-8 max-w-full gap-0.5 overflow-x-auto rounded-[calc(var(--radius)-2px)] bg-muted p-[3px]"
        >
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => onFilter(f.id)}
              className={cn(
                "h-[26px] shrink-0 rounded-[calc(var(--radius)-4px)] px-2.5 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                filter === f.id &&
                  "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/.08)]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <EmptyBox>No se pudieron cargar los torneos.</EmptyBox>
      ) : isPending ? (
        <Grid>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[268px] rounded-hero" />
          ))}
        </Grid>
      ) : events.length === 0 ? (
        <EmptyBox>{EMPTY[filter ?? "all"]}</EmptyBox>
      ) : (
        <Grid>
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </Grid>
      )}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
      {children}
    </div>
  )
}

function EventCard({ event }: { event: EventSummary }) {
  const foot = footOf(event)
  const bo = boText(event)

  return (
    <Link
      to="/events/$id"
      params={{ id: event.id }}
      className="flex flex-col overflow-hidden rounded-[calc(var(--radius)+4px)] border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)] transition-colors outline-none hover:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <EventBanner url={event.banner_url} className="h-[88px] border-b">
        <StatusChip status={event.status} className="absolute top-3 right-3" />
      </EventBanner>
      <div className="flex flex-col gap-2.5 px-4 py-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-semibold">{event.name}</span>
          <span className="text-[13px] text-muted-foreground">
            {event.game_mode} · {TEMPLATE_LABEL[event.template]}
            {bo && ` · ${bo}`}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Fechas</dt>
            <dd className="font-medium">
              {dateRange(event.starts_on, event.ends_on)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Premio</dt>
            <dd className="font-medium">{prizeText(event.prize)}</dd>
          </div>
        </dl>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{foot.label}</span>
            <span className="truncate font-medium">{foot.value}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-[2px] bg-muted">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.round(foot.ratio * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}

/** Pie de la tarjeta según el estado: cupo, etapa actual o campeón. */
function footOf(e: EventSummary): {
  label: string
  value: string
  ratio: number
} {
  switch (e.status) {
    case "registration":
      return {
        label: e.registration_closes_at
          ? `Cupo · ${closesText(e.registration_closes_at)}`
          : "Cupo",
        value: e.max_teams ? `${e.teams}/${e.max_teams}` : `${e.teams}`,
        ratio: e.max_teams ? e.teams / e.max_teams : 0,
      }
    case "in_progress":
      return {
        label: "Etapa actual",
        value: e.current_stage ?? "Por definir",
        ratio: progressRatio(e.progress),
      }
    case "finished":
      return {
        label: "Campeón",
        value: e.champion?.name ?? "Sin campeón",
        ratio: 1,
      }
    case "cancelled":
      return { label: "Estado", value: "Cancelado", ratio: 0 }
  }
}
