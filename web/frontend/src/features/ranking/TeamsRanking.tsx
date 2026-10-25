import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"

import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fmtPct, teamTrend } from "./labels"
import {
  MineChip,
  Podium,
  RankingHeader,
  TagBox,
  coverLink,
  useMine,
  type PodiumItem,
} from "./parts"
import { ListState, Paging, RowLink } from "./PlayersRanking"
import {
  teamPodiumOptions,
  teamRankingOptions,
  type RankingTeam,
} from "./queries"
import { SearchBox } from "./SearchBox"
import type { TeamRankingSearch } from "./search"

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

  const items: PodiumItem[] = (podium.data ?? []).map((r) => ({
    key: r.team.id,
    name: r.team.name,
    sub:
      r.win_rate === null
        ? `${r.won}G · ${r.lost}P · Sin partidas`
        : `${r.won}G · ${r.lost}P · ${fmtPct(r.win_rate)} victorias`,
    value: r.points,
    badge: (
      <TagBox team={r.team} className="size-[46px] rounded-lg text-[13px]" />
    ),
    link: (
      <Link to="/teams/$id" params={{ id: r.team.id }} className={coverLink}>
        {r.team.name}
      </Link>
    ),
  }))

  const head = "h-auto py-2.5 text-xs font-medium text-muted-foreground"

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
      <div className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]">
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
        <Table className="min-w-[780px] text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(head, "w-14 pl-4")}>#</TableHead>
              <TableHead className={head}>Equipo</TableHead>
              <TableHead className={cn(head, "text-center")}>
                Tendencia
              </TableHead>
              <TableHead className={cn(head, "text-center")}>Forma</TableHead>
              <TableHead className={cn(head, "text-center")}>PJ</TableHead>
              <TableHead className={cn(head, "text-center")}>G</TableHead>
              <TableHead className={cn(head, "text-center")}>P</TableHead>
              <TableHead className={cn(head, "text-center")}>% Vict.</TableHead>
              <TableHead className={cn(head, "pr-4 text-right")}>Pts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ListState
              query={list}
              cols={9}
              empty="No hay equipos con ese nombre."
            >
              {list.data?.items.map((r) => (
                <TeamRow
                  key={r.team.id}
                  r={r}
                  mine={mine.teamIds.has(r.team.id)}
                  onOpen={() =>
                    void navigate({
                      to: "/teams/$id",
                      params: { id: r.team.id },
                    })
                  }
                />
              ))}
            </ListState>
          </TableBody>
        </Table>
        <Paging search={search} total={list.data?.total} onChange={onChange} />
        {ppw && (
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            {ppw.official} pts por partida de torneo ganada
            {pcw && ` · ${ppw.pcw} pts por PCW ganada como equipo oficial`}
          </p>
        )}
      </div>
    </section>
  )
}

const TONE = {
  up: "text-win",
  down: "text-destructive",
  flat: "text-muted-foreground",
}

function TeamRow({
  r,
  mine,
  onOpen,
}: {
  r: RankingTeam
  mine: boolean
  onOpen: () => void
}) {
  const trend = teamTrend(r.trend, r.position)
  return (
    <RowLink label={r.team.name} me={mine} onOpen={onOpen}>
      <TableCell className="pl-4 font-mono text-[13px] font-semibold">
        {r.position}
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-2.5">
          <TagBox team={r.team} />
          <span className="font-medium">{r.team.name}</span>
          {mine && <MineChip />}
        </span>
      </TableCell>
      <TableCell className="text-center">
        <span
          title={trend.title}
          className={cn("font-mono text-xs font-semibold", TONE[trend.tone])}
        >
          <span aria-hidden>{trend.text}</span>
          <span className="sr-only">{trend.title}</span>
        </span>
      </TableCell>
      <TableCell className="text-center">
        {r.form.length ? (
          <span
            aria-label="Últimos 5 resultados"
            className="inline-flex gap-[3px]"
          >
            {r.form.map((f, i) => (
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
        )}
      </TableCell>
      <TableCell className="text-center font-mono tabular-nums">
        {r.played}
      </TableCell>
      <TableCell className="text-center font-mono tabular-nums">
        {r.won}
      </TableCell>
      <TableCell className="text-center font-mono tabular-nums">
        {r.lost}
      </TableCell>
      <TableCell>
        <span className="flex items-center justify-center gap-2">
          <span className="h-1 w-14 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full bg-foreground"
              style={{ width: `${r.win_rate ?? 0}%` }}
            />
          </span>
          <span className="w-[34px] font-mono text-xs font-medium tabular-nums">
            {fmtPct(r.win_rate)}
          </span>
        </span>
      </TableCell>
      <TableCell className="pr-4 text-right font-mono text-[15px] font-semibold tabular-nums">
        {r.points}
      </TableCell>
    </RowLink>
  )
}
