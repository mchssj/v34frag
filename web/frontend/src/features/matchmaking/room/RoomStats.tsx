import { cn } from "cn"
import { ArrowDownIcon, ArrowUpIcon, StarIcon } from "lucide-react"
import { useState } from "react"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RoomPlayer } from "@/features/mixes/room"
import {
  STATS_TABS,
  STATS_TAB_LABEL,
  bestValues,
  columnsFor,
  nextSort,
  sortPlayers,
  type StatColumn,
  type StatsSort,
  type StatsTab,
} from "@/features/mixes/stats"
import { LEVEL_FLOORS } from "@/features/player/labels"
import type { MmLobby, MmMatch, MmPlayer } from "../types"
import { Highlights } from "./Highlights"
import {
  avgElo,
  leadersOf,
  levelOf,
  mvpOf,
  teamLabel,
  teamPlayers,
  type Team,
} from "./roomData"

// Estadísticas de la sala, postpartido (plan, sección 7): MVP, destacados, la tabla con las pestañas de la sala
// de Mixes y lo más destacado (clips). Rating y Δ ELO van al principio, como en el diseño.

export function RoomStats({
  lobby,
  match,
  backdrop,
  mapName,
}: {
  lobby: MmLobby
  match: MmMatch
  backdrop: string | null
  mapName: string | null
}) {
  const byId = new Map(lobby.players.map((p) => [p.player_id, p]))
  const mvp = mvpOf(match.stats)

  const jump = (key: string) =>
    document.getElementById(`stats-${key}`)?.scrollIntoView({ block: "center" })

  return (
    <div className="flex flex-col gap-6">
      <ul aria-label="Jugadores" className="flex gap-2 overflow-x-auto pb-1">
        {match.stats.map((s) => {
          const p = byId.get(s.key)
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => jump(s.key)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border bg-card py-1.5 pr-3 pl-1.5 text-sm font-medium whitespace-nowrap hover:bg-muted",
                  p?.team === 1
                    ? "shadow-[inset_3px_0_0_var(--primary)]"
                    : "shadow-[inset_3px_0_0_var(--chart-2)]"
                )}
              >
                <PlayerAvatar p={p} size="size-6" />
                {s.nick}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {mvp && (
          <MvpCard stat={mvp} player={byId.get(mvp.key)} backdrop={backdrop} />
        )}
        <ul aria-label="Destacados" className="flex flex-col gap-2">
          {leadersOf(match.stats).map((l) => (
            <li
              key={l.label}
              className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-[inset_3px_0_0_var(--primary)]"
            >
              <PlayerAvatar p={byId.get(l.player.key)} size="size-9" />
              <span className="font-semibold">{l.player.nick}</span>
              <span className="ml-auto flex flex-col items-end leading-tight">
                <span className="font-mono text-xl font-bold tabular-nums">
                  {l.value}
                </span>
                <span className="text-xs text-muted-foreground">{l.label}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <StatsTables lobby={lobby} match={match} />

      {match.clips.length > 0 && (
        <Highlights
          clips={match.clips}
          players={lobby.players}
          mapName={mapName}
          poster={backdrop}
        />
      )}
    </div>
  )
}

function PlayerAvatar({ p, size }: { p: MmPlayer | undefined; size: string }) {
  return (
    <Avatar className={size}>
      {p?.photo_url && <AvatarImage src={p.photo_url} alt="" />}
      <AvatarFallback className="text-[10px] font-semibold">
        {(p?.nick ?? "?").slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

function MvpCard({
  stat,
  player,
  backdrop,
}: {
  stat: RoomPlayer
  player: MmPlayer | undefined
  backdrop: string | null
}) {
  const items: [string, string][] = [
    [
      stat.delta === null ? "—" : `${stat.delta >= 0 ? "+" : ""}${stat.delta}`,
      "Δ ELO",
    ],
    [stat.adr === null ? "—" : stat.adr.toFixed(1), "ADR"],
    [`${stat.k}/${stat.d}/${stat.a}`, "K/D/A"],
    [stat.hs === null ? "—" : `${stat.hs}%`, "% de headshots"],
  ]
  return (
    <section
      aria-label="MVP"
      className="relative isolate flex flex-wrap items-center gap-6 overflow-hidden rounded-xl border bg-card p-5 text-white"
    >
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-20 size-full object-cover"
        />
      )}
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(0_0_0/.85),rgb(0_0_0/.5))]"
      />
      <div className="flex w-40 flex-col items-center gap-2 rounded-xl border border-white/15 bg-black/40 p-4">
        <PlayerAvatar p={player} size="size-20" />
        <span className="font-semibold">{stat.nick}</span>
        {player && (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs">
            <LevelBadge
              level={player.level}
              size={20}
              className="rounded-full"
            />
            {player.elo}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="w-fit rounded bg-win/25 px-1.5 font-mono text-2xl font-bold text-win">
              {stat.rating?.toFixed(2) ?? "—"}
            </span>
            <span className="text-sm text-white/70">Rating</span>
          </div>
          <span className="inline-flex items-center gap-1 text-3xl font-black tracking-tight">
            <StarIcon
              aria-hidden
              className="size-6 fill-sidebar-primary text-sidebar-primary"
            />
            MVP
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-4">
          {items.map(([v, l]) => (
            <div key={l} className="flex flex-col-reverse">
              <dt className="text-sm text-white/70">{l}</dt>
              <dd className="font-mono text-xl font-bold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

type Order = "team" | "players"

function StatsTables({ lobby, match }: { lobby: MmLobby; match: MmMatch }) {
  const [tab, setTab] = useState<StatsTab>("general")
  const [order, setOrder] = useState<Order>("team")
  const [sort, setSort] = useState<StatsSort>(null)
  // Rating y Δ ELO van en sus propias columnas al principio.
  const cols = columnsFor(tab, "finished").filter(
    (c) => c.key !== "rating" && c.key !== "delta"
  )
  const best = bestValues(cols, match.stats)
  const teamOf = (key: string) =>
    lobby.players.find((p) => p.player_id === key)?.team ?? 1
  const onSort = (key: string) => setSort((s) => nextSort(s, key))

  return (
    <section
      aria-label="Estadísticas de la partida"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Tipo de estadística"
          className="flex gap-1"
        >
          {STATS_TABS.map((t) => (
            <Button
              key={t}
              role="tab"
              aria-selected={tab === t}
              size="sm"
              variant={tab === t ? "outline" : "ghost"}
              onClick={() => {
                setTab(t)
                setSort(null)
              }}
            >
              {STATS_TAB_LABEL[t]}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          {(
            [
              ["team", "Ordenar por equipo"],
              ["players", "Ordenar por jugadores"],
            ] as const
          ).map(([o, label]) => (
            <Button
              key={o}
              size="sm"
              variant={order === o ? "secondary" : "ghost"}
              aria-pressed={order === o}
              className={cn(order === o && "text-primary")}
              onClick={() => setOrder(o)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {order === "team" ? (
        ([1, 2] as const).map((team) => (
          <TeamTable
            key={team}
            lobby={lobby}
            match={match}
            team={team}
            rows={match.stats.filter((s) => teamOf(s.key) === team)}
            cols={cols}
            best={best}
            sort={sort}
            onSort={onSort}
          />
        ))
      ) : (
        <StatsTable
          lobby={lobby}
          rows={[...match.stats].sort(
            (a, b) => (b.rating ?? 0) - (a.rating ?? 0)
          )}
          cols={cols}
          best={best}
          sort={sort}
          onSort={onSort}
          teamOf={teamOf}
        />
      )}
    </section>
  )
}

function TeamTable({
  lobby,
  match,
  team,
  rows,
  ...rest
}: {
  lobby: MmLobby
  match: MmMatch
  team: Team
  rows: RoomPlayer[]
  cols: StatColumn[]
  best: Record<string, number | null>
  sort: StatsSort
  onSort: (key: string) => void
}) {
  const score = team === 1 ? match.score1 : match.score2
  const won = match.winner === team
  const i = team === 1 ? 0 : 1
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("font-mono text-lg font-bold", won && "text-win")}>
          {score}
        </span>
        <span className="font-semibold">{teamLabel(lobby, team)}</span>
        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          Promedio del equipo
          <span className="inline-flex items-center gap-1 font-mono text-foreground">
            <LevelBadge
              level={levelOf(avgElo(teamPlayers(lobby, team)), LEVEL_FLOORS)}
              size={20}
              className="rounded-full"
            />
            {avgElo(teamPlayers(lobby, team))}
          </span>
          {match.halves?.slice(0, 2).map((h, n) => (
            <span key={n}>
              {n === 0 ? "Primera mitad" : "Segunda mitad"}{" "}
              <strong className="text-foreground">{h[i]}</strong>
            </span>
          ))}
        </span>
      </div>
      <StatsTable lobby={lobby} rows={rows} teamOf={() => team} {...rest} />
    </div>
  )
}

function StatsTable({
  lobby,
  rows,
  cols,
  best,
  sort,
  onSort,
  teamOf,
}: {
  lobby: MmLobby
  rows: RoomPlayer[]
  cols: StatColumn[]
  best: Record<string, number | null>
  sort: StatsSort
  onSort: (key: string) => void
  teamOf: (key: string) => Team
}) {
  const sorted = sortPlayers(rows, [...cols, RATING, DELTA], sort)
  const byId = new Map(lobby.players.map((p) => [p.player_id, p]))
  const maxRating = Math.max(2, ...rows.map((r) => r.rating ?? 0))
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table className="min-w-[900px] text-[13px]">
        <TableHeader>
          <TableRow className="text-xs hover:bg-transparent">
            <TableHead className="w-[190px] pl-3">Jugador</TableHead>
            <TableHead className="w-[90px]">Rango</TableHead>
            <TableHead className="w-[150px]">
              <SortHead col={RATING} sort={sort} onSort={onSort} />
            </TableHead>
            <TableHead className="text-center">
              <SortHead col={DELTA} sort={sort} onSort={onSort} />
            </TableHead>
            {cols.map((c) => (
              <TableHead key={c.key} className="text-center">
                <SortHead col={c} sort={sort} onSort={onSort} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((s) => {
            const p = byId.get(s.key)
            const team = teamOf(s.key)
            return (
              <TableRow
                key={s.key}
                id={`stats-${s.key}`}
                className={cn(
                  team === 1 ? "bg-primary/[0.04]" : "bg-chart-2/[0.05]",
                  s.me && "bg-primary/10"
                )}
              >
                <TableCell className="pl-3">
                  <span className="flex items-center gap-2 font-medium whitespace-nowrap">
                    <PlayerAvatar p={p} size="size-6" />
                    {s.nick}
                    {s.mvp && (
                      <StarIcon
                        aria-label="MVP"
                        className="size-3.5 fill-sidebar-primary text-sidebar-primary"
                      />
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  {p && (
                    <span className="inline-flex items-center gap-1.5 font-mono">
                      <LevelBadge
                        level={p.level}
                        size={20}
                        className="rounded-full"
                      />
                      {p.elo}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <RatingBar value={s.rating} max={maxRating} />
                </TableCell>
                <TableCell className="text-center font-mono tabular-nums">
                  {s.delta === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span
                      className={s.delta >= 0 ? "text-win" : "text-destructive"}
                    >
                      {s.delta >= 0 ? "+" : ""}
                      {s.delta}
                    </span>
                  )}
                </TableCell>
                {cols.map((c) => {
                  const v = c.value(s)
                  const top = best[c.key] !== null && v === best[c.key]
                  return (
                    <TableCell
                      key={c.key}
                      className={cn(
                        "text-center font-mono tabular-nums",
                        top && "font-bold text-win"
                      )}
                    >
                      {format(v, c)}
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

const RATING: StatColumn = {
  key: "rating",
  label: "Rating",
  value: (p) => p.rating,
  format: "dec2",
}
const DELTA: StatColumn = {
  key: "delta",
  label: "Δ ELO",
  value: (p) => p.delta,
  format: "signed",
}

function SortHead({
  col,
  sort,
  onSort,
}: {
  col: StatColumn
  sort: StatsSort
  onSort: (key: string) => void
}) {
  const dir = sort?.key === col.key ? sort.dir : null
  const Icon = dir === "asc" ? ArrowUpIcon : ArrowDownIcon
  return (
    <button
      type="button"
      title={col.help}
      aria-label={`Ordenar por ${col.label}`}
      onClick={() => onSort(col.key)}
      className={cn(
        "inline-flex items-center gap-1 font-medium hover:text-foreground",
        dir && "text-foreground"
      )}
    >
      {col.label}
      {dir && <Icon aria-hidden className="size-3" />}
    </button>
  )
}

/** Rating con una barra, verde desde 1.10, gris hasta 0.90 y rojo abajo. */
function RatingBar({ value, max }: { value: number | null; max: number }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  const tone =
    value >= 1.1
      ? "bg-win"
      : value >= 0.9
        ? "bg-muted-foreground"
        : "bg-destructive"
  return (
    <span className="flex items-center gap-2">
      <span
        className={cn(
          "rounded px-1.5 font-mono font-semibold text-white",
          tone
        )}
      >
        {value.toFixed(2)}
      </span>
      <span
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        aria-hidden
      >
        <span
          className={cn("block h-full", tone)}
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
      </span>
    </span>
  )
}

function format(v: number | null, c: StatColumn) {
  if (v === null) return <span className="text-muted-foreground">—</span>
  switch (c.format) {
    case "dec2":
      return v.toFixed(2)
    case "pct":
      return `${v}%`
    case "signed":
      return (
        <span className={v >= 0 ? "text-win" : "text-destructive"}>
          {v > 0 ? "+" : ""}
          {v}
        </span>
      )
    default:
      return v
  }
}
