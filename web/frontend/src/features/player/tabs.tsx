import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import {
  CalendarIcon,
  ClockIcon,
  CrosshairIcon,
  CrownIcon,
  FilterXIcon,
  FlagIcon,
  MapIcon,
  MedalIcon,
  PencilIcon,
  QuoteIcon,
  SearchIcon,
  SwordsIcon,
  TriangleAlertIcon,
  TrophyIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"

import { errorMessage, isRetryable } from "@/api/errors"
import { CountryFlag } from "@/components/brand/CountryFlag"
import { EmptyState } from "@/components/brand/EmptyState"
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
import { mapsOptions } from "@/features/maps/queries"
import { COUNTRIES } from "@/features/profile/schemas"
import { useMine } from "@/features/ranking/parts"
import { STATUS_LABEL } from "@/features/teams/model"
import { useTeamLogos } from "@/features/teams/queries"
import { Soon, STATUS_CHIP, TeamCrest } from "@/features/teams/ui"
import { KeyPlays } from "./KeyPlays"
import {
  KIND_LABEL,
  adjustmentLabel,
  bestSeasonId,
  fmtAgo,
  fmtDay,
  fmtLong,
  fmtMonthShort,
  legacyTeams,
  mapCards,
  matchTitle,
  resultOf,
  scoreOf,
  stintLength,
  type MapCard,
} from "./labels"
import {
  adjustmentsOptions,
  mapStatsOptions,
  medalsOptions,
  playerMatchesOptions,
  recentMatchesOptions,
  seasonsOptions,
  teamsOptions,
  titlesOptions,
  type PlayerDetail,
  type PlayerMatch,
  type PlayerSeason,
  type TeamStint,
  type Title,
} from "./queries"
import {
  DEFAULT_PER,
  PER_OPTIONS,
  TABS,
  type PlayerSearch,
  type Tab,
} from "./search"

const LABELS: Record<Tab, string> = {
  resumen: "Resumen",
  mapas: "Mapas",
  partidas: "Partidas",
  equipos: "Equipos",
  temporadas: "Temporadas",
  bio: "Bio y torneos",
}

type Props = {
  nick: string
  player: PlayerDetail
  search: PlayerSearch
  onTab: (tab: Tab) => void
  onChange: (patch: Partial<PlayerSearch>) => void
}

/** Cuántos hay en cada pestaña de lista (sin filtros); mientras carga, nada. */
function useTabCounts(nick: string): Partial<Record<Tab, number>> {
  const maps = useQuery(mapStatsOptions(nick)).data
  const matches = useQuery(playerMatchesOptions(nick, {})).data
  const teams = useQuery(teamsOptions(nick)).data
  const seasons = useQuery(seasonsOptions(nick)).data
  return {
    mapas: maps?.length,
    partidas: matches?.total,
    equipos: teams?.length,
    temporadas: seasons?.length,
  }
}

/**
 * Fila de pestañas en el teléfono: si se corta a la derecha va el degradado, y la activa se
 * desplaza a la vista (solo en horizontal: la página no se mueve).
 */
function useTabRow(tab: Tab) {
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  useEffect(() => {
    const row = ref.current
    const el = row?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!row || !el) return
    const out =
      el.offsetLeft < row.scrollLeft ||
      el.offsetLeft + el.offsetWidth > row.scrollLeft + row.clientWidth
    if (out) row.scrollTo({ left: el.offsetLeft - 16 })
  }, [tab])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () =>
      setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    check()
    el.addEventListener("scroll", check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", check)
      ro.disconnect()
    }
  }, [])
  return { ref, more }
}

