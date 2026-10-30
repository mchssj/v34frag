import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { differenceInCalendarDays, parseISO } from "date-fns"
import {
  CheckIcon,
  ClockIcon,
  ListOrderedIcon,
  PencilIcon,
  SearchIcon,
  ShieldPlusIcon,
  TrophyIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  myInvitesOptions,
  myTeamRequestOptions,
  useAnswerInvite,
  type TeamInvite,
  type TeamRequest,
} from "./queries"
import { cn } from "cn"

import { STATUS_LABEL } from "./model"
import { Eyebrow, GridBackdrop, Soon, TeamCrest } from "./ui"

/** "Vence mañana" / "Vence en N días". */
function expiry(iso: string) {
  const days = differenceInCalendarDays(parseISO(iso), new Date())
  if (days <= 0) return "Vence hoy"
  if (days === 1) return "Vence mañana"
  return `Vence en ${days} días`
}

/** Sin equipo: crear o buscar uno, y las invitaciones recibidas. */
export function NoTeam({
  onCreate,
  onEdit,
  onFind,
}: {
  onCreate: () => void
  onEdit: () => void
  onFind: () => void
}) {
  const invites = useQuery(myInvitesOptions).data
  const received = (invites ?? []).filter((i) => i.kind === "invite")
  const request = useQuery(myTeamRequestOptions).data

  return (
    // Ocupa todo el alto disponible; sin invitaciones, el contenido va centrado en vertical.
    <section
      className={cn(
        "relative flex flex-1 flex-col overflow-hidden rounded-[calc(var(--radius)+8px)] border bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_12%,var(--card)),var(--card)_60%)] px-6 py-14",
        received.length === 0 && "justify-center"
      )}
    >
      <GridBackdrop />
      <div className="relative mx-auto flex max-w-[560px] flex-col items-center gap-4 text-center">
        <Eyebrow className="text-primary">Aún no tienes equipo</Eyebrow>
        <h1 className="text-[clamp(32px,5vw,52px)] leading-[1.05] font-bold tracking-[-1.8px] text-balance">
          Arma tu quinteto y entra a competir.
        </h1>
        <p className="text-base text-pretty text-muted-foreground">
          Crea un equipo oficial o acepta una invitación para inscribirte en
          torneos y sumar puntos en el ranking. Necesitas SteamID vinculado.
        </p>
        {request && request.status !== "approved" && (
          <RequestCard request={request} onEdit={onEdit} onCreate={onCreate} />
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-2.5">
          {/* Con una solicitud pendiente, la tarjeta reemplaza a "Crear equipo". */}
          {request?.status !== "pending" && (
            <Button size="xl" onClick={onCreate}>
              <ShieldPlusIcon aria-hidden />
              Crear equipo
            </Button>
          )}
          <Button size="xl" variant="outline" onClick={onFind}>
            <SearchIcon aria-hidden />
            Buscar equipo
          </Button>
        </div>
        <ul className="mt-1 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <TrophyIcon className="size-4 text-primary" aria-hidden />
            Torneos oficiales
          </li>
          <li className="flex items-center gap-1.5">
            <ListOrderedIcon className="size-4 text-primary" aria-hidden />
            Ranking de equipos
          </li>
          <li className="flex items-center gap-1.5">
            <UsersIcon className="size-4 text-primary" aria-hidden />
            Hasta 10 jugadores
          </li>
        </ul>
      </div>

      {received.length > 0 && (
        <div className="relative mx-auto mt-10 flex w-full max-w-[560px] flex-col gap-3">
          <h2 className="flex items-center gap-2">
            <Eyebrow className="text-muted-foreground">
              Invitaciones recibidas
            </Eyebrow>
            <span className="grid size-5 place-items-center rounded-full bg-primary font-mono text-[11px] font-bold text-primary-foreground">
              {received.length}
            </span>
          </h2>
          <ul className="flex flex-col gap-3">
            {received.map((invite) => (
              <InviteCard key={invite.id} invite={invite} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function InviteCard({ invite }: { invite: TeamInvite }) {
  const answer = useAnswerInvite()

  async function reply(accept: boolean) {
    try {
      await answer.mutateAsync({
        inviteId: invite.id,
        accept,
        teamId: invite.team.id,
      })
      toast.success(
        accept
          ? `Ahora eres parte de ${invite.team.name}`
          : "Invitación rechazada"
      )
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const soon =
    differenceInCalendarDays(parseISO(invite.expires_at), new Date()) <= 1
  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-left">
      <span className="flex items-center gap-3">
        <TeamCrest team={invite.team} size="sm" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{invite.team.name}</span>
          <span className="text-xs text-muted-foreground">
            {invite.invited_by
              ? `${invite.invited_by.alias} te invita como ${STATUS_LABEL[invite.role].toLowerCase()}`
              : `Te invitan como ${STATUS_LABEL[invite.role].toLowerCase()}`}
          </span>
        </span>
      </span>
      {invite.message && (
        <p className="text-[13px] text-pretty">“{invite.message}”</p>
      )}
      <span className="flex flex-wrap items-center gap-2">
        <span
          className={
            soon
              ? "flex flex-1 items-center gap-1.5 text-xs text-destructive"
              : "flex flex-1 items-center gap-1.5 text-xs text-muted-foreground"
          }
        >
          <ClockIcon className="size-3.5" aria-hidden />
          {expiry(invite.expires_at)}
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link to="/teams/$id" params={{ id: invite.team.id }}>
            Ver equipo
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={answer.isPending}
          onClick={() => void reply(false)}
        >
          Rechazar
        </Button>
        <Button
          size="sm"
          disabled={answer.isPending}
          onClick={() => void reply(true)}
        >
          <CheckIcon aria-hidden />
          Aceptar
        </Button>
      </span>
    </li>
  )
}

/** Solicitud de equipo nuevo, pendiente o rechazada: visible, con editar (y cancelar, cuando exista). */
function RequestCard({
  request,
  onEdit,
  onCreate,
}: {
  request: NonNullable<TeamRequest>
  onEdit: () => void
  onCreate: () => void
}) {
  const pending = request.status === "pending"
  return (
    <div className="mt-3 flex w-full max-w-[480px] items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-[0_1px_2px_rgb(0_0_0/.06)]">
      <TeamCrest team={request} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-semibold">{request.name}</span>
        {/* Lo que antes era el párrafo va en el tooltip del chip. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className={cn(
                "inline-flex h-[22px] w-fit cursor-help items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                pending
                  ? "bg-primary/15 text-primary"
                  : "bg-destructive/15 text-destructive"
              )}
            >
              {pending ? (
                <ClockIcon className="size-3" aria-hidden />
              ) : (
                <XIcon className="size-3" aria-hidden />
              )}
              {pending ? "Pendiente de aprobación" : "Rechazada"}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px] text-pretty">
            {pending
              ? "La revisa un admin. Cuando la apruebe, quedas como líder y primer jugador."
              : "Un admin la rechazó. Puedes corregirla y enviar otra."}
          </TooltipContent>
        </Tooltip>
      </span>
      {pending ? (
        <span className="flex shrink-0 gap-1.5">
          {/* TODO backend: DELETE /me/team-request. */}
          <Soon label="Cancelar solicitud · Próximamente">
            <Button
              variant="outline"
              size="icon"
              disabled
              aria-label="Cancelar solicitud"
            >
              <XIcon aria-hidden />
            </Button>
          </Soon>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Editar solicitud"
                onClick={onEdit}
              >
                <PencilIcon aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar solicitud</TooltipContent>
          </Tooltip>
        </span>
      ) : (
        <Button size="sm" className="shrink-0" onClick={onCreate}>
          <ShieldPlusIcon aria-hidden />
          Enviar otra
        </Button>
      )}
    </div>
  )
}
