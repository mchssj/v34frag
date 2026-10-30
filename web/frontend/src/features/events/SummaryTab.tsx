import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

import { Skeleton } from "@/components/ui/skeleton"
import {
  boText,
  closesAt,
  dateRange,
  formatText,
  freeSlots,
  modeText,
  prizeText,
  rulesOf,
  STATUS_LABEL,
} from "./model"
import { eventRegistrationsOptions, type EventDetail } from "./queries"
import { Card, TagBox } from "./ui"

/** Resumen: información, reglas y equipos inscriptos. */
export function SummaryTab({ event }: { event: EventDetail }) {
  const info: [string, string][] = [
    ["Modo", modeText(event)],
    ["Formato", formatText(event.template, event.config)],
    ["Partidas", boText(event) ?? "Por definir"],
    ["Estado", STATUS_LABEL[event.status]],
    ["Fechas", dateRange(event.starts_on, event.ends_on)],
    ["Premio", prizeText(event.prize)],
    [
      "Cupo",
      event.max_teams
        ? `${event.teams} / ${event.max_teams} equipos`
        : `${event.teams} equipos`,
    ],
  ]
  if (event.registration_closes_at)
    info.push([
      "Cierre de inscripciones",
      closesAt(event.registration_closes_at),
    ])
  if (event.organizer?.alias) info.push(["Organiza", event.organizer.alias])
  if (event.draw)
    info.push([
      "Sorteo",
      `Por ${event.draw.by.alias ?? "el organizador"} el ${format(parseISO(event.draw.at), "d MMM, HH:mm", { locale: es })}`,
    ])

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-4">
      <Card title="Información">
        <dl className="flex flex-col gap-2.5">
          {info.map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between gap-3 border-b pb-2.5 text-sm"
            >
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="Reglas">
        <ol className="flex list-decimal flex-col gap-2 pl-[18px] text-sm leading-normal">
          {rulesOf(event.rules).map((rule, i) => (
            <li key={i}>
              <Rule text={rule} />
            </li>
          ))}
        </ol>
      </Card>
      <Entrants event={event} />
    </div>
  )
}

/** `!match` y lo que vaya entre comillas invertidas, en mono. */
function Rule({ text }: { text: string }) {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i} className="font-mono text-[13px]">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    )
  )
}

function Entrants({ event }: { event: EventDetail }) {
  const registrations = useQuery(eventRegistrationsOptions(event.id)).data
  const free = freeSlots(event)
  // Hasta 4 "Cupo libre"; sin máximo, ninguno.
  const slots = Math.min(4, free ?? 0)

  return (
    <Card
      title="Equipos inscriptos"
      aside={
        <span className="font-mono text-xs font-medium text-muted-foreground">
          {event.teams}
          {event.max_teams ? `/${event.max_teams}` : ""}
        </span>
      }
    >
      {!registrations ? (
        <Skeleton className="h-[92px]" />
      ) : registrations.length === 0 && slots === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay equipos inscriptos.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
          {registrations.map((r) => (
            <li key={r.team.id}>
              <Link
                to="/teams/$id"
                params={{ id: r.team.id }}
                className="flex items-center gap-2 rounded-[calc(var(--radius)-2px)] border bg-background p-2 text-[13px] transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="w-4 shrink-0 font-mono text-[11px] font-medium text-muted-foreground">
                  {r.seed}
                </span>
                <TagBox team={r.team} />
                <span className="truncate font-medium">{r.team.name}</span>
              </Link>
            </li>
          ))}
          {Array.from({ length: slots }, (_, i) => (
            <li
              key={`free-${i}`}
              className="flex h-[42px] items-center justify-center rounded-[calc(var(--radius)-2px)] border border-dashed text-xs text-muted-foreground"
            >
              Cupo libre
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