export function PlayerTabs({ nick, player, search, onTab, onChange }: Props) {
  const tab = search.tab ?? "resumen"
  const counts = useTabCounts(nick)
  const owner = useMine().playerId === player.id
  const { ref: rowRef, more } = useTabRow(tab)
  return (
    <>
      {/* Fija bajo la topbar (52px) al bajar, con fondo translúcido. */}
      <div className="sticky top-[52px] z-[5] -mt-px bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div
          ref={rowRef}
          role="tablist"
          aria-label="Secciones del perfil"
          className="flex [scrollbar-width:none] gap-1 overflow-x-auto border-b"
        >
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`tab-${t}`}
              aria-selected={tab === t}
              aria-controls="player-tab"
              onClick={() => onTab(t)}
              className={cn(
                "group/tab flex h-[38px] shrink-0 items-center gap-1.5 px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                tab === t &&
                  "text-foreground shadow-[inset_0_-2px_0_var(--foreground)]"
              )}
            >
              {LABELS[t]}
              {counts[t] !== undefined && (
                <span className="rounded-full bg-muted px-1.5 font-mono text-[11px] leading-4 font-semibold text-muted-foreground tabular-nums group-aria-selected/tab:bg-foreground group-aria-selected/tab:text-background">
                  {counts[t]}
                </span>
              )}
            </button>
          ))}
        </div>
        {more && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-r from-transparent to-background"
          />
        )}
      </div>
      {/* Alto de una pantalla: con una pestaña corta (o cargando) el navegador no recorta el
          scroll y las pestañas quedan donde estaban. */}
      <div
        role="tabpanel"
        id="player-tab"
        aria-labelledby={`tab-${tab}`}
        className="min-h-svh"
      >
        {tab === "resumen" && (
          <Summary
            nick={nick}
            player={player}
            onAll={() => onTab("partidas")}
          />
        )}
        {tab === "mapas" && <Maps nick={nick} />}
        {tab === "partidas" && (
          <Matches nick={nick} search={search} onChange={onChange} />
        )}
        {tab === "equipos" && (
          <Teams nick={nick} legacy={player.team_history_text} owner={owner} />
        )}
        {tab === "temporadas" && <Seasons nick={nick} />}
        {tab === "bio" && <Bio nick={nick} player={player} owner={owner} />}
      </div>
    </>
  )
}

const card = "rounded-xl border bg-card"

/** Skeleton o error con reintento; si no, el contenido. */
function Loaded<T>({
  q,
  children,
}: {
  q: {
    isPending: boolean
    isError: boolean
    error: unknown
    data?: T
    refetch: () => unknown
  }
  children: (data: T) => ReactNode
}) {
  if (q.isPending) return <Skeleton className="h-32 rounded-xl" />
  if (q.isError)
    return (
      <div className={cn(card, "px-4 py-8 text-center")}>
        <p className="text-sm text-muted-foreground">{errorMessage(q.error)}</p>
        {isRetryable(q.error) && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void q.refetch()}
          >
            Reintentar
          </Button>
        )}
      </div>
    )
  return children(q.data as T)
}

