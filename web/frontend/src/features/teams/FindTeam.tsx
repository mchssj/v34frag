import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CheckIcon,
  LockIcon,
  SearchIcon,
  UserPlusIcon,
} from "lucide-react"
import { useDeferredValue, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { joinState, lookingForText, MAX_ROSTER, rankOf } from "./model"
import {
  myInvitesOptions,
  teamRankingOptions,
  teamSearchOptions,
  useCancelJoin,
  useJoinTeam,
  type TeamInvite,
  type TeamSummary,
} from "./queries"
import { TeamCrest } from "./ui"

type LookingFor = TeamSummary["looking_for"][number]

const FILTERS: { id: LookingFor | null; label: string }[] = [
  { id: null, label: "Todos" },
  { id: "player", label: "Buscan activo" },
  { id: "sub", label: "Buscan suplente" },
  { id: "coach", label: "Buscan coach" },
]

/** Buscar equipo: pedir entrar a un equipo oficial. */
export function FindTeam({
  onBack,
  myTeamIds,
}: {
  onBack: () => void
  myTeamIds: string[]
}) {
  const [query, setQuery] = useState("")
  const deferred = useDeferredValue(query.trim())
  const [filter, setFilter] = useState<LookingFor | null>(null)
  const teams = useQuery(teamSearchOptions(deferred, filter ? [filter] : []))
  const ranking = useQuery(teamRankingOptions).data
  const invites = useQuery(myInvitesOptions).data
  const requests = (invites ?? []).filter((i) => i.kind === "request")

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Volver"
          onClick={onBack}
        >
          <ArrowLeftIcon aria-hidden />
        </Button>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold tracking-[-0.5px]">
            Buscar equipo
          </h1>
          <p className="text-sm text-muted-foreground">
            Pide entrar y el capitán te responde. El pedido vence a los 7 días.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="relative min-w-[220px] flex-[1_1_380px]">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre o sigla del equipo"
            aria-label="Nombre o sigla del equipo"
            className="h-9 pl-9"
          />
        </span>
        <div
          role="group"
          className="flex flex-wrap gap-1.5"
          aria-label="Filtros"
        >
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                filter === f.id
                  ? "border-foreground bg-foreground text-background"
                  : "hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {teams.isPending ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[170px] rounded-hero" />
          ))}
        </div>
      ) : (teams.data ?? []).length === 0 ? (
        <p className="rounded-hero border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
          No hay equipos que coincidan con la búsqueda.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
          {teams.data!.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              rank={rankOf(ranking, t.id)}
              isMember={myTeamIds.includes(t.id)}
              request={requests.find((r) => r.team.id === t.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function TeamCard({
  team,
  rank,
  isMember,
  request,
}: {
  team: TeamSummary
  rank: number | null
  isMember: boolean
  request: TeamInvite | undefined
}) {
  const join = useJoinTeam()
  const cancel = useCancelJoin()
  const state = joinState({
    signedIn: true,
    isMember,
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
    <li className="flex flex-col overflow-hidden rounded-hero border bg-card">
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <TeamCrest team={team} size="sm" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold">{team.name}</span>
            <span className="text-xs text-muted-foreground">
              {team.members}/{team.max_members ?? MAX_ROSTER} en el roster
            </span>
          </span>
          <span className="flex flex-col items-end">
            <span className="font-mono text-sm font-bold">
              {rank ? `#${rank}` : "—"}
            </span>
            <span className="text-[11px] text-muted-foreground">ranking</span>
          </span>
        </div>
        {team.looking_for.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Qué busca">
            {team.looking_for.map((w) => (
              <li
                key={w}
                className="inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium"
              >
                <span className="size-1.5 rounded-full bg-win" aria-hidden />
                {lookingForText(w)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            {state === "full"
              ? "Roster completo"
              : "No está buscando jugadores"}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-4 py-2.5">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
        >
          <Link to="/teams/$id" params={{ id: team.id }}>
            Ver equipo
            <ArrowUpRightIcon aria-hidden />
          </Link>
        </Button>
        {state === "join" && (
          <Button
            size="sm"
            disabled={join.isPending}
            onClick={() => void ask()}
            className="bg-foreground text-background hover:bg-foreground/85"
          >
            <UserPlusIcon aria-hidden />
            Pedir entrar
          </Button>
        )}
        {state === "sent" && (
          <Button
            size="sm"
            variant="outline"
            disabled={cancel.isPending}
            onClick={() => void withdraw()}
            aria-label={`Pedido enviado a ${team.name}. Tocar para cancelar`}
            className={cn("border-win text-win hover:text-win")}
          >
            <CheckIcon aria-hidden />
            Pedido enviado
          </Button>
        )}
        {state === "full" && (
          <Button size="sm" variant="outline" disabled>
            <LockIcon aria-hidden />
            Completo
          </Button>
        )}
        {state === "member" && (
          <Button size="sm" variant="outline" disabled>
            <CheckIcon aria-hidden />
            Tu equipo
          </Button>
        )}
      </div>
    </li>
  )
}
