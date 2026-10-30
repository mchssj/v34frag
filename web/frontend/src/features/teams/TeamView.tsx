import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate, useRouter } from "@tanstack/react-router"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "cn"
import {
  ArrowLeftIcon,
  CheckIcon,
  EllipsisIcon,
  LockIcon,
  LogOutIcon,
  MegaphoneIcon,
  PencilIcon,
  UserPlusIcon,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { useMe } from "@/auth/queries"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorAlert } from "@/features/auth/ui"
import { InviteDrawer } from "./InviteDrawer"
import {
  heirsOf,
  joinState,
  MAX_ROSTER,
  rankOf,
  STATUS_LABEL,
  statusOf,
  titlesOf,
  winRate,
} from "./model"
import {
  championsOptions,
  myInvitesOptions,
  teamDetailOptions,
  teamMembersOptions,
  teamRankingOptions,
  useCancelJoin,
  useJoinTeam,
  useLeaveTeam,
  useTransferCaptain,
  type RosterEntry,
  type TeamDetail,
} from "./queries"
import { Roster } from "./Roster"
import { LookingForTags, RecruitSheet } from "./Recruit"
import { EditableCrest, EditTeamSheet } from "./TeamLogo"
import {
  JoinRequests,
  RecentForm,
  Showcase,
  StarPlayer,
  TeamKpis,
  TeamRoles,
  TournamentHistory,
} from "./sections"
import { Eyebrow, Initial, Soon, TeamCrest } from "./ui"

/** Desde cuándo existe el equipo (`founded_at`: la aprobación o, en los viejos, el primer ingreso). */
const foundedLabel = (iso: string | null) =>
  iso ? format(parseISO(iso), "MMM yyyy", { locale: es }) : null

/**
 * Vista de un equipo. `mine`: Mi equipo, con la gestión si el usuario es el líder. `public`:
 * cualquier equipo en solo lectura, con "Pedir entrar".
 */