function Delta({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted-foreground">—</span>
  return (
    <span className={v >= 0 ? "text-win" : "text-destructive"}>
      {v > 0 ? `+${v}` : v}
    </span>
  )
}

const RESULT_CHIP = {
  V: "bg-win/18 text-win",
  D: "bg-destructive/15 text-destructive",
  E: "bg-muted text-muted-foreground",
}

function useOpenMatch() {
  const navigate = useNavigate()
  return (m: PlayerMatch) =>
    void navigate({ to: "/match/$id", params: { id: m.match_id } })
}

// ---------- Resumen ----------

function Summary({
  nick,
  player,
  onAll,
}: {
  nick: string
  player: PlayerDetail
  onAll: () => void
}) {
  const recent = useQuery(recentMatchesOptions(nick))
  const medals = useQuery(medalsOptions(nick))
  const adjustments = useQuery(adjustmentsOptions(nick))
  const open = useOpenMatch()

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className={cn(card, "overflow-hidden")}>
        <div className="flex items-center border-b px-4 py-3.5 text-sm font-semibold">
          Partidas recientes
          <button
            type="button"
            onClick={onAll}
            className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Ver todas
          </button>
        </div>
        <Loaded q={recent}>
          {(items) =>
            items.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                Todavía no jugó partidas en el servidor.
              </p>
            ) : (
              items.map((m) => {
                const t = matchTitle(m)
                const r = resultOf(m.won)
                return (
                  <button
                    key={m.match_id}
                    type="button"
                    onClick={() => open(m)}
                    className="grid w-full grid-cols-[24px_minmax(0,1fr)_64px_56px_52px] items-center gap-3 border-b px-4 py-2.5 text-left text-[13px] last:border-b-0 hover:bg-muted max-sm:grid-cols-[24px_minmax(0,1fr)_44px_48px] max-sm:gap-2"
                  >
                    <span
                      className={cn(
                        "grid size-[22px] place-items-center rounded-[5px] font-mono text-[11px] font-semibold",
                        RESULT_CHIP[r]
                      )}
                    >
                      {r}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{t.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {t.sub}
                      </span>
                    </span>
                    <span className="font-mono text-muted-foreground tabular-nums max-sm:hidden">
                      {m.kills ?? 0}-{m.deaths ?? 0}
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      {m.rating?.toFixed(2) ?? "—"}
                    </span>
                    <span className="text-right font-mono text-xs font-semibold tabular-nums">
                      <Delta v={m.elo_delta} />
                    </span>
                  </button>
                )
              })
            )
          }
        </Loaded>
      </div>
      <div className="flex flex-col gap-4">
        <div className={cn(card, "flex flex-col gap-3 p-4")}>
          <span className="text-sm font-semibold">Logros</span>
          <Loaded q={medals}>
            {(items) =>
              items.length === 0 ? (
                <span className="text-[13px] text-muted-foreground">
                  Todavía sin medallas.
                </span>
              ) : (
                items.map((m) => (
                  <div
                    key={`${m.title}-${m.icon}`}
                    className="flex items-center gap-3"
                  >
                    <span
                      aria-hidden
                      className="grid size-9 place-items-center rounded-lg bg-primary/12 text-lg"
                    >
                      {m.icon ?? "🏅"}
                    </span>
                    <span className="flex-1 text-sm font-medium">
                      {m.title}
                    </span>
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      ×{m.count}
                    </span>
                  </div>
                ))
              )
            }
          </Loaded>
        </div>
        {/* Solo si el admin le hizo algún ajuste (contrato 5). */}
        {adjustments.data && adjustments.data.length > 0 && (
          <div className={cn(card, "flex flex-col gap-3 p-4")}>
            <span className="text-sm font-semibold">Ajustes de ELO</span>
            {adjustments.data.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 text-[13px]">
                <span
                  className={cn(
                    "min-w-14 font-mono text-xs font-semibold tabular-nums",
                    a.kind === "set"
                      ? "text-foreground"
                      : a.delta >= 0
                        ? "text-win"
                        : "text-destructive"
                  )}
                >
                  {adjustmentLabel(a)}
                </span>
                <span className="flex-1 text-pretty">{a.reason}</span>
                <span className="text-xs whitespace-nowrap text-muted-foreground">
                  {fmtDay(a.applied_at)}
                </span>
              </div>
            ))}
          </div>
        )}
        <KeyPlays stats={player.stats} />
      </div>
    </div>
  )
}

// ---------- Mapas ----------

function Maps({ nick }: { nick: string }) {
  const q = useQuery(mapStatsOptions(nick))
  const catalog = useQuery(mapsOptions).data
  return (
    <Loaded q={q}>
      {(items) => {
        const cards = mapCards(catalog, items)
        if (!cards.length)
          return (
            <div className={cn(card, "flex min-h-[396px]")}>
              <EmptyState icon={MapIcon} title="Todavía no jugó mapas">
                Sus estadísticas por mapa aparecen al jugar en el servidor.
              </EmptyState>
            </div>
          )
        return (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {cards.map((m) => (
              <MapTile key={m.key} map={m} />
            ))}
          </div>
        )
      }}
    </Loaded>
  )
}

