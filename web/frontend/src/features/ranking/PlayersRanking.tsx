import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import type { KeyboardEvent, ReactNode } from "react"

import { errorMessage, isRetryable } from "@/api/errors"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { ListPagination } from "@/components/brand/ListPagination"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { fmt2, roleCountry } from "./labels"
import {
  PlayerAvatar,
  Podium,
  RankingHeader,
  SortHead,
  Sparkline,
  TeamsCell,
  coverLink,
  useMine,
  type PodiumItem,
} from "./parts"
import {
  currentSeasonOptions,
  playerPodiumOptions,
  playerRankingOptions,
  seasonsOptions,
  standingsOptions,
  standingsPodiumOptions,
  type RankingPlayer,
  type Season,
  type SeasonStanding,
} from "./queries"
import { SearchBox } from "./SearchBox"
import { SeasonBar } from "./SeasonBar"
import {
  DEFAULT_PER,
  HISTORIC,
  PER_OPTIONS,
  type PlayerRankingSearch,
} from "./search"

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
      level: undefined,
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

function HistoricView({ search, onChange }: Props) {
  const podium = useQuery(playerPodiumOptions)
  const list = useQuery(playerRankingOptions(search))
  const mine = useMine()
  const navigate = useNavigate()
  const sort = search.sort === "elo" ? undefined : search.sort
  const order = search.order ?? "desc"

  const sortBy = (key: "rating" | "kd" | "matches" | undefined) => {
    if (!key || (sort === key && order === "asc"))
      onChange({ sort: undefined, order: undefined, page: undefined })
    else if (sort === key) onChange({ order: "asc", page: undefined })
    else onChange({ sort: key, order: undefined, page: undefined })
  }

  const items: PodiumItem[] = (podium.data ?? []).map((p) => ({
    key: p.player.id,
    name: p.player.alias,
    sub: `Nivel ${p.level ?? "—"} · ${p.teams[0]?.name ?? "Libre"}`,
    value: p.elo,
    badge: (
      <PlayerAvatar
        alias={p.player.alias}
        photo={p.player.photo_url}
        className="size-[46px]"
      />
    ),
    link: <PlayerLink alias={p.player.alias} cover />,
  }))

  const head = "h-auto py-2.5 text-xs font-medium text-muted-foreground"

  return (
    <>
      <Podium items={items} loading={podium.isPending} />
      <div className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchBox
            value={search.q}
            placeholder="Alias o sigla del equipo"
            label="Buscar jugador"
            onChange={(q) => onChange({ q, page: undefined })}
          />
          <div role="group" aria-label="Nivel" className="flex flex-wrap gap-1">
            {LEVELS.map((l) => {
              const on = search.level === l.value
              return (
                <button
                  key={l.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange({ level: l.value, page: undefined })}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-xs font-medium transition-colors",
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "hover:bg-muted"
                  )}
                >
                  {l.label}
                </button>
              )
            })}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {list.data ? `${list.data.total} jugadores` : ""}
          </span>
        </div>
        <Table className="min-w-[900px] text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(head, "w-14 pl-4")}>#</TableHead>
              <TableHead className={head}>Jugador</TableHead>
              <TableHead className={cn(head, "text-center")}>Nivel</TableHead>
              <TableHead className={cn(head, "text-right")}>
                <SortHead
                  label="ELO"
                  active={!sort}
                  order="desc"
                  onClick={() => sortBy(undefined)}
                />
              </TableHead>
              <TableHead className={head}>Equipo</TableHead>
              <TableHead className={cn(head, "text-center")}>
                <SortHead
                  label="Rating"
                  active={sort === "rating"}
                  order={order}
                  onClick={() => sortBy("rating")}
                />
              </TableHead>
              <TableHead className={cn(head, "text-center")}>
                <SortHead
                  label="K/D"
                  active={sort === "kd"}
                  order={order}
                  onClick={() => sortBy("kd")}
                />
              </TableHead>
              <TableHead className={cn(head, "text-right")}>
                <SortHead
                  label="Partidas"
                  active={sort === "matches"}
                  order={order}
                  onClick={() => sortBy("matches")}
                />
              </TableHead>
              <TableHead className={cn(head, "pr-4 text-right")}>
                Últimos 30
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ListState
              query={list}
              cols={9}
              empty="No hay jugadores con esos filtros."
            >
              {list.data?.items.map((p) => (
                <HistoricRow
                  key={p.player.id}
                  p={p}
                  me={p.player.id === mine.playerId}
                  onOpen={() =>
                    void navigate({
                      to: "/player/$nick",
                      params: { nick: p.player.alias },
                    })
                  }
                />
              ))}
            </ListState>
          </TableBody>
        </Table>
        <Paging search={search} total={list.data?.total} onChange={onChange} />
      </div>
    </>
  )
}

