import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import { useMemo, type ComponentProps } from "react"
import type { RowData } from "@tanstack/react-table"

import { FilterChips } from "@/components/brand/FilterChips"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { ListSeal } from "@/components/brand/VerifiedBadge"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { DataTable } from "@/components/data-table/DataTable"
import { DataTablePagination } from "@/components/data-table/DataTablePagination"
import { SortHeader } from "@/components/data-table/SortHeader"
import { urlPaging, urlSorting } from "@/components/data-table/url"
import {
  useServerTable,
  type DataColumn,
  type DataTableInstance,
} from "@/components/data-table/useServerTable"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { fmt2, roleCountry } from "../lib/labels"
import {
  Podium,
  RankingHeader,
  Sparkline,
  TeamsCell,
  coverLink,
  useMine,
  type PodiumItem,
} from "../components/parts"
import {
  currentSeasonOptions,
  playerPodiumOptions,
  playerRankingOptions,
  seasonsOptions,
  standingsOptions,
  standingsPodiumOptions,
} from "../api/queries"
import type { RankingPlayer, Season, SeasonStanding } from "../types"
import { SearchBox } from "@/components/brand/SearchBox"
import { Card } from "@/components/ui/card"
import { Progress as UiProgress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { SeasonBar } from "../components/SeasonBar"
import {
  DEFAULT_PER,
  HISTORIC,
  PER_OPTIONS,
  type PlayerRankingSearch,
} from "../lib/search"
import { SeasonMedal } from "@/features/medals/Medal"

// Ranking → Jugadores (/ranking): una temporada (la activa por defecto) o el Histórico por ELO.

type Patch = Partial<PlayerRankingSearch>
type Props = { search: PlayerRankingSearch; onChange: (patch: Patch) => void }

const SUBTITLE =
  "Jugadores ordenados por ELO. Solo cuentan partidas jugadas en el servidor."

export function PlayersRanking({ search, onChange }: Props) {
  const seasons = useQuery(seasonsOptions)
  const current = useQuery({
    ...currentSeasonOptions,
    enabled: search.season === undefined,
  })

  // Sin parámetro: la activa (o Histórico si no hay). Con un id: esa temporada.
  let season: Season | null | undefined
  if (search.season === HISTORIC) season = null
  else if (search.season === undefined)
    season = current.isPending ? undefined : (current.data ?? null)
  else
    season = seasons.isPending
      ? undefined
      : (seasons.data?.find((s) => s.id === search.season) ?? null)

  const select = (v: string) =>
    onChange({
      // La activa es la opción por defecto: no hace falta en la URL.
      season: v === current.data?.id ? undefined : v,
      eligible: undefined,
      sort: undefined,
      order: undefined,
      page: undefined,
    })

  return (
    <section className="flex flex-col gap-5">
      <RankingHeader mode="players" subtitle={SUBTITLE} />
      {season === undefined ? (
        <>
          <Skeleton className="h-[58px] rounded-xl" />
          <Skeleton className="h-[84px] rounded-xl" />
        </>
      ) : (
        <>
          <SeasonBar
            seasons={seasons.data ?? (current.data ? [current.data] : [])}
            season={season}
            onSelect={select}
          />
          {season ? (
            <SeasonView season={season} search={search} onChange={onChange} />
          ) : (
            <HistoricView search={search} onChange={onChange} />
          )}
        </>
      )}
    </section>
  )
}

// ---------- Histórico ----------

const LEVELS = [
  { value: undefined, label: "Todos" },
  { value: "10", label: "Nivel 10" },
  { value: "7-9", label: "Nivel 7–9" },
  { value: "1-6", label: "Nivel 1–6" },
] as const

const HISTORIC_COLUMNS: DataColumn<RankingPlayer>[] = [
  {
    id: "position",
    header: "#",
    headClassName: "w-14 pl-4",
    cellClassName:
      "pl-4 font-mono text-[13px] font-semibold text-muted-foreground",
    cell: ({ row }) => row.original.position,
  },
  {
    id: "player",
    header: "Jugador",
    cell: ({ row }) => {
      const p = row.original
      const sub = roleCountry(p.game_role, p.country)
      return (
        <span className="flex items-center gap-2.5">
          <PlayerAvatar
            size="row"
            alias={p.player.alias}
            photo={p.player.photo_url}
          />
          <span className="flex flex-col leading-tight">
            <span className="inline-flex items-center gap-1 font-medium">
              {p.player.alias}
              <ListSeal kind={p.player.verified} />
            </span>
            {sub && (
              <span className="text-xs text-muted-foreground">{sub}</span>
            )}
          </span>
        </span>
      )
    },
  },
  levelColumn(),
  {
    accessorKey: "elo",
    enableSorting: true,
    header: ({ column }) => <SortHeader column={column} label="ELO" />,
    headClassName: "text-right",
    cellClassName: "text-right font-mono font-semibold tabular-nums",
  },
  teamsColumn(),
  {
    accessorKey: "rating",
    enableSorting: true,
    header: ({ column }) => <SortHeader column={column} label="Rating" />,
    headClassName: "text-center",
    cellClassName: "text-center font-mono tabular-nums",
    cell: ({ row }) => fmt2(row.original.rating),
  },
  {
    accessorKey: "kd",
    enableSorting: true,
    header: ({ column }) => <SortHeader column={column} label="K/D" />,
    headClassName: "text-center",
    cellClassName: "text-center font-mono tabular-nums",
    cell: ({ row }) => fmt2(row.original.kd),
  },
  {
    accessorKey: "matches",
    enableSorting: true,
    header: ({ column }) => <SortHeader column={column} label="Partidas" />,
    headClassName: "text-right",
    cellClassName: "text-right font-mono text-muted-foreground tabular-nums",
  },
  {
    id: "trend",
    header: "Últimos 30",
    headClassName: "pr-4 text-right",
    cellClassName: "pr-4 text-right",
    cell: ({ row }) => <Sparkline values={row.original.elo_trend} />,
  },
]

function HistoricView({ search, onChange }: Props) {
  const podium = useQuery(playerPodiumOptions)
  const list = useQuery(playerRankingOptions(search))
  const mine = useMine()
  const navigate = useNavigate()
  const table = useServerTable({
    columns: HISTORIC_COLUMNS,
    data: list.data?.items,
    total: list.data?.total,
    getRowId: (p) => p.player.id,
    ...urlPaging(search, onChange, DEFAULT_PER),
    ...urlSorting(search, onChange, "elo"),
  })

  const items: PodiumItem[] = (podium.data ?? []).map((p) => ({
    key: p.player.id,
    name: p.player.alias,
    sub: `Nivel ${p.level ?? "—"} · ${p.teams[0]?.name ?? "Libre"}`,
    value: p.elo,
    badge: (
      <PlayerAvatar
        size="row"
        alias={p.player.alias}
        photo={p.player.photo_url}
        className="size-[46px]"
      />
    ),
    link: <PlayerLink alias={p.player.alias} cover />,
  }))

  return (
    <>
      <Podium items={items} loading={podium.isPending} />
      <Card
        variant="outline"
        className="overflow-hidden shadow-[0_1px_2px_rgb(0_0_0/.04)]"
      >
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchBox
            value={search.q}
            placeholder="Alias o sigla del equipo"
            label="Buscar jugador"
            onChange={(q) => onChange({ q, page: undefined })}
          />
          <LevelFilter search={search} onChange={onChange} />
          <span className="ml-auto text-xs text-muted-foreground">
            {list.data ? `${list.data.total} jugadores` : ""}
          </span>
        </div>
        <DataTable
          table={table}
          query={list}
          className="min-w-[900px] text-sm"
          empty="No hay jugadores con esos filtros."
          rowLink={(p) => ({
            label: p.player.alias,
            me: p.player.id === mine.playerId,
            onOpen: () =>
              void navigate({
                to: "/player/$nick",
                params: { nick: p.player.alias },
              }),
          })}
        />
        <RankingPagination table={table} />
      </Card>
    </>
  )
}

function LevelFilter({ search, onChange }: Props) {
  return (
    <FilterChips
      size="sm"
      label="Nivel"
      options={LEVELS}
      value={search.level}
      onChange={(level) => onChange({ level, page: undefined })}
    />
  )
}

// ---------- Temporada ----------

function seasonColumns(
  active: boolean,
  min: number
): DataColumn<SeasonStanding>[] {
  return [
    {
      id: "rank",
      header: "#",
      headClassName: "w-14 pl-4",
      cellClassName:
        "pl-4 font-mono text-[13px] font-semibold text-muted-foreground",
      cell: ({ row }) => row.original.rank ?? "—",
    },
    {
      id: "player",
      header: "Jugador",
      cell: ({ row }) => (
        <span className="flex items-center gap-2.5">
          <PlayerAvatar
            size="row"
            alias={row.original.player.alias}
            photo={row.original.player.photo_url}
          />
          <span className="font-medium text-foreground">
            {row.original.player.alias}
          </span>
        </span>
      ),
    },
    levelColumn(),
    {
      accessorKey: "elo",
      enableSorting: true,
      header: ({ column }) => <SortHeader column={column} label="ELO" />,
      headClassName: "text-right",
      cellClassName: "text-right font-mono tabular-nums",
      cell: ({ row }) => (
        <span className="flex flex-col items-end leading-tight">
          <span className="font-semibold text-foreground">
            {row.original.elo}
          </span>
          <span className="text-[11px] text-muted-foreground">
            máx. {row.original.peak_elo}
          </span>
        </span>
      ),
    },
    teamsColumn(),
    {
      accessorKey: "rating",
      enableSorting: true,
      header: ({ column }) => <SortHeader column={column} label="Rating" />,
      headClassName: "text-center",
      cellClassName:
        "text-center font-mono font-semibold text-foreground tabular-nums",
      cell: ({ row }) => fmt2(row.original.rating),
    },
    {
      accessorKey: "kd",
      enableSorting: true,
      header: ({ column }) => <SortHeader column={column} label="K/D" />,
      headClassName: "text-center",
      cellClassName: "text-center font-mono tabular-nums",
      cell: ({ row }) => fmt2(row.original.kd),
    },
    {
      accessorKey: "matches",
      enableSorting: true,
      header: ({ column }) => <SortHeader column={column} label="Mixes" />,
      headClassName: "text-center",
      cellClassName: "text-center",
      cell: ({ row }) =>
        row.original.eligible ? (
          <span className="font-mono tabular-nums">{row.original.matches}</span>
        ) : (
          <Progress matches={row.original.matches} min={min} />
        ),
    },
    {
      id: "record",
      header: "V–D",
      headClassName: "text-center",
      cellClassName: "text-center font-mono tabular-nums",
      cell: ({ row }) => `${row.original.wins}–${row.original.losses}`,
    },
    {
      id: "medal",
      header: active ? "Medalla si cierra hoy" : "Medalla",
      cell: ({ row }) =>
        row.original.medal ? (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <SeasonMedal medal={row.original.medal} size={28} />
            {row.original.medal.name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "after",
      header: active ? "Al cerrar" : "Después del cierre",
      headClassName: "pr-4 text-right",
      cellClassName: "pr-4 text-right",
      cell: ({ row }) =>
        row.original.elo_after !== row.original.elo ? (
          <span className="font-mono text-xs font-medium tabular-nums">
            {row.original.elo_after}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Sin cambio</span>
        ),
    },
  ]
}

function SeasonView({ season, search, onChange }: Props & { season: Season }) {
  const podium = useQuery(standingsPodiumOptions(season.id))
  const list = useQuery(standingsOptions(season.id, search))
  const mine = useMine()
  const navigate = useNavigate()
  const active = season.status === "active"
  const columns = useMemo(
    () => seasonColumns(active, season.min_matches),
    [active, season.min_matches]
  )
  const table = useServerTable({
    columns,
    data: list.data?.items,
    total: list.data?.total,
    getRowId: (r) => r.player.id,
    ...urlPaging(search, onChange, DEFAULT_PER),
    ...urlSorting(search, onChange),
  })

  const items: PodiumItem[] = (podium.data ?? []).map((r) => ({
    key: r.player.id,
    name: r.player.alias,
    sub: `Nivel ${r.level ?? "—"} · ${r.matches} mixes`,
    value: r.elo,
    badge: (
      <PlayerAvatar
        size="row"
        alias={r.player.alias}
        photo={r.player.photo_url}
        className="size-[46px]"
      />
    ),
    link: <PlayerLink alias={r.player.alias} cover />,
  }))

  return (
    <>
      <Podium items={items} loading={podium.isPending} />
      <Card
        variant="outline"
        className="overflow-hidden shadow-[0_1px_2px_rgb(0_0_0/.04)]"
      >
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchBox
            value={search.q}
            placeholder="Alias del jugador"
            label="Buscar jugador"
            onChange={(q) => onChange({ q, page: undefined })}
          />
          <Toggle
            pressed={!!search.eligible}
            onPressedChange={(on) =>
              onChange({ eligible: on || undefined, page: undefined })
            }
            className="h-8 border border-dashed px-2.5 text-[13px] font-normal hover:bg-accent data-[state=on]:bg-accent"
          >
            Solo con puesto
          </Toggle>
          <LevelFilter search={search} onChange={onChange} />
          <span className="ml-auto text-xs text-muted-foreground">
            {list.data ? `${list.data.total} jugadores` : ""}
          </span>
        </div>
        <DataTable
          table={table}
          query={list}
          className="min-w-[1040px] text-sm"
          empty="No hay jugadores con esos filtros."
          rowClassName={(r) => cn(!r.eligible && "text-muted-foreground")}
          rowLink={(r) => ({
            label: r.player.alias,
            me: r.player.id === mine.playerId,
            onOpen: () =>
              void navigate({
                to: "/player/$nick",
                params: { nick: r.player.alias },
              }),
          })}
        />
        <RankingPagination table={table} />
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          Sin puesto: jugaron menos de {season.min_matches} mixes en la
          temporada. Al cerrar, quienes tengan más de {season.reset_floor} de
          ELO se reinician al {season.reset_pct} % de lo que tengan por encima.
        </p>
      </Card>
    </>
  )
}

function Progress({ matches, min }: { matches: number; min: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5">
          <UiProgress
            value={Math.min(100, (matches / min) * 100)}
            aria-hidden
            className="w-10"
            indicatorClassName="bg-muted-foreground"
          />
          <span className="font-mono text-xs tabular-nums">
            {matches}/{min}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Le faltan {min - matches} mixes para tener puesto
      </TooltipContent>
    </Tooltip>
  )
}

// ---------- Compartido ----------

function PlayerLink({ alias, cover }: { alias: string; cover?: boolean }) {
  return (
    <Link
      to="/player/$nick"
      params={{ nick: alias }}
      className={cn(cover && coverLink)}
    >
      {alias}
    </Link>
  )
}

function LevelCell({ level }: { level: number | null }) {
  return level === null ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <LevelBadge level={level} size={24} className="inline-grid" />
  )
}

function levelColumn<T extends { level: number | null }>(): DataColumn<T> {
  return {
    id: "level",
    header: "Nivel",
    headClassName: "text-center",
    cellClassName: "text-center",
    cell: ({ row }) => <LevelCell level={row.original.level} />,
  }
}

function teamsColumn<
  T extends { teams: ComponentProps<typeof TeamsCell>["teams"] },
>(): DataColumn<T> {
  return {
    id: "teams",
    header: "Equipo",
    cell: ({ row }) => <TeamsCell teams={row.original.teams} />,
  }
}

/** Pie de las tablas del ranking: tamaño de página y páginas. */
export function RankingPagination<T extends RowData>({
  table,
}: {
  table: DataTableInstance<T>
}) {
  return (
    <DataTablePagination
      table={table}
      perOptions={PER_OPTIONS}
      perLabel="Filas por página"
    />
  )
}