/** Un mapa: foto, mapas jugados, % de victorias, K/D y ADR. Sin partidas, atenuado y en cero. */
function MapTile({ map }: { map: MapCard }) {
  const s = map.stat
  const played = (s?.wins ?? 0) + (s?.losses ?? 0)
  const wr = played ? Math.round(((s?.wins ?? 0) / played) * 100) : 0
  const maps = s?.maps ?? played
  return (
    <div className={cn(card, "flex flex-col overflow-hidden")}>
      <div
        className={cn(
          "relative h-[72px] border-b bg-cover bg-center",
          !map.image &&
            "bg-[repeating-linear-gradient(135deg,var(--muted)_0_8px,transparent_8px_16px)]",
          !s && "opacity-45 grayscale"
        )}
        style={
          map.image
            ? {
                backgroundImage: `linear-gradient(to top, rgb(0 0 0 / .6), transparent 70%), url(${map.image})`,
              }
            : undefined
        }
      >
        {map.retired && (
          <span className="absolute top-2 left-2.5 inline-flex h-5 items-center rounded-full bg-background/85 px-2 text-[11px] font-semibold text-muted-foreground">
            Retirado
          </span>
        )}
        <span
          className={cn(
            "absolute bottom-2 left-3 font-mono text-sm font-semibold",
            map.image && "text-white"
          )}
        >
          {map.name}
        </span>
        <span
          className={cn(
            "absolute top-2 right-2.5 text-[11.5px]",
            map.image ? "text-white/85" : "text-muted-foreground"
          )}
        >
          {maps} {maps === 1 ? "mapa" : "mapas"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3 text-xs">
        <Stat label="% Vict." value={`${wr}%`} muted={!s} />
        <Stat label="K/D" value={(s?.kd ?? 0).toFixed(2)} muted={!s} />
        <Stat label="ADR" value={String(Math.round(s?.adr ?? 0))} muted={!s} />
      </div>
      {!s && (
        <span className="-mt-1 px-3 pb-2.5 text-[11.5px] text-muted-foreground">
          Sin partidas
        </span>
      )}
      <div className="mt-auto h-[3px] bg-muted">
        <div
          className={cn("h-full", wr >= 50 ? "bg-win" : "bg-muted-foreground")}
          style={{ width: `${wr}%` }}
        />
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          muted && "text-muted-foreground"
        )}
      >
        {value}
      </span>
    </span>
  )
}

// ---------- Partidas ----------

const KINDS = [
  { value: undefined, label: "Todas" },
  { value: "mix", label: "Mix" },
  { value: "pcw", label: "PCW" },
  { value: "official", label: "Torneo" },
] as const
const RESULTS = [
  { value: undefined, label: "Cualquier resultado" },
  { value: "won", label: "Victorias" },
  { value: "lost", label: "Derrotas" },
] as const

