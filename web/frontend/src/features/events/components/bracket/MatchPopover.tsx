import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { useState, type ReactElement } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { matchDetailOptions } from "@/features/shell/api/queries"
import { useIsMobile } from "@/hooks/use-mobile"
import { originOf } from "../../lib/bracket"
import { sidesOf, type Side } from "../../lib/model"
import type { EventMatch } from "../../types"
import { TagBox } from "../ui"
import { useBracket } from "./context"

/**
 * Detalle resumido de una partida de la Llave: se abre al hacer clic en la tarjeta (en el
 * teléfono, como hoja desde abajo). Los mapas, el servidor y las alineaciones se piden al abrir.
 */
export function MatchPopover({
  match,
  children,
}: {
  match: EventMatch
  children: ReactElement
}) {
  const mobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const title = sidesOf(match)
    .map((s) => s.name)
    .join(" contra ")

  if (mobile)
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{children}</SheetTrigger>
        <SheetContent
          side="bottom"
          aria-describedby={undefined}
          className="max-h-[85svh] gap-0 overflow-y-auto rounded-t-2xl p-0"
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {open && <MatchSummary match={match} sheet />}
        </SheetContent>
      </Sheet>
    )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        collisionPadding={12}
        aria-label={title}
        className="max-h-(--radix-popover-content-available-height) w-[340px] gap-0 overflow-y-auto rounded-xl p-0"
      >
        <MatchSummary match={match} />
      </PopoverContent>
    </Popover>
  )
}

function stateText(m: EventMatch) {
  if (m.status === "live") return "En vivo"
  if (m.status === "cancelled") return "Cancelada"
  if (m.status === "finished")
    return m.end_reason === "walkover" ? "Terminada por W.O." : "Terminada"
  return m.starts_at
    ? format(parseISO(m.starts_at), "EEE d MMM, HH:mm", { locale: es })
    : "Por jugar"
}

function MatchSummary({
  match,
  sheet,
}: {
  match: EventMatch
  /** En la hoja del teléfono: deja lugar para la X de cerrar. */
  sheet?: boolean
}) {
  const { all, seeds } = useBracket()
  const detail = useQuery({
    ...matchDetailOptions(match.id),
    staleTime: 30_000,
  })
  const d = detail.data
  const sides = sidesOf(match)
  const played = match.status === "finished" || match.status === "live"
  const meta = [
    match.label,
    `BO${match.best_of}`,
    stateText(match),
    d?.server?.name,
  ].filter(Boolean)
  const missing = ([1, 2] as const).filter((n) => !sides[n - 1].teamId)
  const advantage = d?.advantage_side ? sides[d.advantage_side - 1] : null
  const maps = d?.maps_detail.filter((x) => x.r1 != null || x.r2 != null) ?? []
  // Con juegos terminados, los que jugaron con el rating de la serie (E21); si no (sin jugar o con
  // el resultado a mano), los inscritos con su rating de las últimas 4 semanas en 5v5 (replanteo 44).
  const series = d?.series_players ?? []
  const lineupOf = (n: 1 | 2): Lineup[] => {
    if (!d) return []
    const played = series.filter((p) => p.side === n)
    if (played.length > 0)
      return played.map((p) => ({
        name: p.alias ?? p.game_nick ?? "Jugador",
        rating: p.rating,
      }))
    return (n === 1 ? d.roster1 : d.roster2).map((p) => ({
      name: p.alias,
      rating: p.rating ?? null,
    }))
  }
  const rosters = d ? [lineupOf(1), lineupOf(2)] : null
  const lineups = rosters && (rosters[0].length > 0 || rosters[1].length > 0)
  const rated = series.length > 0
  const recentRated =
    !rated && !!d && [...d.roster1, ...d.roster2].some((p) => p.rating != null)
  // Todos los mapas cargados a mano (sin mix vinculado): no hay stats de jugadores.
  const manualOnly = maps.length > 0 && maps.every((x) => !x.game_id)

  return (
    <div className="flex flex-col text-sm">
      <div
        className={cn(
          "grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3.5 pt-4 pb-3",
          sheet && "px-12 pt-6"
        )}
      >
        <TeamHead side={sides[0]} seed={seed(seeds, sides[0])} />
        {played ? (
          <div className="flex gap-1.5 font-mono text-2xl font-bold tabular-nums">
            <Score side={sides[0]} />
            <span className="text-muted-foreground">:</span>
            <Score side={sides[1]} />
          </div>
        ) : (
          <span className="text-base text-muted-foreground">vs</span>
        )}
        <TeamHead side={sides[1]} seed={seed(seeds, sides[1])} />
      </div>
      <p className="border-b px-3.5 pb-3 text-center text-xs text-muted-foreground">
        {meta.join(" · ")}
      </p>

      {advantage && (
        <Section>
          <p className="text-[13px] text-muted-foreground">
            {advantage.name} empezó 1:0 por el mapa de ventaja del upper.
          </p>
        </Section>
      )}

      {missing.length > 0 && (
        <Section title="Quién juega">
          {missing.map((n) => (
            <p key={n} className="text-[13px] text-muted-foreground">
              {originOf(match, n, all) ?? "Por definir"}
            </p>
          ))}
        </Section>
      )}

      {played && (
        <Section title="Mapas">
          {detail.isPending ? (
            <Skeleton className="h-5 w-full" />
          ) : maps.length === 0 && !d?.live ? (
            <p className="text-[13px] text-muted-foreground">
              Sin mapas cargados.
            </p>
          ) : (
            <>
              {maps.map((x, i) => (
                <MapRow
                  key={i}
                  map={x.map}
                  r1={x.r1}
                  r2={x.r2}
                  manual={!x.game_id}
                />
              ))}
              {manualOnly && (
                <p className="text-xs text-muted-foreground">
                  Sin detalle de la partida: el resultado se cargó a mano, sin
                  las stats de los jugadores.
                </p>
              )}
              {d?.live && (
                <MapRow
                  map={d.live.map}
                  r1={d.live.score1}
                  r2={d.live.score2}
                  live
                />
              )}
            </>
          )}
        </Section>
      )}

      {detail.isPending && !played && missing.length < 2 && (
        <Section>
          <Skeleton className="h-16 w-full" />
        </Section>
      )}
      {lineups && rosters && (
        <Section
          title={
            rated
              ? "Alineaciones · rating de la serie"
              : recentRated
                ? "Alineaciones · rating de las últimas 4 semanas (5v5)"
                : "Alineaciones"
          }
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
            {Array.from(
              { length: Math.max(rosters[0].length, rosters[1].length) },
              (_, i) => (
                <LineupPair
                  key={i}
                  left={rosters[0][i]}
                  right={rosters[1][i]}
                />
              )
            )}
          </div>
        </Section>
      )}

      {missing.length < 2 && (
        <div className="p-3.5">
          <Button asChild className="w-full">
            <Link to="/match/$id" params={{ id: match.id }}>
              {match.status === "live" ? "Ver en vivo" : "Ver partida"}
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}

const seed = (seeds: ReadonlyMap<string, number>, s: Side) =>
  s.teamId ? seeds.get(s.teamId) : undefined

function TeamHead({ side, seed }: { side: Side; seed?: number }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-1.5 text-center",
        side.lost && "opacity-55"
      )}
    >
      <TagBox
        team={side.teamId ? side : null}
        className="size-10 rounded-lg text-[11px]"
      />
      <span className="max-w-full truncate text-[13px] font-semibold">
        {side.teamId ? side.name : "Por definir"}
      </span>
      {seed && (
        <span className="font-mono text-[11px] text-muted-foreground">
          #{seed}
        </span>
      )}
    </div>
  )
}

