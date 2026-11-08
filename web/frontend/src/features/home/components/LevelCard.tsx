import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { LinkIcon } from "lucide-react"

import { EmptyState } from "@/components/brand/EmptyState"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  eloHistoryOptions,
  playerOptions,
  recentMatchesOptions,
} from "@/features/player/api/queries"
import { myProfileOptions } from "@/features/profile/api/queries"
import { levelProgress, weekDelta, winRate } from "../lib/home"
import { Box, BoxLink } from "./Box"
import { EloChart } from "./EloChart"

/** Partidas de la gráfica; el cambio de la semana se suma sobre más, por si jugó mucho. */
const CHART = 12
const HISTORY = 50

export function LevelCard() {
  const profile = useQuery(myProfileOptions)
  const nick = profile.data?.player?.nick

  if (profile.isPending)
    return (
      <Box title="Tu nivel">
        <Skeleton className="mx-4 mb-4 h-56 rounded-lg" />
      </Box>
    )
  if (!nick)
    return (
      <Box title="Tu nivel">
        <EmptyState
          icon={LinkIcon}
          title="Todavía no tienes nivel"
          className="border-t"
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/profile/link">Vincular</Link>
            </Button>
          }
        >
          Vincula tu SteamID con <span className="font-mono">!claim</span> en el
          servidor para que tus partidas sumen ELO.
        </EmptyState>
      </Box>
    )
  return <LevelBody nick={nick} />
}

function LevelBody({ nick }: { nick: string }) {
  const player = useQuery(playerOptions(nick))
  const history = useQuery(eloHistoryOptions(nick, HISTORY))
  const recent = useQuery(recentMatchesOptions(nick))
  const p = player.data

  return (
    <Box
      title="Tu nivel"
      aside={
        <BoxLink to="/player/$nick" params={{ nick }}>
          Ver perfil
        </BoxLink>
      }
    >
      {!p ? (
        <Skeleton className="mx-4 mb-4 h-56 rounded-lg" />
      ) : (
        <div className="flex flex-1 flex-col gap-3.5 px-4 pb-4">
          <div className="flex items-center gap-3">
            {p.level !== null && <LevelBadge level={p.level} size={48} />}
            <div className="flex flex-col">
              <span className="font-mono text-2xl font-semibold tracking-[-0.5px] tabular-nums">
                {p.elo ?? "—"}{" "}
                <span className="font-sans text-xs font-medium text-muted-foreground">
                  ELO
                </span>
              </span>
              <WeekDelta points={history.data} />
            </div>
            <span className="flex-1" />
            <LastFive results={recent.data?.slice(0, 5).map((m) => m.won)} />
          </div>
          {history.data && history.data.length > 1 ? (
            <EloChart points={history.data.slice(-CHART)} />
          ) : (
            <p className="flex-1 text-xs text-muted-foreground">
              La gráfica aparece después de tu segunda partida.
            </p>
          )}
          {p.level !== null && p.elo !== null && (
            <LevelBar level={p.level} elo={p.elo} />
          )}
          <dl className="grid grid-cols-3 rounded-lg border">
            <Figure label="Rating" value={p.rating?.toFixed(2)} />
            <Figure label="K/D" value={p.kd?.toFixed(2)} />
            <Figure
              label="Victorias"
              value={(() => {
                const w = winRate(p.wins, p.losses)
                return w === null ? undefined : `${w}%`
              })()}
            />
          </dl>
        </div>
      )}
    </Box>
  )
}

function WeekDelta({
  points,
}: {
  points?: { at: string | null; elo_delta: number | null }[]
}) {
  if (!points) return null
  const d = weekDelta(points, new Date())
  if (!d)
    return (
      <span className="text-xs text-muted-foreground">
        Sin cambios esta semana
      </span>
    )
  return (
    <span
      className={cn(
        "text-xs font-semibold",
        d > 0 ? "text-win" : "text-destructive"
      )}
    >
      {d > 0 ? "+" : ""}
      {d} esta semana
    </span>
  )
}

function LastFive({ results }: { results?: (boolean | null)[] }) {
  if (!results?.length) return null
  const text = results.map((r) => (r ? "V" : r === false ? "D" : "E"))
  return (
    <span
      aria-label={`Últimos ${text.length}: ${text.join(" ")}`}
      className="flex gap-1"
    >
      {text.map((t, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "grid size-5 place-items-center rounded-[5px] font-mono text-[10px] font-bold",
            t === "V"
              ? "bg-win/18 text-win"
              : t === "D"
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground"
          )}
        >
          {t}
        </span>
      ))}
    </span>
  )
}

function LevelBar({ level, elo }: { level: number; elo: number }) {
  const { pct, toNext } = levelProgress(level, elo)
  return (
    <div className="flex flex-col gap-1.5">
      <Progress value={pct} aria-label={`Avance del nivel ${level}`} />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Nivel {level}</span>
        {toNext === null ? (
          <span>Nivel máximo</span>
        ) : (
          <span>
            Faltan <b className="font-mono text-foreground">{toNext} ELO</b>{" "}
            para nivel {level + 1}
          </span>
        )}
      </div>
    </div>
  )
}

function Figure({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col-reverse gap-px px-2.5 py-2 [&+&]:border-l">
      <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
      <dd className="font-mono text-[15px] font-semibold tabular-nums">
        {value ?? "—"}
      </dd>
    </div>
  )
}