function Chips<V extends string | undefined>({
  label,
  options,
  value,
  onPick,
}: {
  label: string
  options: readonly { value: V; label: string }[]
  value: V
  onPick: (v: V) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onPick(o.value)}
          className={cn(
            "h-7 rounded-full border px-2.5 text-xs font-medium transition-colors",
            value === o.value
              ? "border-foreground bg-foreground text-background"
              : "hover:bg-muted"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const MATCH_HEAD = "h-auto py-2.5 text-xs font-medium text-muted-foreground"

/** Cabecera de la tabla de partidas; el cuerpo lo pone quien la usa. */
function MatchTable({ children }: { children: ReactNode }) {
  return (
    <Table className="min-w-[700px] text-[13px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(MATCH_HEAD, "pl-4")}>Fecha</TableHead>
          <TableHead className={MATCH_HEAD}>Tipo</TableHead>
          <TableHead className={MATCH_HEAD}>Mapa</TableHead>
          <TableHead className={MATCH_HEAD}>Nombre en el juego</TableHead>
          <TableHead className={MATCH_HEAD}>Resultado</TableHead>
          <TableHead className={MATCH_HEAD}>K-D</TableHead>
          <TableHead className={MATCH_HEAD}>Rating</TableHead>
          <TableHead className={cn(MATCH_HEAD, "pr-4 text-right")}>
            ELO
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  )
}

function Matches({
  nick,
  search,
  onChange,
}: {
  nick: string
  search: PlayerSearch
  onChange: (patch: Partial<PlayerSearch>) => void
}) {
  const q = useQuery(playerMatchesOptions(nick, search))
  // El total sin filtros (el mismo del contador de la pestaña) para el vacío con filtros.
  const all = useQuery(playerMatchesOptions(nick, {})).data?.total
  const filtered = !!(search.kind || search.result)
  const open = useOpenMatch()
  const onKey = (m: PlayerMatch) => (e: KeyboardEvent) => {
    if (e.key === "Enter") open(m)
  }

  return (
    <div className={cn(card, "overflow-hidden")}>
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <Chips
          label="Tipo"
          options={KINDS}
          value={search.kind}
          onPick={(kind) => onChange({ kind, page: undefined })}
        />
        <span aria-hidden className="h-5 w-px bg-border" />
        <Chips
          label="Resultado"
          options={RESULTS}
          value={search.result}
          onPick={(result) => onChange({ result, page: undefined })}
        />
      </div>
      {/* Alto de 8 filas haya las que haya: la tarjeta no salta al filtrar. */}
      <div className="flex min-h-[396px] flex-col">
        {q.isPending ? (
          <MatchTable>
            {Array.from({ length: 8 }, (_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell colSpan={8} className="px-4 py-2.5">
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ))}
          </MatchTable>
        ) : q.isError ? (
          <EmptyState
            icon={TriangleAlertIcon}
            title="No se pudieron cargar las partidas"
            action={
              isRetryable(q.error) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void q.refetch()}
                >
                  Reintentar
                </Button>
              )
            }
          >
            {errorMessage(q.error)}
          </EmptyState>
        ) : !q.data.items.length ? (
          filtered ? (
            <EmptyState
              icon={FilterXIcon}
              title="Ninguna partida con esos filtros"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange({
                      kind: undefined,
                      result: undefined,
                      page: undefined,
                    })
                  }
                >
                  Quitar filtros
                </Button>
              }
            >
              {all
                ? `Tiene ${all} ${all === 1 ? "partida" : "partidas"}, pero ninguna con esos filtros.`
                : "Prueba con otro tipo o resultado."}
            </EmptyState>
          ) : (
            <EmptyState icon={SwordsIcon} title="Todavía no jugó partidas">
              Aparecen acá al jugar un mix, un PCW o un partido de torneo en el
              servidor.
            </EmptyState>
          )
        ) : (
          <MatchTable>
            {q.data.items.map((m) => {
              const r = resultOf(m.won)
              return (
                <TableRow
                  key={m.match_id}
                  role="link"
                  tabIndex={0}
                  aria-label={matchTitle(m).title}
                  onClick={() => open(m)}
                  onKeyDown={onKey(m)}
                  className="h-11 cursor-pointer hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <TableCell className="pl-4">
                    {m.played_at ? fmtDay(m.played_at) : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex h-5 items-center rounded-[4px] bg-secondary px-1.5 text-[11px] font-medium">
                      {KIND_LABEL[m.kind]}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono">{m.map ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.game_nick ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-mono font-semibold tabular-nums",
                        r === "V"
                          ? "text-win"
                          : r === "D"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      )}
                    >
                      {r} {scoreOf(m) ?? ""}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {m.kills ?? 0}-{m.deaths ?? 0}
                  </TableCell>
                  <TableCell className="font-mono font-semibold tabular-nums">
                    {m.rating?.toFixed(2) ?? "—"}
                  </TableCell>
                  <TableCell className="pr-4 text-right font-mono text-xs font-semibold tabular-nums">
                    <Delta v={m.elo_delta} />
                  </TableCell>
                </TableRow>
              )
            })}
          </MatchTable>
        )}
      </div>
      {!!q.data?.total && (
        <div className="border-t">
          <ListPagination
            total={q.data.total}
            page={search.page ?? 1}
            per={search.per ?? DEFAULT_PER}
            perOptions={PER_OPTIONS}
            perLabel="Partidas por página"
            onPage={(p) => onChange({ page: p === 1 ? undefined : p })}
            onPer={(n) =>
              onChange({
                per: n === DEFAULT_PER ? undefined : (n as 50 | 100),
                page: undefined,
              })
            }
          />
        </div>
      )}
    </div>
  )
}