function HistoricRow({
  p,
  me,
  onOpen,
}: {
  p: RankingPlayer
  me: boolean
  onOpen: () => void
}) {
  const sub = roleCountry(p.game_role, p.country)
  return (
    <RowLink label={p.player.alias} me={me} onOpen={onOpen}>
      <TableCell className="pl-4 font-mono text-[13px] font-semibold text-muted-foreground">
        {p.position}
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-2.5">
          <PlayerAvatar alias={p.player.alias} photo={p.player.photo_url} />
          <span className="flex flex-col leading-tight">
            <span className="font-medium">{p.player.alias}</span>
            {sub && (
              <span className="text-xs text-muted-foreground">{sub}</span>
            )}
          </span>
        </span>
      </TableCell>
      <TableCell className="text-center">
        <LevelCell level={p.level} />
      </TableCell>
      <TableCell className="text-right font-mono font-semibold tabular-nums">
        {p.elo}
      </TableCell>
      <TableCell>
        <TeamsCell teams={p.teams} />
      </TableCell>
      <TableCell className="text-center font-mono tabular-nums">
        {fmt2(p.rating)}
      </TableCell>
      <TableCell className="text-center font-mono tabular-nums">
        {fmt2(p.kd)}
      </TableCell>
      <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
        {p.matches}
      </TableCell>
      <TableCell className="pr-4 text-right">
        <Sparkline values={p.elo_trend} />
      </TableCell>
    </RowLink>
  )
}

// ---------- Temporada ----------

function SeasonView({ season, search, onChange }: Props & { season: Season }) {
  const podium = useQuery(standingsPodiumOptions(season.id))
  const list = useQuery(standingsOptions(season.id, search))
  const mine = useMine()
  const navigate = useNavigate()
  const active = season.status === "active"
  const sort =
    search.sort === "elo" || search.sort === "matches" ? search.sort : undefined
  const order = search.order ?? "desc"

  const sortBy = (key: "elo" | "matches") => {
    if (sort === key && order === "asc")
      onChange({ sort: undefined, order: undefined, page: undefined })
    else if (sort === key) onChange({ order: "asc", page: undefined })
    else onChange({ sort: key, order: undefined, page: undefined })
  }

  const items: PodiumItem[] = (podium.data ?? []).map((r) => ({
    key: r.player.id,
    name: r.player.alias,
    sub: `Nivel ${r.level ?? "—"} · ${r.matches} mixes`,
    value: r.elo,
    badge: (
      <PlayerAvatar
        alias={r.player.alias}
        photo={r.player.photo_url}
        className="size-[46px]"
      />
    ),
    link: <PlayerLink alias={r.player.alias} cover />,
  }))

  const head = "h-auto py-2.5 text-xs font-medium text-muted-foreground"

  return (
    <>
      <Podium items={items} loading={podium.isPending} />
      <div className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]">
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
          <span className="ml-auto text-xs text-muted-foreground">
            {list.data ? `${list.data.total} jugadores` : ""}
          </span>
        </div>
        <Table className="min-w-[880px] text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(head, "w-14 pl-4")}>#</TableHead>
              <TableHead className={head}>Jugador</TableHead>
              <TableHead className={cn(head, "text-center")}>Nivel</TableHead>
              <TableHead className={cn(head, "text-right")}>
                <SortHead
                  label="ELO"
                  active={sort === "elo"}
                  order={order}
                  onClick={() => sortBy("elo")}
                />
              </TableHead>
              <TableHead className={cn(head, "text-right")}>Pico</TableHead>
              <TableHead className={cn(head, "text-center")}>
                <SortHead
                  label="Mixes"
                  active={sort === "matches"}
                  order={order}
                  onClick={() => sortBy("matches")}
                />
              </TableHead>
              <TableHead className={cn(head, "text-center")}>V–D</TableHead>
              <TableHead className={head}>
                {active ? "Medalla si cierra hoy" : "Medalla"}
              </TableHead>
              <TableHead className={cn(head, "pr-4 text-right")}>
                {active ? "Al cerrar" : "Después del cierre"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ListState
              query={list}
              cols={9}
              empty="No hay jugadores con esos filtros."
            >
              {list.data?.items.map((r) => (
                <StandingRow
                  key={r.player.id}
                  r={r}
                  min={season.min_matches}
                  me={r.player.id === mine.playerId}
                  onOpen={() =>
                    void navigate({
                      to: "/player/$nick",
                      params: { nick: r.player.alias },
                    })
                  }
                />
              ))}
            </ListState>
          </TableBody>
        </Table>
        <Paging search={search} total={list.data?.total} onChange={onChange} />
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          Sin puesto: jugaron menos de {season.min_matches} mixes en la
          temporada. Al cerrar, los nivel 10 se reinician al {season.reset_pct}{" "}
          % sobre {season.reset_floor}.
        </p>
      </div>
    </>
  )
}

