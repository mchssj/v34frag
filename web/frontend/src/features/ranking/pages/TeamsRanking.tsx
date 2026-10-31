import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"

import { Switch } from "@/components/ui/switch"
import { DataTable } from "@/components/data-table/DataTable"
import { urlPaging } from "@/components/data-table/url"
import {
  useServerTable,
  type DataColumn,
} from "@/components/data-table/useServerTable"
import { fmtPct, teamTrend } from "../lib/labels"
import {
  MineChip,
  Podium,
  RankingHeader,
  coverLink,
  useMine,
  type PodiumItem,
} from "../components/parts"
import { TeamCrest } from "@/components/brand/TeamCrest"
import { RankingPagination } from "./PlayersRanking"
import { teamPodiumOptions, teamRankingOptions } from "../api/queries"
import type { RankingTeam } from "../types"
import { SearchBox } from "@/components/brand/SearchBox"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { DEFAULT_PER, type TeamRankingSearch } from "../lib/search"

// Ranking → Equipos (/ranking/teams): puntos por partida ganada, con o sin PCW (contrato 7).

type Patch = Partial<TeamRankingSearch>

export function TeamsRanking({
  search,
  onChange,
}: {
  search: TeamRankingSearch
  onChange: (patch: Patch) => void
}) {
  const pcw = !!search.pcw
  const podium = useQuery(teamPodiumOptions(pcw))
  const list = useQuery(teamRankingOptions(search))
  const mine = useMine()
  const navigate = useNavigate()
  const ppw = list.data?.points_per_win
  const table = useServerTable({
    columns: COLUMNS,
    data: list.data?.items,
    total: list.data?.total,
    getRowId: (r) => r.team.id,
    ...urlPaging(search, onChange, DEFAULT_PER),
  })

  const items: PodiumItem[] = (podium.data ?? []).map((r) => ({
    key: r.team.id,
    name: r.team.name,
    sub:
      r.win_rate === null
        ? `${r.won}G · ${r.lost}P · Sin partidas`
        : `${r.won}G · ${r.lost}P · ${fmtPct(r.win_rate)} victorias`,
    value: r.points,
    badge: <TeamCrest team={r.team} size="sm" />,
    link: (
      <Link to="/teams/$id" params={{ id: r.team.id }} className={coverLink}>
        {r.team.name}
      </Link>
    ),
  }))

  return (
    <section className="flex flex-col gap-5">
      <RankingHeader
        mode="teams"
        subtitle={
          pcw
            ? "Puntos por partida ganada en torneos y en PCW jugadas como equipo oficial."
            : "Puntos por partida de torneo ganada."
        }
      />
      <Podium items={items} loading={podium.isPending} />
      <Card
        variant="outline"
        className="overflow-hidden shadow-[0_1px_2px_rgb(0_0_0/.04)]"
      >
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchBox
            value={search.q}
            placeholder="Buscar equipo o sigla"
            label="Buscar equipo"
            onChange={(q) => onChange({ q, page: undefined })}
          />
          <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border bg-background px-2.5 text-[13px] font-medium">
            <Switch
              checked={pcw}
              onCheckedChange={(on) =>
                onChange({ pcw: on || undefined, page: undefined })
              }
            />
            Contar también PCW
          </label>
          <span className="ml-auto text-xs text-muted-foreground">
            {list.data ? `${list.data.total} equipos oficiales` : ""}
          </span>
        </div>
        <DataTable
          table={table}
          query={list}
          className="min-w-[780px] text-sm"
          empty="No hay equipos con ese nombre."
          rowLink={(r) => ({
            label: r.team.name,
            me: mine.teamIds.has(r.team.id),
            onOpen: () =>
              void navigate({ to: "/teams/$id", params: { id: r.team.id } }),
          })}
        />
        <RankingPagination table={table} />
        {ppw && (
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            {ppw.official} pts por partida de torneo ganada
            {pcw && ` · ${ppw.pcw} pts por PCW ganada como equipo oficial`}
          </p>
        )}
      </Card>
    </section>
  )
}

const TONE = {
  up: "text-win",
  down: "text-destructive",
  flat: "text-muted-foreground",
}

const center = "text-center font-mono tabular-nums"

const COLUMNS: DataColumn<RankingTeam>[] = [
  {
    id: "position",
    header: "#",
    headClassName: "w-14 pl-4",
    cellClassName: "pl-4 font-mono text-[13px] font-semibold",
    cell: ({ row }) => row.original.position,
  },
  {
    id: "team",
    header: "Equipo",
    cell: ({ row }) => <TeamCell team={row.original.team} />,
  },
  {
    id: "trend",
    header: "Tendencia",
    headClassName: "text-center",
    cellClassName: "text-center",
    cell: ({ row }) => {
      const trend = teamTrend(row.original.trend, row.original.position)
      return (
        <span
          title={trend.title}
          className={cn("font-mono text-xs font-semibold", TONE[trend.tone])}
        >
          <span aria-hidden>{trend.text}</span>
          <span className="sr-only">{trend.title}</span>
        </span>
      )
    },
  },
  {
    id: "form",
    header: "Forma",
    headClassName: "text-center",
    cellClassName: "text-center",
    cell: ({ row }) =>
      row.original.form.length ? (
        <span
          aria-label="Últimos 5 resultados"
          className="inline-flex gap-[3px]"
        >
          {row.original.form.map((f, i) => (
            <span
              key={i}
              className={cn(
                "grid size-[18px] place-items-center rounded-[4px] font-mono text-[10px] font-bold",
                f === "W"
                  ? "bg-win/18 text-win"
                  : "bg-destructive/15 text-destructive"
              )}
            >
              {f === "W" ? "V" : "D"}
            </span>
          ))}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "played",
    header: "PJ",
    headClassName: "text-center",
    cellClassName: center,
  },
  {
    accessorKey: "won",
    header: "G",
    headClassName: "text-center",
    cellClassName: center,
  },
  {
    accessorKey: "lost",
    header: "P",
    headClassName: "text-center",
    cellClassName: center,
  },
  {
    id: "win_rate",
    header: "% Vict.",
    headClassName: "text-center",
    cell: ({ row }) => (
      <span className="flex items-center justify-center gap-2">
        <Progress
          value={row.original.win_rate ?? 0}
          aria-hidden
          className="w-14"
          indicatorClassName="bg-foreground"
        />
        <span className="w-[34px] font-mono text-xs font-medium tabular-nums">
          {fmtPct(row.original.win_rate)}
        </span>
      </span>
    ),
  },
  {
    accessorKey: "points",
    header: "Pts",
    headClassName: "pr-4 text-right",
    cellClassName:
      "pr-4 text-right font-mono text-[15px] font-semibold tabular-nums",
  },
]

function TeamCell({ team }: { team: RankingTeam["team"] }) {
  const mine = useMine().teamIds.has(team.id)
  return (
    <span className="flex items-center gap-2.5">
      <TeamCrest team={team} size="row" />
      <span className="font-medium">{team.name}</span>
      {mine && <MineChip />}
    </span>
  )
}
