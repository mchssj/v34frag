import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { isToday, parseISO } from "date-fns"
import { cn } from "cn"
import { SwordsIcon } from "lucide-react"

import { EmptyState } from "@/components/brand/EmptyState"
import { KindBadge } from "@/components/brand/KindBadge"
import { Skeleton } from "@/components/ui/skeleton"
import { fmtDay, fmtTime } from "@/features/mixes/lib/labels"
import { recentMatchesOptions } from "@/features/player/api/queries"
import { myProfileOptions } from "@/features/profile/api/queries"
import { upcomingMatchesOptions } from "../api/queries"
import { Box, BoxLink } from "./Box"

const row =
  "grid h-[42px] items-center gap-2.5 px-4 text-[13px] whitespace-nowrap hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"

/** "Próximas partidas": las 4 más cercanas, con las de tus equipos resaltadas. Sin ninguna, no va. */
export function UpcomingCard() {
  const matches = useQuery(upcomingMatchesOptions).data
  const mine = new Set(
    useQuery(myProfileOptions).data?.teams.map((t) => t.id) ?? []
  )
  if (!matches?.length) return null

  return (
    <Box
      title="Próximas partidas"
      aside={<BoxLink to="/events">Torneos</BoxLink>}
    >
      <ul>
        {matches.map((m) => {
          const at = m.starts_at
          const ours = (s: typeof m.side1) => !!s.team && mine.has(s.team.id)
          return (
            <li key={m.id} className="border-t">
              <Link
                to="/match/$id"
                params={{ id: m.id }}
                className={cn(
                  row,
                  "grid-cols-[64px_minmax(0,1fr)_18px_minmax(0,1fr)] sm:grid-cols-[74px_minmax(0,1fr)_18px_minmax(0,1fr)_minmax(0,1.2fr)]"
                )}
              >
                <span className="flex flex-col text-xs leading-tight">
                  <b className="font-mono text-[12.5px]">
                    {!at ? "—" : isToday(parseISO(at)) ? "Hoy" : fmtDay(at)}
                  </b>
                  {at && fmtTime(at)}
                </span>
                <span
                  className={cn(
                    "truncate text-right",
                    ours(m.side1) && "font-semibold text-primary"
                  )}
                >
                  {m.side1.name ?? "Por definir"}
                </span>
                <span className="text-center text-muted-foreground">vs</span>
                <span
                  className={cn(
                    "truncate",
                    ours(m.side2) && "font-semibold text-primary"
                  )}
                >
                  {m.side2.name ?? "Por definir"}
                </span>
                <span className="hidden truncate text-muted-foreground sm:block">
                  {[m.event?.name ?? (m.kind === "pcw" ? "PCW" : ""), m.label]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Box>
  )
}

/** "Tus últimas partidas": las 5 más nuevas del jugador, con su rating y su cambio de ELO. */
export function RecentCard() {
  const nick = useQuery(myProfileOptions).data?.player?.nick
  const recent = useQuery({
    ...recentMatchesOptions(nick ?? ""),
    enabled: !!nick,
  })
  if (!nick) return null

  return (
    <Box
      title="Tus últimas partidas"
      aside={
        <BoxLink
          to="/player/$nick"
          params={{ nick }}
          search={{ tab: "partidas" }}
        >
          Ver todas
        </BoxLink>
      }
    >
      {recent.isPending ? (
        <Skeleton className="mx-4 mb-4 h-40 rounded-lg" />
      ) : !recent.data?.length ? (
        <EmptyState
          icon={SwordsIcon}
          title="Todavía no jugaste partidas"
          className="border-t"
        >
          Aparecen acá al jugar un mix, una partida del matchmaking o un partido
          de torneo.
        </EmptyState>
      ) : (
        <ul>
          {recent.data.slice(0, 5).map((m) => {
            const mineIs1 = m.side === 1
            const won1 = m.won === null ? null : mineIs1 ? m.won : !m.won
            return (
              <li key={m.match_id} className="border-t">
                <Link
                  to="/match/$id"
                  params={{ id: m.match_id }}
                  className={cn(
                    row,
                    "grid-cols-[minmax(0,1fr)_54px_minmax(0,1fr)] sm:grid-cols-[120px_minmax(0,1fr)_62px_minmax(0,1fr)_minmax(0,1fr)]"
                  )}
                >
                  <span className="hidden items-center gap-1.5 truncate font-mono sm:flex">
                    <KindBadge kind={m.kind} />
                    {m.map ?? "—"}
                  </span>
                  <span
                    className={cn(
                      "truncate text-right",
                      won1 === true
                        ? "font-semibold"
                        : won1 === false && "text-muted-foreground"
                    )}
                  >
                    {m.side1_name ?? "Bando 1"}
                  </span>
                  <span className="text-center font-mono">
                    <span
                      className={
                        won1 === true
                          ? "font-semibold text-win"
                          : "text-muted-foreground"
                      }
                    >
                      {m.score1 ?? 0}
                    </span>
                    <span className="text-muted-foreground"> : </span>
                    <span
                      className={
                        won1 === false
                          ? "font-semibold text-win"
                          : "text-muted-foreground"
                      }
                    >
                      {m.score2 ?? 0}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "truncate",
                      won1 === false
                        ? "font-semibold"
                        : won1 === true && "text-muted-foreground"
                    )}
                  >
                    {m.side2_name ?? "Bando 2"}
                  </span>
                  <span className="hidden truncate text-muted-foreground sm:block">
                    <span className="font-mono">
                      {m.rating?.toFixed(2) ?? "—"}
                    </span>{" "}
                    rating
                    {m.elo_delta !== null && (
                      <>
                        {" · "}
                        <span
                          className={cn(
                            "font-mono font-semibold",
                            m.elo_delta >= 0 ? "text-win" : "text-destructive"
                          )}
                        >
                          {m.elo_delta >= 0 ? "+" : ""}
                          {m.elo_delta}
                        </span>
                      </>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Box>
  )
}