function StandingRow({
  r,
  min,
  me,
  onOpen,
}: {
  r: SeasonStanding
  min: number
  me: boolean
  onOpen: () => void
}) {
  const out = !r.eligible
  return (
    <RowLink
      label={r.player.alias}
      me={me}
      onOpen={onOpen}
      className={cn(out && "text-muted-foreground")}
    >
      <TableCell className="pl-4 font-mono text-[13px] font-semibold text-muted-foreground">
        {r.rank ?? "—"}
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-2.5">
          <PlayerAvatar alias={r.player.alias} photo={r.player.photo_url} />
          <span className="font-medium text-foreground">{r.player.alias}</span>
        </span>
      </TableCell>
      <TableCell className="text-center">
        <LevelCell level={r.level} />
      </TableCell>
      <TableCell className="text-right font-mono font-semibold text-foreground tabular-nums">
        {r.elo}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {r.peak_elo}
      </TableCell>
      <TableCell className="text-center">
        {out ? (
          <Progress matches={r.matches} min={min} />
        ) : (
          <span className="font-mono tabular-nums">{r.matches}</span>
        )}
      </TableCell>
      <TableCell className="text-center font-mono tabular-nums">
        {r.wins}–{r.losses}
      </TableCell>
      <TableCell>
        {r.medal ? (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span aria-hidden className="text-sm leading-none">
              {r.medal.icon}
            </span>
            {r.medal.name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="pr-4 text-right">
        {r.elo_after !== r.elo ? (
          <span className="font-mono text-xs font-medium tabular-nums">
            {r.elo_after}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Sin cambio</span>
        )}
      </TableCell>
    </RowLink>
  )
}

function Progress({ matches, min }: { matches: number; min: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-10 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full bg-muted-foreground"
              style={{ width: `${Math.min(100, (matches / min) * 100)}%` }}
            />
          </span>
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

export function RowLink({
  label,
  me,
  onOpen,
  className,
  children,
}: {
  label: string
  me: boolean
  onOpen: () => void
  className?: string
  children: ReactNode
}) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") onOpen()
  }
  return (
    <TableRow
      role="link"
      tabIndex={0}
      aria-label={label}
      aria-current={me ? "true" : undefined}
      onClick={onOpen}
      onKeyDown={onKey}
      className={cn(
        "cursor-pointer hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
        me && "bg-primary/6 hover:bg-primary/10",
        className
      )}
    >
      {children}
    </TableRow>
  )
}

/** Skeleton, error con reintento o vacío; si no, las filas. */
export function ListState({
  query,
  cols,
  empty,
  children,
}: {
  query: {
    isPending: boolean
    isError: boolean
    error: unknown
    data?: { items: unknown[] }
    refetch: () => unknown
  }
  cols: number
  empty: string
  children: ReactNode
}) {
  if (query.isPending)
    return Array.from({ length: 8 }, (_, i) => (
      <TableRow key={i} className="hover:bg-transparent">
        <TableCell colSpan={cols} className="px-4 py-3">
          <Skeleton className="h-7 w-full" />
        </TableCell>
      </TableRow>
    ))
  if (query.isError)
    return (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={cols} className="px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {errorMessage(query.error)}
          </p>
          {isRetryable(query.error) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void query.refetch()}
            >
              Reintentar
            </Button>
          )}
        </TableCell>
      </TableRow>
    )
  if (!query.data?.items.length)
    return (
      <TableRow className="hover:bg-transparent">
        <TableCell
          colSpan={cols}
          className="px-4 py-10 text-center text-[13px] text-muted-foreground"
        >
          {empty}
        </TableCell>
      </TableRow>
    )
  return children
}

export function Paging({
  search,
  total,
  onChange,
}: {
  search: { page?: number; per?: 25 | 50 | 100 }
  total: number | undefined
  onChange: (patch: { page?: number; per?: 25 | 50 | 100 }) => void
}) {
  return (
    <ListPagination
      total={total ?? 0}
      page={search.page ?? 1}
      per={search.per ?? DEFAULT_PER}
      perOptions={PER_OPTIONS}
      perLabel="Filas por página"
      onPage={(p) => onChange({ page: p === 1 ? undefined : p })}
      onPer={(n) =>
        onChange({
          per: n === DEFAULT_PER ? undefined : (n as 50 | 100),
          page: undefined,
        })
      }
    />
  )
}
