import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import {
  ArrowRightIcon,
  ChevronRightIcon,
  FilterXIcon,
  SearchIcon,
  SwordsIcon,
  TriangleAlertIcon,
  UnplugIcon,
  UserCheckIcon,
} from "lucide-react"
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react"

import { errorMessage, isRetryable } from "@/api/errors"
import { EmptyState } from "@/components/brand/EmptyState"
import { ListPagination } from "@/components/brand/ListPagination"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { mapsOptions, type MapEntry } from "@/features/maps/queries"
import { cancelReasonLabel, fmtDay, fmtTime } from "@/features/mixes/labels"
import { CancelChip, DemoStatus, WatchTvButton } from "@/features/mixes/parts"
import {
  liveMixesOptions,
  mixStatsOptions,
  type MixItem,
} from "@/features/mixes/queries"
import { Soon } from "@/features/teams/ui"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { matchesListOptions, type MatchSummary } from "./queries"
import {
  DEFAULT_PER,
  KINDS,
  PER_OPTIONS,
  type MatchesSearch,
  type MatchKind,
} from "./search"

// Listado /matches: mixes, PCW y torneos juntos (bitácora 2026-10-30-partidas-unificadas). Los
// filtros, la página y el tamaño viven en la URL. Los mixes en juego salen de /mixes, porque
// /matches no los trae.

type Patch = Partial<MatchesSearch>

const KIND_LABEL: Record<MatchKind, string> = {
  mix: "Mix",
  pcw: "PCW",
  official: "Torneo",
}

export function MatchesList({
  search,
  onChange,
}: {
  search: MatchesSearch
  /** Cambia la URL; cualquier cambio de filtro vuelve a la página 1. */
  onChange: (patch: Patch) => void
}) {
  const showLive = !search.kind || search.kind === "mix"
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.4px]">Partidas</h1>
        <p className="max-w-[72ch] text-sm text-pretty text-muted-foreground">
          Mixes, PCW y partidos de torneo jugados en el servidor. Cada mix
          actualiza el ELO de quienes jugaron; quien juega sin cuenta aparece
          como invitado con su nombre del juego.
        </p>
      </div>
      <MixKpis />
      <div
        id="lista-partidas"
        className="scroll-mt-4 overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]"
      >
        <Filters search={search} onChange={onChange} />
        {showLive && <LiveBlock />}
        <MatchesTable search={search} onChange={onChange} />
      </div>
    </section>
  )
}

// ---------- KPIs (los de Mixes) ----------