function Score({ side }: { side: Side }) {
  return (
    <span
      className={cn(
        side.won && "text-win",
        side.lost && "text-muted-foreground"
      )}
    >
      {side.score ?? 0}
    </span>
  )
}

function Section({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 border-b px-3.5 py-3">
      {title && (
        <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h4>
      )}
      {children}
    </div>
  )
}

function MapRow({
  map,
  r1,
  r2,
  live,
  manual,
}: {
  map: string | null
  r1: number | null
  r2: number | null
  live?: boolean
  /** Resultado a mano, sin mix vinculado: "sin detalle". */
  manual?: boolean
}) {
  const a = r1 ?? 0
  const b = r2 ?? 0
  const tone = (mine: number, other: number) =>
    !live && mine > other ? "font-semibold text-win" : "text-muted-foreground"
  return (
    <div className="grid grid-cols-[28px_1fr_28px] items-center text-[13px]">
      <span className={cn("font-mono tabular-nums", tone(a, b))}>{a}</span>
      <span className="flex items-center justify-center gap-1.5 font-medium">
        {map ?? "Mapa"}
        {live && (
          <Badge variant="live" size="xs" shape="tag">
            VIVO
          </Badge>
        )}
        {manual && (
          <span
            className="text-[11px] font-normal text-muted-foreground"
            title="Sin detalle de la partida: resultado cargado a mano"
          >
            · sin detalle
          </span>
        )}
      </span>
      <span className={cn("text-right font-mono tabular-nums", tone(b, a))}>
        {b}
      </span>
    </div>
  )
}

type Lineup = { name: string; rating: number | null }

function LineupPair({ left, right }: { left?: Lineup; right?: Lineup }) {
  return (
    <>
      <LineupCell player={left} />
      <LineupCell player={right} reverse />
    </>
  )
}

function LineupCell({
  player,
  reverse,
}: {
  player?: Lineup
  reverse?: boolean
}) {
  if (!player) return <span />
  return (
    <span
      className={cn(
        "flex min-w-0 items-baseline gap-2",
        reverse && "flex-row-reverse"
      )}
    >
      <span className="truncate">{player.name}</span>
      {player.rating != null && (
        <span
          className={cn(
            "ml-auto font-mono text-xs tabular-nums",
            reverse && "mr-auto ml-0",
            player.rating >= 1 ? "text-win" : "text-muted-foreground"
          )}
        >
          {player.rating.toFixed(2)}
        </span>
      )}
    </span>
  )
}