export function TeamView({
  teamId,
  mode,
  switcher,
}: {
  teamId: string
  mode: "mine" | "public"
  switcher?: ReactNode
}) {
  const detail = useQuery(teamDetailOptions(teamId))
  const members = useQuery(teamMembersOptions(teamId))
  const ranking = useQuery(teamRankingOptions).data
  const champions = useQuery(championsOptions).data
  const [editing, setEditing] = useState(false)

  if (detail.isError || members.isError)
    return <ErrorAlert message={errorMessage(detail.error ?? members.error)} />
  if (!detail.data || !members.data) return <TeamSkeleton />

  const team = detail.data
  const roster = members.data
  const isLeader = mode === "mine" && !!team.viewer?.is_captain
  const titles = titlesOf(champions, team.id)
  const founded = foundedLabel(team.founded_at)

  return (
    <div className="flex flex-col gap-5">
      {switcher}
      <section className="overflow-hidden rounded-[calc(var(--radius)+8px)] border bg-[linear-gradient(120deg,color-mix(in_oklch,var(--primary)_9%,var(--card)),var(--card)_55%)]">
        <div className="flex flex-wrap items-center gap-6 p-6 sm:p-7">
          {isLeader ? (
            <EditableCrest team={team} onEdit={() => setEditing(true)} />
          ) : (
            <TeamCrest team={team} size="lg" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Eyebrow className="text-primary">
              {mode === "mine" ? "Mi equipo" : "Equipo"}
              {founded && ` · desde ${founded}`}
            </Eyebrow>
            <h1 className="text-[clamp(28px,4vw,44px)] leading-[1.05] font-bold tracking-[-1.5px] break-words">
              {team.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {team.captain ? (
                <>
                  Líder{" "}
                  <span className="font-semibold text-foreground">
                    {team.captain.alias}
                  </span>
                </>
              ) : (
                "Sin líder"
              )}{" "}
              · {roster.length}/{team.max_members ?? MAX_ROSTER} en el roster ·{" "}
              {titles.length === 1 ? "1 título" : `${titles.length} títulos`}
            </p>
            <LookingForTags team={team} />
          </div>
          {mode === "mine" ? (
            <MineActions
              team={team}
              roster={roster}
              isLeader={isLeader}
              onEdit={() => setEditing(true)}
            />
          ) : (
            <PublicActions team={team} />
          )}
        </div>
        <TeamKpis
          rank={rankOf(ranking, team.id)}
          points={team.record?.official.points ?? 0}
          winRate={winRate(team.record)}
          titles={titles.length}
          eventsPlayed={team.record?.events_played ?? 0}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <TeamRoles members={roster} />
        <div className="flex min-w-0 flex-col gap-5">
          <StarPlayer teamId={team.id} />
          <RecentForm teamId={team.id} />
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Roster
          teamId={team.id}
          teamName={team.name}
          members={roster}
          maxMembers={team.max_members}
          isLeader={isLeader}
        />
        {isLeader && <JoinRequests teamId={team.id} />}
      </div>

      <Showcase
        titles={titles}
        eventsPlayed={team.record?.events_played ?? 0}
      />
      <TournamentHistory teamId={team.id} />
      {isLeader && (
        <EditTeamSheet team={team} open={editing} onOpenChange={setEditing} />
      )}
    </div>
  )
}

function MineActions({
  team,
  roster,
  isLeader,
  onEdit,
}: {
  team: TeamDetail
  roster: RosterEntry[]
  isLeader: boolean
  onEdit: () => void
}) {
  const [inviting, setInviting] = useState(false)
  const [recruiting, setRecruiting] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const wanted = team.looking_for.length

  return (
    <div className="flex flex-wrap gap-2">
      {isLeader ? (
        <>
          <Button onClick={() => setInviting(true)}>
            <UserPlusIcon aria-hidden />
            Invitar jugador
          </Button>
          <Button
            variant="outline"
            className="border-primary/60 text-primary hover:text-primary"
            onClick={() => setRecruiting(true)}
          >
            <MegaphoneIcon aria-hidden />
            Reclutar
            {wanted > 0 && (
              <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground">
                {wanted}
              </span>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Más acciones">
                <EllipsisIcon aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onSelect={onEdit} className="whitespace-nowrap">
                <PencilIcon aria-hidden />
                Editar equipo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setLeaving(true)}
                className="whitespace-nowrap"
              >
                <LogOutIcon aria-hidden />
                Salir del equipo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <InviteDrawer
            open={inviting}
            onOpenChange={setInviting}
            teamId={team.id}
            teamName={team.name}
            memberIds={roster.map((m) => m.player_id)}
            maxMembers={team.max_members}
          />
          <RecruitSheet
            team={team}
            open={recruiting}
            onOpenChange={setRecruiting}
          />
        </>
      ) : (
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setLeaving(true)}
        >
          Salir del equipo
        </Button>
      )}
      {leaving &&
        (isLeader ? (
          <LeaderLeaveDialog
            team={team}
            roster={roster}
            onInvite={() => {
              setLeaving(false)
              setInviting(true)
            }}
            onClose={() => setLeaving(false)}
          />
        ) : (
          <LeaveDialog team={team} onClose={() => setLeaving(false)} />
        ))}
    </div>
  )
}

/** Salir siendo miembro (no líder). */
function LeaveDialog({
  team,
  onClose,
}: {
  team: TeamDetail
  onClose: () => void
}) {
  const leave = useLeaveTeam()
  const navigate = useNavigate()

  async function run() {
    try {
      await leave.mutateAsync(team.id)
      toast.success(`Saliste de ${team.name}`)
      onClose()
      await navigate({ to: "/myteam", search: {}, replace: true })
    } catch {
      // Se muestra en el diálogo.
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[420px]">
        <div className="flex flex-col gap-1.5">
          <DialogTitle className="text-base font-semibold">
            Salir de {team.name}
          </DialogTitle>
          <DialogDescription className="text-pretty">
            Quedas como ex integrante en el historial del equipo. Para volver
            necesitas una invitación nueva.
          </DialogDescription>
        </div>
        {leave.error != null && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(leave.error)}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={leave.isPending}
            onClick={() => void run()}
          >
            Salir del equipo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * El líder sale: antes elige quién queda como líder (el backend lo exige y el equipo no queda
 * huérfano). "Ceder y salir" cede el liderazgo y después sale. Si nadie puede quedar (es el único
 * o nadie más tiene SteamID), ofrece invitar; disolver el equipo espera al backend.
 */
function LeaderLeaveDialog({
  team,
  roster,
  onInvite,
  onClose,
}: {
  team: TeamDetail
  roster: RosterEntry[]
  onInvite: () => void
  onClose: () => void
}) {
  const heirs = heirsOf(roster)
  const eligible = heirs.filter((h) => h.eligible)
  const [heir, setHeir] = useState(eligible[0]?.member.player_id)
  const transfer = useTransferCaptain()
  const leave = useLeaveTeam()
  const navigate = useNavigate()
  const busy = transfer.isPending || leave.isPending
  const error = transfer.error ?? leave.error
  const chosen = eligible.find((h) => h.member.player_id === heir)?.member

  async function run() {
    if (!chosen) return
    try {
      await transfer.mutateAsync({
        teamId: team.id,
        playerId: chosen.player_id,
      })
      await leave.mutateAsync(team.id)
      toast.success(
        `${chosen.alias} es el nuevo líder. Saliste de ${team.name}`
      )
      onClose()
      await navigate({ to: "/myteam", search: {}, replace: true })
    } catch {
      // Se muestra en el diálogo.
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[460px]">
        {eligible.length === 0 ? (
          <>
            <div className="flex flex-col gap-1.5">
              <DialogTitle className="text-base font-semibold">
                No hay quién quede como líder
              </DialogTitle>
              <DialogDescription className="text-pretty">
                {heirs.length === 0
                  ? `Eres el único miembro de ${team.name}.`
                  : `Nadie más en ${team.name} tiene su SteamID vinculado.`}{" "}
                Para salir, invita a alguien y cédele el liderazgo. Disolver el
                equipo todavía no está disponible.
              </DialogDescription>
            </div>
            <DialogFooter>
              <Soon>
                <Button variant="destructive" disabled>
                  Disolver equipo
                </Button>
              </Soon>
              <Button onClick={onInvite}>
                <UserPlusIcon aria-hidden />
                Invitar jugador
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <DialogTitle className="text-base font-semibold">
                Antes de salir, elige quién queda como líder
              </DialogTitle>
              <DialogDescription className="text-pretty">
                Va a invitar jugadores, gestionar el roster e inscribir a{" "}
                {team.name} en torneos. Necesita su SteamID vinculado.
              </DialogDescription>
            </div>
            <div
              role="radiogroup"
              aria-label="Nuevo líder"
              className="flex max-h-[min(50vh,360px)] flex-col gap-1.5 overflow-y-auto"
            >
              {heirs.map(({ member: m, eligible: ok }) => (
                <button
                  key={m.player_id}
                  type="button"
                  role="radio"
                  aria-checked={m.player_id === heir}
                  disabled={!ok}
                  onClick={() => setHeir(m.player_id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                    m.player_id === heir
                      ? "border-primary bg-primary/8"
                      : "enabled:hover:bg-muted/60"
                  )}
                >
                  <Initial
                    name={m.alias}
                    photo={m.photo_url}
                    className="size-8"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {m.alias}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ok
                        ? [STATUS_LABEL[statusOf(m)], m.game_role]
                            .filter(Boolean)
                            .join(" · ")
                        : "Sin SteamID vinculado"}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0 rounded-full border",
                      m.player_id === heir &&
                        "border-primary shadow-[inset_0_0_0_4px_var(--primary)]"
                    )}
                  />
                </button>
              ))}
            </div>
            {error != null && (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage(error)}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={!chosen || busy}
                onClick={() => void run()}
              >
                Ceder a {chosen?.alias} y salir
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Acciones de la vista pública: volver y el botón de pedido según el estado. */
function PublicActions({ team }: { team: TeamDetail }) {
  const router = useRouter()
  const signedIn = !!useMe().data
  const invites = useQuery({ ...myInvitesOptions, enabled: signedIn }).data
  const request = invites?.find(
    (i) => i.kind === "request" && i.team.id === team.id
  )
  const join = useJoinTeam()
  const cancel = useCancelJoin()
  const state = joinState({
    signedIn,
    isMember: !!team.viewer?.is_member,
    members: team.members,
    maxMembers: team.max_members,
    hasRequest: !!request,
  })

  async function ask() {
    try {
      await join.mutateAsync(team.id)
      toast.success(`Pedido enviado a ${team.name}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function withdraw() {
    if (!request) return
    try {
      await cancel.mutateAsync({ requestId: request.id, teamId: team.id })
      toast("Pedido cancelado")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" onClick={() => router.history.back()}>
        <ArrowLeftIcon aria-hidden />
        Volver
      </Button>
      {state === "signin" && (
        <Button asChild>
          <Link to="/login" search={{ redirect: `/teams/${team.id}` }}>
            Inicia sesión para pedir entrar
          </Link>
        </Button>
      )}
      {state === "join" && (
        <Button disabled={join.isPending} onClick={() => void ask()}>
          <UserPlusIcon aria-hidden />
          Pedir entrar
        </Button>
      )}
      {state === "sent" && (
        <>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-win px-2.5 text-sm font-medium text-win">
            <CheckIcon className="size-4" aria-hidden />
            Pedido enviado
          </span>
          <Button
            variant="outline"
            disabled={cancel.isPending}
            onClick={() => void withdraw()}
          >
            Cancelar
          </Button>
        </>
      )}
      {state === "member" && (
        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-win/15 px-2.5 text-sm font-medium text-win">
          <CheckIcon className="size-4" aria-hidden />
          Eres parte de este equipo
        </span>
      )}
      {state === "full" && (
        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-muted px-2.5 text-sm font-medium text-muted-foreground">
          <LockIcon className="size-4" aria-hidden />
          Roster completo
        </span>
      )}
    </div>
  )
}

function TeamSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <Skeleton className="h-[230px] rounded-[calc(var(--radius)+8px)]" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-[540px] rounded-hero" />
        <Skeleton className="h-[540px] rounded-hero" />
      </div>
    </div>
  )
}