function MixKpis() {
  const { data } = useQuery(mixStatsOptions)
  const tiles = [
    {
      label: `Jugadores en los últimos ${data?.window_days ?? 30} días`,
      value: data?.players_recent,
    },
    { label: "Mapa más jugado", value: data && (data.top_map ?? "—") },
    {
      label: "Promedio de rondas",
      value:
        data && (data.avg_rounds === null ? "—" : data.avg_rounds.toFixed(1)),
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
      <LiveKpi count={data?.live_now} />
      {tiles.map((t) => (
        <div
          key={t.label}
          className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3.5 shadow-[0_1px_2px_rgb(0_0_0/.04)]"
        >
          <span className="text-xs text-muted-foreground">{t.label}</span>
          {t.value === undefined ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <span className="font-mono text-[22px] font-semibold tracking-[-0.5px] tabular-nums">
              {t.value}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * KPI "En vivo ahora": con mixes en juego, el punto rojo que late y "Ver" (baja al bloque En vivo
 * de la lista); sin mixes, el enchufe desconectado.
 */
function LiveKpi({ count }: { count: number | undefined }) {
  if (count === undefined)
    return <Skeleton className="col-span-2 h-[74px] rounded-xl md:col-span-1" />
  if (count === 0)
    return (
      <div className="col-span-2 flex items-center gap-3.5 rounded-xl border border-dashed bg-card px-4 py-3.5 md:col-span-1">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
          <UnplugIcon className="size-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">En vivo ahora</span>
          <span className="text-[15px] font-semibold">Ningún mix en juego</span>
        </span>
      </div>
    )
  return (
    <div className="col-span-2 flex items-center gap-3.5 rounded-xl border border-destructive/45 bg-[color-mix(in_oklch,var(--destructive)_7%,var(--card))] px-4 py-3.5 md:col-span-1">
      <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-destructive/16">
        <span
          aria-hidden
          className="absolute size-2.5 animate-ping rounded-full bg-destructive motion-reduce:animate-none"
        />
        <span
          aria-hidden
          className="relative size-2.5 rounded-full bg-destructive"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">En vivo ahora</span>
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-[22px] font-semibold tracking-[-0.5px] tabular-nums">
            {count}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {count === 1 ? "mix en juego" : "mixes en juego"}
          </span>
        </span>
      </span>
      <Button
        size="sm"
        className="bg-destructive text-white hover:bg-destructive/85"
        onClick={() =>
          document
            .getElementById("lista-partidas")
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      >
        Ver
        <ArrowRightIcon aria-hidden />
      </Button>
    </div>
  )
}

// ---------- Filtros ----------

const ALL_MAPS = "__all"

/** Mapas del select: los activos del catálogo, en su orden. */
function mapNames(maps: MapEntry[] | undefined): string[] {
  return (maps ?? [])
    .filter((m) => m.active)
    .sort((a, b) => a.position - b.position)
    .map((m) => m.name)
}

function Filters({
  search,
  onChange,
}: {
  search: MatchesSearch
  onChange: (patch: Patch) => void
}) {
  const [q, setQ] = useState(search.q ?? "")
  const debounced = useDebouncedValue(q, 300)
  const maps = mapNames(useQuery(mapsOptions).data)

  // El texto escrito pasa a la URL con debounce; si la URL cambia por otro lado, se sincroniza.
  useEffect(() => {
    if ((debounced.trim() || undefined) !== search.q)
      onChange({ q: debounced.trim() || undefined, page: undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia el texto
  }, [debounced])
  const [urlQ, setUrlQ] = useState(search.q)
  if (search.q !== urlQ) {
    setUrlQ(search.q)
    if ((q.trim() || undefined) !== search.q) setQ(search.q ?? "")
  }

  const dashed =
    "h-8 gap-1.5 border border-dashed px-2.5 text-[13px] font-normal hover:bg-accent data-[state=on]:bg-accent"

  return (
    <div className="flex flex-wrap items-center gap-2 border-b p-3">
      <div role="group" aria-label="Tipo" className="flex flex-wrap gap-1">
        {[undefined, ...KINDS].map((k) => (
          <button
            key={k ?? "all"}
            type="button"
            aria-pressed={search.kind === k}
            onClick={() => onChange({ kind: k, page: undefined })}
            className={cn(
              "h-7 rounded-full border px-2.5 text-xs font-medium transition-colors",
              search.kind === k
                ? "border-foreground bg-foreground text-background"
                : "hover:bg-muted"
            )}
          >
            {k ? KIND_LABEL[k] : "Todas"}
          </button>
        ))}
      </div>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <InputGroup className="max-w-[300px] min-w-[200px] flex-1">
        <InputGroupAddon>
          <SearchIcon aria-hidden className="size-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          // Los nicks llegan con el pedido E18 (hoy /matches busca en equipos, bandos y torneo).
          placeholder="Equipo, bando o torneo"
          aria-label="Buscar partidas"
          className="text-[13px]"
        />
      </InputGroup>
      {/* Sale del catálogo de mapas; si viene vacío, no hay select. */}
      {maps.length > 0 && (
        <Select
          value={search.map ?? ALL_MAPS}
          onValueChange={(v) =>
            onChange({ map: v === ALL_MAPS ? undefined : v, page: undefined })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label="Mapa"
            className="h-8 text-[13px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_MAPS}>Todos los mapas</SelectItem>
            {maps.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {/* Pedidos E15 (mine) y E14 (varios estados): hasta entonces, deshabilitados. */}
      <Soon label="Solo donde jugué · Próximamente">
        <Toggle disabled className={dashed}>
          <UserCheckIcon aria-hidden className="size-3.5" />
          Solo donde jugué
        </Toggle>
      </Soon>
      <Soon label="Ocultar canceladas · Próximamente">
        <Toggle disabled className={dashed}>
          Ocultar canceladas
        </Toggle>
      </Soon>
    </div>
  )
}

// ---------- En vivo ----------

/** Los mixes en juego: una fila completa por mix, con las columnas de la tabla. */
function LiveBlock() {
  const live = useQuery(liveMixesOptions).data
  const navigate = useNavigate()
  if (!live?.length) return null
  return (
    <section
      aria-label="En vivo"
      className="flex flex-col gap-2 border-b bg-destructive/[0.04] p-3"
    >
      <span className="flex items-center gap-2 text-xs font-semibold text-destructive">
        <span
          aria-hidden
          className="size-1.5 animate-live rounded-full bg-current"
        />
        En vivo · {live.length}
      </span>
      <div className="flex flex-col gap-1.5 overflow-x-auto">
        {live.map((x) => (
          <LiveRow
            key={x.live_uid ?? x.match_id}
            x={x}
            onOpen={() =>
              x.live_uid &&
              void navigate({
                to: "/mixes/live/$uid",
                params: { uid: x.live_uid },
              })
            }
          />
        ))}
      </div>
    </section>
  )
}

function LiveRow({ x, onOpen }: { x: MixItem; onOpen: () => void }) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") onOpen()
  }
  const round = x.current_round ?? x.rounds_played + 1
  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`En vivo: ${x.side1.name ?? "Bando 1"} contra ${x.side2.name ?? "Bando 2"}${x.map ? ` en ${x.map}` : ""}`}
      onClick={onOpen}
      onKeyDown={onKey}
      className={cn(
        "grid h-12 min-w-[860px] cursor-pointer grid-cols-[52px_130px_minmax(110px,1fr)_68px_minmax(110px,1fr)_minmax(180px,auto)_auto_16px] items-center gap-3 rounded-[10px] border bg-card px-3 text-[13px] whitespace-nowrap outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
        x.stale && "opacity-60"
      )}
    >
      <KindBadge kind="mix" />
      <span className="truncate font-mono font-medium">{x.map ?? "—"}</span>
      <span className="truncate text-right">{x.side1.name ?? "Bando 1"}</span>
      <span className="text-center font-mono text-[15px] font-semibold text-destructive tabular-nums">
        {x.side1.score ?? 0} : {x.side2.score ?? 0}
      </span>
      <span className="truncate">{x.side2.name ?? "Bando 2"}</span>
      <span className="truncate text-xs text-muted-foreground">
        Ronda {round}
        {x.max_rounds ? ` de ${x.max_rounds}` : ""} ·{" "}
        {x.server?.name ?? "Servidor"}
        {x.stale && " · Sin novedades del servidor"}
      </span>
      {x.tv ? (
        <WatchTvButton tv={x.tv} />
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
      <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground" />
    </div>
  )
}

// ---------- Tabla ----------

function KindBadge({ kind }: { kind: MatchKind }) {
  return (
    <span className="inline-flex h-5 w-fit items-center rounded-[4px] bg-secondary px-1.5 text-[11px] font-medium">
      {KIND_LABEL[kind]}
    </span>
  )
}

const sideName = (s: MatchSummary["side1"], n: 1 | 2) =>
  s.name ?? s.team?.name ?? `Bando ${n}`

function MatchesTable({
  search,
  onChange,
}: {
  search: MatchesSearch
  onChange: (patch: Patch) => void
}) {
  const list = useQuery(matchesListOptions(search))
  const navigate = useNavigate()
  const head = "h-auto py-2.5 text-xs font-medium text-muted-foreground"

  return (
    <>
      {/* Alto de 8 filas haya las que haya: la tarjeta no salta al filtrar. */}
      <div className="flex min-h-[420px] flex-col">
        {list.isPending ? (
          <TableShell head={head}>
            {Array.from({ length: 8 }, (_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell colSpan={9} className="px-4 py-2.5">
                  <Skeleton className="h-7 w-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableShell>
        ) : list.isError ? (
          <EmptyState
            icon={TriangleAlertIcon}
            title="No se pudieron cargar las partidas"
            action={
              isRetryable(list.error) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void list.refetch()}
                >
                  Reintentar
                </Button>
              )
            }
          >
            {errorMessage(list.error)}
          </EmptyState>
        ) : list.data.items.length === 0 ? (
          <NoMatches search={search} onChange={onChange} />
        ) : (
          <TableShell head={head}>
            {list.data.items.map((m) => (
              <MatchRow
                key={m.id}
                m={m}
                onOpen={() =>
                  void navigate({ to: "/match/$id", params: { id: m.id } })
                }
              />
            ))}
          </TableShell>
        )}
      </div>
      {!!list.data?.total && (
        <div className="border-t">
          <ListPagination
            total={list.data.total}
            page={search.page ?? 1}
            per={search.per ?? DEFAULT_PER}
            perOptions={PER_OPTIONS}
            perLabel="Partidas por página"
            onPage={(p) => onChange({ page: p === 1 ? undefined : p })}
            onPer={(n) =>
              onChange({
                per: n === DEFAULT_PER ? undefined : (n as 10 | 25),
                page: undefined,
              })
            }
          />
        </div>
      )}
    </>
  )
}

function TableShell({ head, children }: { head: string; children: ReactNode }) {
  return (
    <Table className="min-w-[900px] text-sm">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(head, "pl-4")}>Fecha</TableHead>
          <TableHead className={head}>Tipo</TableHead>
          <TableHead className={head}>Mapa</TableHead>
          <TableHead className={cn(head, "text-right")}>Bando 1</TableHead>
          <TableHead className={cn(head, "text-center")}>Resultado</TableHead>
          <TableHead className={head}>Bando 2</TableHead>
          <TableHead className={head}>Detalle</TableHead>
          <TableHead className={head}>Demo / TV</TableHead>
          <TableHead className={cn(head, "pr-4")}>
            <span className="sr-only">Abrir</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  )
}

/** Sin resultados: con búsqueda o mapa, "Quitar filtros"; si no, el vacío del tipo elegido. */
function NoMatches({
  search,
  onChange,
}: {
  search: MatchesSearch
  onChange: (patch: Patch) => void
}) {
  if (search.q || search.map)
    return (
      <EmptyState
        icon={FilterXIcon}
        title="Ninguna partida con esos filtros"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({ q: undefined, map: undefined, page: undefined })
            }
          >
            Quitar filtros
          </Button>
        }
      >
        Prueba con otra búsqueda u otro mapa.
      </EmptyState>
    )
  if (search.kind === "pcw")
    return (
      <EmptyState
        icon={SwordsIcon}
        title="Todavía no se jugó ningún PCW"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/pcw">Ir a PCW</Link>
          </Button>
        }
      >
        Los PCW aparecen acá cuando dos equipos juegan en el servidor.
      </EmptyState>
    )
  if (search.kind === "official")
    return (
      <EmptyState
        icon={SwordsIcon}
        title="Todavía no se jugó ningún partido de torneo"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/events">Ir a Torneos</Link>
          </Button>
        }
      >
        Los partidos aparecen acá cuando se juegan. Los programados se ven en
        cada torneo.
      </EmptyState>
    )
  return (
    <EmptyState
      icon={SwordsIcon}
      title={
        search.kind === "mix"
          ? "Todavía no se jugó ningún mix"
          : "Todavía no hay partidas jugadas"
      }
    >
      Aparecen acá cuando se juega un mix, un PCW o un partido de torneo en el
      servidor.
    </EmptyState>
  )
}

function MatchRow({ m, onOpen }: { m: MatchSummary; onOpen: () => void }) {
  const cancelled = m.status === "cancelled"
  const at = m.played_at ?? m.starts_at
  const won = (side: 1 | 2) =>
    !cancelled && m.winner_side === side
      ? "win"
      : !cancelled && m.winner_side !== null
        ? "loss"
        : null
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") onOpen()
  }
  const a = sideName(m.side1, 1)
  const b = sideName(m.side2, 2)
  // En una serie el mapa no es uno solo: se muestra el formato. "?" es un mapa sin definir.
  const map =
    m.best_of > 1
      ? `BO${m.best_of}`
      : m.map && m.map.replace(/[?,\s]/g, "")
        ? m.map
        : "—"
  const detail = cancelled
    ? cancelReasonLabel(m.cancel_reason)
    : m.kind === "official"
      ? [m.event?.name ?? "Torneo", m.label].filter(Boolean).join(" · ")
      : // El MVP del mix llega con el pedido E17.
        null

  return (
    <TableRow
      role="link"
      tabIndex={0}
      aria-label={`${a} contra ${b}${m.map && m.best_of === 1 ? ` en ${m.map}` : ""}`}
      onClick={onOpen}
      onKeyDown={onKey}
      className={cn(
        "h-12 cursor-pointer hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
        cancelled && "text-muted-foreground"
      )}
    >
      <TableCell className="py-2 pl-4">
        {at ? (
          <span className="flex flex-col leading-tight">
            <span>{fmtDay(at)}</span>
            <span className="text-xs text-muted-foreground">{fmtTime(at)}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <KindBadge kind={m.kind} />
      </TableCell>
      <TableCell className="font-mono text-[13px] font-medium">{map}</TableCell>
      <TableCell
        className={cn("text-right", won(1) === "win" && "font-semibold")}
      >
        {a}
      </TableCell>
      <TableCell className="text-center">
        {cancelled ? (
          <CancelChip reason={m.cancel_reason} />
        ) : (
          <span className="font-mono text-sm tabular-nums">
            <Score value={m.side1.score} result={won(1)} />
            <span className="text-muted-foreground"> : </span>
            <Score value={m.side2.score} result={won(2)} />
          </span>
        )}
      </TableCell>
      <TableCell className={cn(won(2) === "win" && "font-semibold")}>
        {b}
      </TableCell>
      <TableCell className="max-w-[240px] truncate text-[13px] text-muted-foreground">
        {detail ?? ""}
      </TableCell>
      <TableCell>
        <DemoStatus status={m.demo_status} />
      </TableCell>
      <TableCell className="pr-4 text-right text-muted-foreground">
        <ChevronRightIcon aria-hidden className="ml-auto size-4" />
      </TableCell>
    </TableRow>
  )
}

/** Rondas o mapas de un bando: el ganador en verde y negrita, el perdedor apagado. */
function Score({
  value,
  result,
}: {
  value: number | null
  result: "win" | "loss" | null
}) {
  return (
    <span
      className={cn(
        "font-semibold",
        result === "win" && "font-bold text-win",
        result === "loss" && "font-medium text-muted-foreground"
      )}
    >
      {value ?? 0}
    </span>
  )
}
