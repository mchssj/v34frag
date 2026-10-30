import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  CheckIcon,
  ListIcon,
  LockIcon,
  PlusIcon,
  RadioIcon,
  TrophyIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { myTeamsOptions } from "@/features/teams/queries"
import { BracketTab } from "./BracketTab"
import { MatchesTab } from "./MatchesTab"
import {
  boText,
  closesAt,
  ctaFor,
  dateRange,
  liveText,
  prizeText,
  shortDay,
  TEMPLATE_LABEL,
  type Cta,
  type MyTeamRef,
} from "./model"
import {
  eventDetailOptions,
  eventRegistrationsOptions,
  type EventDetail,
} from "./queries"
import { CancelRegistrationDialog, RegisterDialog } from "./RegisterDialog"
import { StandingsTab } from "./StandingsTab"
import { SummaryTab } from "./SummaryTab"
import { EmptyBox, EventBanner, StatusChip } from "./ui"

export type EventTab = "bracket" | "standings" | "matches"

const TABS: { id: EventTab | undefined; label: string }[] = [
  { id: undefined, label: "Resumen" },
  { id: "bracket", label: "Llave" },
  { id: "standings", label: "Posiciones" },
  { id: "matches", label: "Partidas" },
]

/** Detalle del torneo: cabecera con el botón según el rol y las cuatro pestañas. */
export function EventView({
  eventId,
  tab,
}: {
  eventId: string
  tab: EventTab | undefined
}) {
  const { data: event, error } = useQuery(eventDetailOptions(eventId))

  if (error) return <EmptyBox>No se pudo cargar el torneo.</EmptyBox>
  if (!event) return <Skeleton className="h-[290px] rounded-hero" />

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-[calc(var(--radius)+4px)] border bg-card">
        <EventBanner url={event.banner_url} className="h-[120px]" />
        <div className="flex flex-wrap items-end gap-4 px-5 py-4">
          <div className="flex min-w-[min(100%,240px)] flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={event.status} />
              <span className="text-[13px] text-muted-foreground">
                {dateRange(event.starts_on, event.ends_on)}
              </span>
            </div>
            <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.5px] text-balance">
              {event.name}
            </h1>
            <span className="text-sm text-muted-foreground">
              {[
                event.game_mode,
                TEMPLATE_LABEL[event.template],
                boText(event),
                prizeText(event.prize),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <EventCta event={event} />
        </div>
        <nav
          aria-label="Secciones del torneo"
          className="flex gap-1 overflow-x-auto border-t px-4"
        >
          {TABS.map((t) => (
            <Link
              key={t.label}
              to="/events/$id"
              params={{ id: eventId }}
              search={{ tab: t.id }}
              resetScroll={false}
              aria-current={tab === t.id ? "page" : undefined}
              // En teléfono las pestañas se desplazan: la activa queda a la vista.
              ref={
                tab === t.id
                  ? (el) =>
                      el?.scrollIntoView({
                        block: "nearest",
                        inline: "nearest",
                      })
                  : undefined
              }
              className={cn(
                "flex h-[42px] shrink-0 items-center px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                tab === t.id &&
                  "text-foreground shadow-[inset_0_-2px_0_var(--primary)]"
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </section>

      {tab === "bracket" ? (
        <BracketTab event={event} />
      ) : tab === "standings" ? (
        <StandingsTab event={event} />
      ) : tab === "matches" ? (
        <MatchesTab eventId={event.id} />
      ) : (
        <SummaryTab event={event} />
      )}
    </div>
  )
}

/** Equipos del usuario (los que lidera y en los que juega), de `GET /me/teams`. */
function useMyTeams(): MyTeamRef[] {
  const teams = useQuery(myTeamsOptions).data ?? []
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    tag: t.tag,
    isLeader: t.my_role === "leader",
  }))
}

type Dialog = { kind: "register"; team?: MyTeamRef } | { kind: "cancel" } | null

function EventCta({ event }: { event: EventDetail }) {
  const myTeams = useMyTeams()
  const registrations = useQuery(eventRegistrationsOptions(event.id)).data
  const [dialog, setDialog] = useState<Dialog>(null)

  // Hasta saber quién está inscripto, el botón de inscribir no se puede decidir.
  if (event.status === "registration" && !registrations) return null
  const cta = ctaFor({
    event,
    myTeams,
    registeredIds: new Set(registrations?.map((r) => r.team.id)),
  })
  if (cta.kind === "none") return null

  // "Cambiar inscritos" reabre el diálogo con el equipo inscripto y sus jugadores.
  const registered = cta.kind === "registered" ? cta.team : undefined
  const dialogTeams =
    cta.kind === "register" ? cta.teams : registered ? [registered] : []
  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <CtaButtons cta={cta} event={event} onDialog={setDialog} />
      </div>
      <CtaNote cta={cta} event={event} />
      {dialog?.kind === "register" && (
        <RegisterDialog
          event={event}
          teams={dialogTeams}
          registration={
            registered &&
            registrations?.find((r) => r.team.id === registered.id)
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "cancel" && registered && (
        <CancelRegistrationDialog
          event={event}
          team={registered}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function CtaButtons({
  cta,
  event,
  onDialog,
}: {
  cta: Exclude<Cta, { kind: "none" }>
  event: EventDetail
  onDialog: (d: Dialog) => void
}) {
  switch (cta.kind) {
    case "register":
      return (
        <Button
          size="lg"
          className="px-4"
          onClick={() => onDialog({ kind: "register" })}
        >
          <PlusIcon aria-hidden />
          {cta.teams.length === 1
            ? `Inscribir a ${cta.teams[0].name}`
            : "Inscribir equipo"}
        </Button>
      )
    case "full":
      return (
        <Button size="lg" variant="outline" className="px-4" disabled>
          <LockIcon aria-hidden />
          Cupo completo
        </Button>
      )
    case "registered":
      return (
        <>
          <Button
            size="lg"
            variant="ghost"
            className="px-4"
            disabled={cta.closed}
            onClick={() => onDialog({ kind: "register" })}
          >
            <UsersIcon aria-hidden />
            Cambiar inscritos
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="px-4"
            disabled={cta.closed}
            onClick={() => onDialog({ kind: "cancel" })}
          >
            <XIcon aria-hidden />
            Cancelar inscripción
          </Button>
        </>
      )
    case "closed":
      return (
        <Button size="lg" variant="outline" className="px-4" disabled>
          <LockIcon aria-hidden />
          Inscripciones cerradas
        </Button>
      )
    case "ask-leader":
      return (
        <Button size="lg" variant="outline" className="px-4" disabled>
          {cta.registered ? (
            <CheckIcon aria-hidden />
          ) : (
            <LockIcon aria-hidden />
          )}
          {cta.registered
            ? `${cta.team.name} inscripto`
            : "Pídele al líder que inscriba"}
        </Button>
      )
    case "no-team":
      return (
        <Button asChild size="lg" variant="outline" className="px-4">
          <Link to="/myteam">
            <UsersIcon aria-hidden />
            Arma o únete a un equipo
          </Link>
        </Button>
      )
    case "live":
      return (
        <Button asChild size="lg" className="px-4">
          <Link to="/match/$id" params={{ id: cta.match.id }}>
            <RadioIcon aria-hidden />
            Ver partida en vivo
          </Link>
        </Button>
      )
    case "matches":
      return (
        <Button asChild size="lg" variant="outline" className="px-4">
          <Link
            to="/events/$id"
            params={{ id: event.id }}
            search={{ tab: "matches" }}
          >
            <ListIcon aria-hidden />
            Ver partidas
          </Link>
        </Button>
      )
    case "champion":
      return (
        <Button asChild size="lg" variant="outline" className="px-4">
          <Link to="/teams/$id" params={{ id: cta.team.id }}>
            <TrophyIcon aria-hidden />
            Campeón: {cta.team.name}
          </Link>
        </Button>
      )
  }
}

function CtaNote({
  cta,
  event,
}: {
  cta: Exclude<Cta, { kind: "none" }>
  event: EventDetail
}) {
  const text = (() => {
    switch (cta.kind) {
      case "register": {
        const players = `${event.players_per_team} ${event.players_per_team === 1 ? "activo" : "activos"}${event.subs_max ? ` y hasta ${event.subs_max} ${event.subs_max === 1 ? "suplente" : "suplentes"}` : ""}`
        const free =
          cta.free == null
            ? ""
            : ` · ${cta.free} ${cta.free === 1 ? "cupo libre" : "cupos libres"}`
        return `Elige ${players} del roster${free}`
      }
      case "full":
        return "No quedan cupos libres"
      case "registered":
        if (cta.closed)
          return `${cta.team.name} inscripto · las inscripciones ya cerraron`
        return event.registration_closes_at
          ? `${cta.team.name} inscripto · puedes cambiarlo o cancelar hasta el ${closesAt(event.registration_closes_at)}`
          : `${cta.team.name} inscripto · puedes cancelar hasta que se arme el fixture`
      case "closed":
        return `Cerraron el ${closesAt(cta.at)}`
      case "ask-leader":
        return cta.registered
          ? "La inscripción la gestiona el líder"
          : `Solo el líder de ${cta.team.name} puede inscribirlo`
      case "no-team":
        return "Necesitas un equipo para inscribirte"
      case "live":
        return liveText(cta.match)
      case "matches":
        return cta.stage ? `Etapa actual: ${cta.stage}` : null
      case "champion":
        return cta.on ? `Finalizado el ${shortDay(cta.on)}` : null
    }
  })()
  return text ? (
    <span className="text-xs text-pretty text-muted-foreground sm:text-right">
      {text}
    </span>
  ) : null
}