// ---------- Equipos ----------

/**
 * Se puede estar en varios equipos a la vez, así que no hay línea de tiempo: los actuales como
 * tarjetas (cada una con su rol) y los anteriores en una lista.
 */
function Teams({
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
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">
              <CrownIcon className="size-3" aria-hidden />
              Líder
            </span>
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
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold",
        current ? STATUS_CHIP[status] : "bg-muted text-muted-foreground"
      )}
    >
      {current && status === "player" && (
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
      )}
      {current ? STATUS_LABEL[status] : "Ex integrante"}
    </span>
  )
}

// ---------- Temporadas ----------

function Seasons({ nick }: { nick: string }) {
  const q = useQuery(seasonsOptions(nick))
  return (
    <Loaded q={q}>
      {(items) => {
        if (!items.length)
          return (
            <div className={cn(card, "flex min-h-[396px] flex-col pb-6")}>
              <EmptyState
                icon={MedalIcon}
                title="Todavía no terminó ninguna temporada"
                className="flex-none pt-10"
              >
                Al cierre de cada temporada se guarda acá su puesto, su medalla
                y su ELO final.
              </EmptyState>
              {/* Tarjetas fantasma: dicen qué va a aparecer. */}
              <div
                aria-hidden
                className="mx-auto grid w-full max-w-[820px] gap-3 px-5 sm:grid-cols-3"
              >
                {[60, 50, 65].map((w) => (
                  <div
                    key={w}
                    className="flex items-center gap-3 rounded-xl border-[1.5px] border-dashed p-4 opacity-80"
                  >
                    <span className="grid size-[52px] shrink-0 place-items-center rounded-full bg-muted font-mono text-lg text-muted-foreground">
                      ?
                    </span>
                    <span className="flex flex-1 flex-col gap-1.5">
                      <i
                        className="block h-2.5 rounded bg-muted"
                        style={{ width: `${w}%` }}
                      />
                      <i
                        className="block h-2.5 rounded bg-muted"
                        style={{ width: `${w + 20}%` }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        const best = bestSeasonId(items)
        return (
          <div className="grid min-h-[396px] grid-cols-[repeat(auto-fill,minmax(300px,1fr))] content-start gap-3 pt-2.5">
            {items.map((s) => (
              <SeasonCard key={s.season.id} s={s} best={s.season.id === best} />
            ))}
          </div>
        )
      }}
    </Loaded>
  )
}

function SeasonCard({ s, best }: { s: PlayerSeason; best: boolean }) {
  const played = s.wins + s.losses
  const wr = played ? Math.round((s.wins / played) * 100) : 0
  return (
    <div
      className={cn(
        card,
        "relative flex flex-col gap-3.5 p-4",
        best && "border-amber-400/70 ring-3 ring-amber-400/15"
      )}
    >
      {best && (
        <span className="absolute -top-[11px] left-3.5 inline-flex h-[22px] items-center gap-1 rounded-full bg-amber-400 px-2 text-[11px] font-semibold text-amber-950 shadow-[0_0_0_3px_var(--background)]">
          ★ Mejor temporada
        </span>
      )}
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "grid size-[52px] shrink-0 place-items-center rounded-full border text-[26px]",
            s.medal
              ? "border-amber-400/45 bg-amber-400/15"
              : "bg-muted text-lg text-muted-foreground"
          )}
        >
          {s.medal?.icon ?? "—"}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold">
            {s.season.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {s.medal ? `Medalla: ${s.medal.name}` : "Sin medalla"}
          </span>
        </span>
        <span className="ml-auto flex shrink-0 flex-col items-end">
          {s.eligible && s.rank !== null ? (
            <>
              <span className="font-mono text-2xl leading-none font-semibold tracking-[-0.5px] tabular-nums">
                #{s.rank}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Puesto final
              </span>
            </>
          ) : (
            <span className="inline-flex h-[22px] items-center rounded-full bg-muted px-2 text-[11px] font-semibold text-muted-foreground">
              No clasificó
            </span>
          )}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <SeasonKv label="ELO final">{s.elo}</SeasonKv>
        <SeasonKv label="Pico">{s.peak_elo}</SeasonKv>
        <SeasonKv label="Nivel">
          {s.level !== null ? (
            <span className="inline-grid h-[22px] min-w-[22px] place-items-center rounded-md bg-foreground px-1 text-[11px] text-background">
              {s.level}
            </span>
          ) : (
            "—"
          )}
        </SeasonKv>
      </dl>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {s.matches} {s.matches === 1 ? "mix" : "mixes"} ·{" "}
            <b className="font-semibold text-win">{s.wins} V</b> –{" "}
            <b className="font-semibold text-destructive">{s.losses} D</b>
          </span>
          <span className="font-mono tabular-nums">{wr}%</span>
        </div>
        <div
          role="img"
          aria-label={`${wr}% de victorias`}
          className="flex h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <span className="bg-win" style={{ width: `${wr}%` }} />
          {played > 0 && (
            <span
              className="bg-destructive/70"
              style={{ width: `${100 - wr}%` }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SeasonKv({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
      <dd className="font-mono text-[15px] font-semibold tabular-nums">
        {children}
      </dd>
    </div>
  )
}

// ---------- Bio y torneos ----------

function Bio({
  nick,
  player,
  owner,
}: {
  nick: string
  player: PlayerDetail
  owner: boolean
}) {
  const d = player.details
  const bio = player.bio?.trim()
  const country =
    d?.country && (COUNTRIES as readonly string[]).includes(d.country)
      ? (d.country as (typeof COUNTRIES)[number])
      : null
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(240px,1fr)]">
        <div className={cn(card, "flex flex-col items-start gap-3 p-5")}>
          <QuoteIcon
            aria-hidden
            className={cn(
              "size-7",
              bio ? "text-primary" : "text-muted-foreground/50"
            )}
          />
          {bio ? (
            <>
              <p className="max-w-[62ch] text-[15px] leading-relaxed text-pretty whitespace-pre-line">
                {bio}
              </p>
              <span className="text-[13px] text-muted-foreground">
                — {player.alias}
              </span>
            </>
          ) : (
            <>
              <p className="text-[15px] text-muted-foreground">
                Todavía no tiene biografía.
              </p>
              {/* La biografía hoy solo la edita un admin (pedido al backend). */}
              {owner && (
                <Soon label="Escribir tu biografía · Próximamente">
                  <Button variant="outline" size="sm" disabled>
                    <PencilIcon aria-hidden />
                    Escribir biografía
                  </Button>
                </Soon>
              )}
            </>
          )}
        </div>
        <dl className={cn(card, "flex flex-col px-4 py-1.5")}>
          <Fact icon={FlagIcon} label="País">
            {d?.country ? (
              <span className="inline-flex items-center gap-1.5">
                {country && <CountryFlag country={country} />}
                {d.country}
              </span>
            ) : null}
          </Fact>
          <Fact icon={CrosshairIcon} label="Rol">
            {d?.game_role}
          </Fact>
          <Fact icon={CalendarIcon} label="Miembro desde">
            {d?.joined_at && fmtMonthShort(d.joined_at)}
          </Fact>
          <Fact icon={ClockIcon} label="Última conexión">
            {d?.last_seen && fmtAgo(d.last_seen)}
          </Fact>
        </dl>
      </div>
      <Palmares nick={nick} />
    </div>
  )
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 border-b py-2.5 text-[13px] last:border-b-0">
      <Icon aria-hidden className="size-4 text-muted-foreground" />
      <dt className="flex-1 text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">
        {children || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  )
}

/**
 * Vitrina: los títulos de torneos de la plataforma (campeón o subcampeón) y las medallas que
 * entregan los admins. Cada bloque aparece solo si tiene algo.
 */
function Palmares({ nick }: { nick: string }) {
  const titles = useQuery(titlesOptions(nick))
  const medals = useQuery(medalsOptions(nick))
  const withLogo = useTeamLogos((titles.data ?? []).map((t) => t.team))
  return (
    <Loaded q={titles}>
      {(won) => (
        <Loaded q={medals}>
          {(given) => {
            const empty = !won.length && !given.length
            const summary = [
              won.length &&
                `${won.length} ${won.length === 1 ? "título" : "títulos"} de torneo`,
              given.length &&
                `${given.length} ${given.length === 1 ? "medalla" : "medallas"}`,
            ]
              .filter(Boolean)
              .join(" · ")
            return (
              <section
                aria-label="Palmarés"
                className={cn(
                  card,
                  "flex flex-col gap-4 p-[18px]",
                  !empty &&
                    "bg-gradient-to-b from-amber-400/[0.07] via-card to-card"
                )}
              >
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <h3 className="text-[15px] font-semibold">Palmarés</h3>
                  <span className="text-[12.5px] text-muted-foreground">
                    {empty ? "Todavía sin títulos" : summary}
                  </span>
                </div>
                {empty ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
                    <TrophySlot icon={TrophyIcon}>
                      Gana un torneo con tu equipo
                    </TrophySlot>
                    <TrophySlot icon={MedalIcon}>
                      Las medallas las entregan los admins
                    </TrophySlot>
                  </div>
                ) : (
                  <>
                    {won.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Torneos
                        </span>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
                          {won.map((t) => (
                            <TitleCard
                              key={`${t.event.id}-${t.result}`}
                              t={{ ...t, team: withLogo(t.team) }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {given.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Medallas
                        </span>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
                          {given.map((m) => (
                            <div
                              key={`${m.title}-${m.icon}`}
                              className={cn(
                                "flex items-center gap-2.5 rounded-[10px] bg-muted",
                                won.length ? "p-2.5" : "p-3.5"
                              )}
                            >
                              <span
                                aria-hidden
                                className={
                                  won.length ? "text-xl" : "text-[26px]"
                                }
                              >
                                {m.icon ?? "🏅"}
                              </span>
                              <span className="flex min-w-0 flex-col">
                                <span className="text-[12.5px] font-semibold break-words">
                                  {m.title}
                                </span>
                                <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                                  ×{m.count}
                                  {m.last_at &&
                                    ` · ${fmtMonthShort(m.last_at)}`}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>
            )
          }}
        </Loaded>
      )}
    </Loaded>
  )
}

function TitleCard({ t }: { t: Title }) {
  const champion = t.result === "champion"
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-3.5">
      <span
        className={cn(
          "grid size-11 place-items-center rounded-xl",
          champion
            ? "bg-amber-400/20 text-amber-500"
            : "bg-slate-400/20 text-slate-500 dark:text-slate-300"
        )}
      >
        <TrophyIcon aria-hidden className="size-[22px]" />
      </span>
      <span
        className={cn(
          "text-[11px] font-bold tracking-[0.06em] uppercase",
          champion ? "text-amber-500" : "text-slate-500 dark:text-slate-300"
        )}
      >
        {champion ? "Campeón" : "Subcampeón"}
      </span>
      <Link
        to="/events/$id"
        params={{ id: t.event.id }}
        className="text-sm font-semibold hover:underline"
      >
        {t.event.name}
      </Link>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <TeamCrest team={t.team} size="xs" />
        con {t.team.name}
        {t.at && ` · ${fmtLong(t.at)}`}
      </span>
    </div>
  )
}

function TrophySlot({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <div className="flex min-h-[132px] flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed p-3.5 text-center text-[12.5px] text-muted-foreground">
      <span className="grid size-11 place-items-center rounded-xl bg-muted">
        <Icon aria-hidden className="size-[22px]" />
      </span>
      {children}
    </div>
  )
}
