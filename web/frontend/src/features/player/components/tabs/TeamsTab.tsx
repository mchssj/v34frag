import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { CrownIcon, SearchIcon, UsersIcon } from "lucide-react"
import { EmptyState } from "@/components/brand/EmptyState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { STATUS_LABEL } from "@/features/teams/lib/model"
import { useTeamLogos } from "@/features/teams/api/queries"
import { STATUS_CHIP, TeamCrest } from "@/features/teams/components/ui"
import { fmtMonthShort, legacyTeams, stintLength } from "../../lib/labels"
import { teamsOptions } from "../../api/queries"
import type { TeamStint } from "../../types"
import { card, Loaded } from "./shared"

// ---------- Equipos ----------

/**
 * Se puede estar en varios equipos a la vez, así que no hay línea de tiempo: los actuales como
 * tarjetas (cada una con su rol) y los anteriores en una lista.
 */
export function Teams({
  nick,
  legacy,
  owner,
}: {
  nick: string
  legacy: string | null
  owner: boolean
}) {
  const q = useQuery(teamsOptions(nick))
  const withLogo = useTeamLogos((q.data ?? []).map((s) => s.team))
  const old = legacyTeams(legacy)
  return (
    <div className={cn(card, "flex min-h-[396px] flex-col gap-3 px-5 py-4")}>
      <Loaded q={q}>
        {(items) => {
          if (!items.length)
            return (
              <EmptyState
                icon={UsersIcon}
                title="Todavía no estuvo en un equipo"
                action={
                  owner && (
                    <Button asChild variant="outline" size="sm">
                      <Link to="/myteam" search={{ view: "find" }}>
                        <SearchIcon aria-hidden />
                        Buscar equipo
                      </Link>
                    </Button>
                  )
                }
              >
                Cuando entre a un roster, su historial se arma solo con las
                altas y bajas.
              </EmptyState>
            )
          const stints = items.map((s) => ({ ...s, team: withLogo(s.team) }))
          const current = stints.filter((s) => s.left_at === null)
          const past = stints.filter((s) => s.left_at !== null)
          return (
            <>
              <GroupHead label="Actuales" count={current.length} />
              {current.length ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-2.5">
                  {current.map((s) => (
                    <CurrentTeam
                      key={`${s.team.id}-${s.joined_at ?? ""}`}
                      s={s}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  Hoy no está en ningún equipo.
                </p>
              )}
              <GroupHead label="Anteriores" count={past.length} />
              {past.length ? (
                <div className="flex flex-col">
                  {past.map((s) => (
                    <PastTeam key={`${s.team.id}-${s.joined_at ?? ""}`} s={s} />
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  Ningún equipo anterior.
                </p>
              )}
            </>
          )
        }}
      </Loaded>
      {old && (
        <div className="mt-auto flex flex-col gap-1 border-t border-dashed pt-3">
          <span className="text-xs text-muted-foreground">
            Antes de CM League
          </span>
          <span className="text-[13px] leading-relaxed">{old}</span>
        </div>
      )}
    </div>
  )
}

function GroupHead({ label, count }: { label: string; count: number }) {
  return (
    <h3 className="mt-1 flex items-center gap-2 text-[13px] font-semibold first:mt-0">
      {label}
      {count > 0 && (
        <span className="rounded-full bg-muted px-1.5 font-mono text-[11px] leading-4 text-muted-foreground">
          {count}
        </span>
      )}
    </h3>
  )
}

function CurrentTeam({ s }: { s: TeamStint }) {
  const length = stintLength(s.joined_at, null)
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-background p-3">
      <TeamCrest team={s.team} size="sm" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <Link
            to="/teams/$id"
            params={{ id: s.team.id }}
            className="truncate text-sm font-semibold hover:underline"
          >
            {s.team.name}
          </Link>
          {s.is_captain && (
            <Badge
              variant="primary"
              shape="pill"
              size="sm"
              className="font-semibold"
            >
              <CrownIcon className="size-3" aria-hidden />
              Líder
            </Badge>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {s.joined_at
            ? `Desde ${fmtMonthShort(s.joined_at)} · ${length}`
            : "Sin fecha de alta"}
        </span>
      </span>
      <StintChip role={s.role} current />
    </div>
  )
}

function PastTeam({ s }: { s: TeamStint }) {
  const length = stintLength(s.joined_at, s.left_at)
  const left = s.left_at ? fmtMonthShort(s.left_at) : ""
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-b py-2.5 last:border-b-0">
      <TeamCrest team={s.team} size="row" className="opacity-60 grayscale" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <Link
          to="/teams/$id"
          params={{ id: s.team.id }}
          className="truncate text-sm font-semibold hover:underline"
        >
          {s.team.name}
        </Link>
        <span className="text-xs text-muted-foreground">
          {s.joined_at
            ? `${fmtMonthShort(s.joined_at)} – ${left}`
            : `Hasta ${left}`}
        </span>
      </span>
      {length && (
        <span className="font-mono text-[11.5px] text-muted-foreground">
          {length}
        </span>
      )}
    </div>
  )
}

/** Rol en un equipo actual: Activo, Suplente o Coach. */
function StintChip({ role, current }: { role: string; current: boolean }) {
  const status = role === "sub" || role === "coach" ? role : "player"
  return (
    <Badge
      variant={current ? STATUS_CHIP[status] : "muted"}
      shape="pill"
      size="md"
      className="gap-1.5 text-[11px] font-semibold"
    >
      {current && status === "player" && (
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
      )}
      {current ? STATUS_LABEL[status] : "Ex integrante"}
    </Badge>
  )
}
