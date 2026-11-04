import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { TeamCrest } from "@/components/brand/TeamCrest"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { myProfileOptions } from "@/features/profile/api/queries"
import { topPlayersOptions } from "@/features/public/api/queries"
import { activeEventsOptions, topTeamsOptions } from "../api/queries"
import { Box, BoxLink } from "./Box"

const rankRow =
  "grid h-[38px] grid-cols-[18px_22px_minmax(0,1fr)_auto] items-center gap-2.5 px-4 text-[13px] hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"

/** Torneos en curso y con inscripciones abiertas. Sin ninguno, no va. */
export function EventsCard() {
  const events = useQuery(activeEventsOptions).data
  if (!events?.length) return null
  return (
    <Box title="Torneos activos" aside={<BoxLink to="/events">Todos</BoxLink>}>
      <ul>
        {events.map((e) => {
          const live = e.status === "in_progress"
          const pct = live
            ? e.progress && e.progress.total
              ? Math.round((e.progress.played / e.progress.total) * 100)
              : 0
            : e.max_teams
              ? Math.round((e.teams / e.max_teams) * 100)
              : 0
          return (
            <li key={e.id} className="border-t">
              <Link
                to="/events/$id"
                params={{ id: e.id }}
                className="flex flex-col gap-1.5 px-4 py-2.5 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className="flex items-center gap-2">
                  <b className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                    {e.name}
                  </b>
                  <Badge variant={live ? "solid" : "soft"}>
                    {live ? "En curso" : "Inscripciones"}
                  </Badge>
                </span>
                <span className="text-xs text-muted-foreground">
                  {live
                    ? (e.current_stage ?? "En juego")
                    : `${e.teams}/${e.max_teams} equipos`}
                </span>
                <Progress
                  value={pct}
                  aria-label={live ? "Partidas jugadas" : "Cupos ocupados"}
                  indicatorClassName={live ? undefined : "bg-muted-foreground"}
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </Box>
  )
}

/** Top 5 del ranking de equipos; el tuyo, resaltado. */
export function TopTeamsCard() {
  const teams = useQuery(topTeamsOptions).data
  const mine = new Set(
    useQuery(myProfileOptions).data?.teams.map((t) => t.id) ?? []
  )
  return (
    <Box
      title="Ranking de equipos"
      aside={<BoxLink to="/ranking/teams">Tabla</BoxLink>}
    >
      {!teams ? (
        <Skeleton className="mx-4 mb-4 h-44 rounded-lg" />
      ) : (
        <ol>
          {teams.map((r) => (
            <li key={r.team.id} className="border-t">
              <Link
                to="/teams/$id"
                params={{ id: r.team.id }}
                className={cn(rankRow, mine.has(r.team.id) && "bg-primary/6")}
              >
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  {r.position}
                </span>
                <TeamCrest team={r.team} size="xs" />
                <span className="truncate">{r.team.name}</span>
                <span className="font-mono tabular-nums">{r.points}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Box>
  )
}

/** Top 5 de jugadores por ELO. */
export function TopPlayersCard() {
  const players = useQuery(topPlayersOptions).data
  return (
    <Box
      title="Top jugadores"
      aside={<BoxLink to="/ranking">Ver todos</BoxLink>}
    >
      {!players ? (
        <Skeleton className="mx-4 mb-4 h-44 rounded-lg" />
      ) : (
        <ol>
          {players.map((p, i) => (
            <li key={p.id} className="border-t">
              <Link
                to="/player/$nick"
                params={{ nick: p.alias }}
                className={rankRow}
              >
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                {p.level !== null ? (
                  <LevelBadge level={p.level} size={22} />
                ) : (
                  <span />
                )}
                <span className="truncate">{p.alias}</span>
                <span className="font-mono tabular-nums">{p.elo ?? "—"}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Box>
  )
}
