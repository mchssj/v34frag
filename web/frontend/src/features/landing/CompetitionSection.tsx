import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { ArrowRightIcon } from "lucide-react"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { SectionHeading } from "@/components/brand/SectionHeading"
import { Button } from "@/components/ui/button"
import {
  nextEventOptions,
  topPlayersOptions,
  type EventSummary,
} from "@/features/public/queries"

const TEMPLATE: Record<EventSummary["template"], string> = {
  single: "Eliminación directa",
  double: "Doble eliminación",
  groups: "Grupos + playoffs",
  swiss: "Suizo + playoffs",
}

// Fechas "AAAA-MM-DD" en hora local (new Date("2026-11-02") sería UTC y podría correr un día).
function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d)
}
const shortDate = (day: string) =>
  parseDay(day)
    .toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
    .replace(".", "")

function startsIn(day: string) {
  const days = Math.ceil((parseDay(day).getTime() - Date.now()) / 86_400_000)
  if (days <= 0) return "Hoy"
  return days === 1 ? "1 día" : `${days} días`
}

const cardClass = "flex flex-col overflow-hidden rounded-hero border bg-card"

function NextTournament() {
  const { data: event, isPending, isError } = useQuery(nextEventOptions)
  if (isPending)
    return <div className={cn(cardClass, "h-[392px] animate-pulse")} />

  if (!event) {
    return (
      <div
        className={cn(
          cardClass,
          "items-center justify-center gap-2 p-10 text-center"
        )}
      >
        <span className="text-base font-semibold">Próximo torneo</span>
        <p className="text-sm text-muted-foreground">
          {isError
            ? "No se pudo cargar el próximo torneo."
            : "Todavía no hay torneos con inscripción abierta."}
        </p>
      </div>
    )
  }

  const dates =
    event.starts_on && event.ends_on
      ? `${shortDate(event.starts_on)} – ${shortDate(event.ends_on)}`
      : event.starts_on
        ? shortDate(event.starts_on)
        : null
  const fill = event.max_teams
    ? Math.min(100, Math.round((event.teams / event.max_teams) * 100))
    : 0

  return (
    <article className={cardClass}>
      {/* Banner pendiente en la API: rayado del diseño. */}
      <div className="relative h-[120px] border-b bg-[repeating-linear-gradient(135deg,var(--muted)_0_10px,transparent_10px_20px)]">
        <span className="absolute top-4 left-4 inline-flex h-6 items-center rounded-full bg-foreground px-2.5 text-xs font-semibold text-background">
          Inscripciones abiertas
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-[22px] font-bold tracking-[-0.5px]">
            {event.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {TEMPLATE[event.template]}
            {dates && ` · ${dates}`}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          {[
            ["Premio", event.prize ?? "—"],
            ["Equipos", `${event.teams}/${event.max_teams ?? "—"}`],
            // Provisorio: la API no tiene fecha de cierre de inscripciones ("Cierra en").
            ["Empieza en", event.starts_on ? startsIn(event.starts_on) : "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col-reverse gap-0.5">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="truncate font-mono text-base font-bold">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div
          className="h-1.5 overflow-hidden rounded-[3px] bg-muted"
          role="progressbar"
          aria-label="Cupo de equipos"
          aria-valuenow={fill}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-primary" style={{ width: `${fill}%` }} />
        </div>
        <Button asChild size="md" className="mt-auto text-sm font-semibold">
          <Link to="/register" search={{}}>
            Regístrate para inscribir a tu equipo
            <ArrowRightIcon className="size-3.5" aria-hidden />
          </Link>
        </Button>
      </div>
    </article>
  )
}

function TopPlayers() {
  const { data: players, isPending, isError } = useQuery(topPlayersOptions)

  return (
    <article className={cardClass}>
      <div className="flex flex-wrap items-center gap-2 px-6 pt-5 pb-3">
        <h3 className="flex-1 text-base font-semibold">
          Top jugadores por ELO
        </h3>
        <Link
          to="/register"
          search={{}}
          className="px-1.5 py-px text-[13px] text-muted-foreground hover:text-foreground"
        >
          Regístrate para ver el ranking completo
        </Link>
      </div>
      {isPending ? (
        <ol>
          {Array.from({ length: 5 }, (_, i) => (
            <li
              key={i}
              className="flex h-14 items-center gap-3.5 border-t px-6"
            >
              <span className="h-4 w-full animate-pulse rounded bg-muted" />
            </li>
          ))}
        </ol>
      ) : !players?.length ? (
        <p className="border-t px-6 py-8 text-center text-sm text-muted-foreground">
          {isError
            ? "No se pudo cargar el ranking."
            : "Todavía no hay jugadores con ELO."}
        </p>
      ) : (
        <ol>
          {players.map((p, i) => (
            <li
              key={p.id}
              className="flex h-14 items-center gap-3.5 border-t px-6 text-sm"
            >
              <span
                className={cn(
                  "w-5 font-mono text-sm font-bold",
                  i === 0 ? "text-primary" : "text-muted-foreground"
                )}
              >
                {i + 1}
              </span>
              {p.photo_url ? (
                <img
                  src={p.photo_url}
                  alt=""
                  loading="lazy"
                  className="size-[34px] shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid size-[34px] shrink-0 place-items-center rounded-full bg-secondary text-[13px] font-semibold"
                >
                  {p.alias[0]?.toUpperCase()}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{p.alias}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {p.teams[0]?.name ?? "Agente libre"}
                </span>
              </span>
              {p.level != null && <LevelBadge level={p.level} />}
              <span className="w-12 text-right font-mono text-sm font-semibold">
                {p.elo ?? "—"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </article>
  )
}

export function CompetitionSection() {
  return (
    <section
      id="competencia"
      aria-labelledby="competencia-title"
      className="mx-auto flex w-full max-w-[1200px] scroll-mt-[60px] flex-col gap-8 px-6 pt-[72px] pb-[88px]"
    >
      <SectionHeading
        id="competencia-title"
        eyebrow="Competencia"
        title="Lo que se viene y quién manda."
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-5">
        <NextTournament />
        <TopPlayers />
      </div>
    </section>
  )
}
