import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  UserCheckIcon,
} from "lucide-react"
import { useEffect, useState, type KeyboardEvent } from "react"

import { errorMessage, isRetryable } from "@/api/errors"
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
import { activeMapNames, mapsOptions } from "@/features/maps/queries"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { fmtDay, fmtTime, nickOf } from "./labels"
import {
  CancelChip,
  DemoStatus,
  LiveChip,
  MvpCell,
  WatchTvButton,
} from "./parts"
import { mixesListOptions, mixStatsOptions, type MixItem } from "./queries"
import { DEFAULT_PER, PER_OPTIONS, type MixesSearch } from "./search"

// Listado /mixes (handoff_mixes, secciones 1 a 3). Filtros, página y tamaño viven en la URL.

type Patch = Partial<MixesSearch>

export function MixesList({
  search,
  onChange,
}: {
  search: MixesSearch
  /** Cambia la URL; cualquier cambio de filtro vuelve a la página 1. */
  onChange: (patch: Patch) => void
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.4px]">Mixes</h1>
        <p className="max-w-[72ch] text-sm text-pretty text-muted-foreground">
          Partidas que reporta el servidor de forma automática. Cada mix
          actualiza el ELO de quienes jugaron; quien juega sin cuenta aparece
          como invitado con su nombre del juego.
        </p>
      </div>
      <MixKpis />
      <div className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]">
        <MixFilters search={search} onChange={onChange} />
        <MixesTable search={search} onChange={onChange} />
      </div>
    </section>
  )
}

function MixKpis() {
  const { data } = useQuery(mixStatsOptions)
  const tiles = [
    { label: "En vivo ahora", value: data?.live_now },
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

const ALL_MAPS = "__all"

function MixFilters({
  search,
  onChange,
}: {
  search: MixesSearch
  onChange: (patch: Patch) => void
}) {
  const [q, setQ] = useState(search.q ?? "")
  const debounced = useDebouncedValue(q, 300)
  const maps = activeMapNames(useQuery(mapsOptions).data)

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
      <InputGroup className="max-w-[320px] min-w-[200px] flex-1">
        <InputGroupAddon>
          <SearchIcon aria-hidden className="size-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Mapa, bando o nick de un jugador"
          aria-label="Buscar mixes"
          className="text-[13px]"
        />
      </InputGroup>
      {/* Sale de la maestra de mapas; mientras la API no la tenga, no hay select. */}
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
      <Toggle
        pressed={!!search.mine}
        onPressedChange={(on) =>
          onChange({ mine: on || undefined, page: undefined })
        }
        className={dashed}
      >
        <UserCheckIcon aria-hidden className="size-3.5" />
        Solo donde jugué
      </Toggle>
      <Toggle
        pressed={!!search.hideCancel}
        onPressedChange={(on) =>
          onChange({ hideCancel: on || undefined, page: undefined })
        }
        className={dashed}
      >
        Ocultar canceladas
      </Toggle>
    </div>
  )
}

function MixesTable({
  search,
  onChange,
}: {
  search: MixesSearch
  onChange: (patch: Patch) => void
}) {
  const list = useQuery(mixesListOptions(search))
  const navigate = useNavigate()

  const open = (x: MixItem) => {
    if (x.status === "live" && x.live_uid)
      void navigate({ to: "/mixes/live/$uid", params: { uid: x.live_uid } })
    else if (x.match_id)
      void navigate({ to: "/match/$id", params: { id: x.match_id } })
  }

  const head = "h-auto py-2.5 text-xs font-medium text-muted-foreground"

  return (
    <>
      <Table className="min-w-[820px] text-sm">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(head, "pl-4")}>Fecha</TableHead>
            <TableHead className={head}>Mapa</TableHead>
            <TableHead className={cn(head, "text-right")}>Bando 1</TableHead>
            <TableHead className={cn(head, "text-center")}>Rondas</TableHead>
            <TableHead className={head}>Bando 2</TableHead>
            <TableHead className={head}>MVP</TableHead>
            <TableHead className={head}>Demo / TV</TableHead>
            <TableHead className={cn(head, "pr-4")}>
              <span className="sr-only">Abrir</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.isPending ? (
            Array.from({ length: 6 }, (_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell colSpan={8} className="px-4 py-3">
                  <Skeleton className="h-7 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : list.isError ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={8} className="px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {errorMessage(list.error)}
                </p>
                {isRetryable(list.error) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => void list.refetch()}
                  >
                    Reintentar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ) : list.data.items.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={8}
                className="px-4 py-10 text-center text-[13px] text-muted-foreground"
              >
                No hay mixes con esos filtros.
              </TableCell>
            </TableRow>
          ) : (
            list.data.items.map((x) => (
              <MixRow
                key={x.match_id ?? x.live_uid}
                x={x}
                onOpen={() => open(x)}
              />
            ))
          )}
        </TableBody>
      </Table>
      <MixPagination
        total={list.data?.total ?? 0}
        page={search.page ?? 1}
        per={search.per ?? DEFAULT_PER}
        onChange={onChange}
      />
    </>
  )
}

function MixRow({ x, onOpen }: { x: MixItem; onOpen: () => void }) {
  const live = x.status === "live"
  const cancelled = x.status === "cancelled"
  const server = x.server?.name ?? "Servidor"
  const at = x.started_at ?? x.ended_at
  const weight = (side: 1 | 2) =>
    !live && !cancelled && x.winner_side === side ? "font-semibold" : ""
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") onOpen()
  }

  return (
    <TableRow
      role="link"
      tabIndex={0}
      aria-label={`${x.side1.name ?? "Bando 1"} contra ${x.side2.name ?? "Bando 2"}${x.map ? ` en ${x.map}` : ""}`}
      onClick={onOpen}
      onKeyDown={onKey}
      className={cn(
        "cursor-pointer hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
        live && "bg-destructive/5 hover:bg-destructive/9",
        live && x.stale && "opacity-60"
      )}
    >
      <TableCell className="py-2.5 pl-4">
        {live ? (
          <span className="flex flex-col gap-[3px] leading-tight">
            <LiveChip />
            <span className="text-xs text-muted-foreground">
              Ronda {x.current_round ?? x.rounds_played + 1} · {server}
              {x.stale && " · Sin novedades del servidor"}
            </span>
          </span>
        ) : (
          <span className="flex flex-col leading-tight">
            <span>{at ? fmtDay(at) : "—"}</span>
            <span className="text-xs text-muted-foreground">
              {at ? `${fmtTime(at)} · ` : ""}
              {server}
            </span>
          </span>
        )}
      </TableCell>
      <TableCell className="font-mono text-[13px] font-medium">
        {x.map ?? "—"}
      </TableCell>
      <TableCell className={cn("text-right", weight(1))}>
        {x.side1.name ?? "Bando 1"}
      </TableCell>
      <TableCell className="text-center">
        {cancelled ? (
          <CancelChip reason={x.cancel_reason} />
        ) : (
          <span className="font-mono text-sm font-semibold tabular-nums">
            {x.side1.score ?? 0} : {x.side2.score ?? 0}
          </span>
        )}
      </TableCell>
      <TableCell className={weight(2)}>{x.side2.name ?? "Bando 2"}</TableCell>
      <TableCell>
        {!cancelled && x.mvp && (
          <MvpCell
            nick={nickOf(x.mvp)}
            level={x.mvp.level}
            rating={x.mvp.rating}
          />
        )}
      </TableCell>
      <TableCell>
        {live ? (
          x.tv ? (
            <WatchTvButton tv={x.tv} />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )
        ) : (
          <DemoStatus status={x.demo_status} />
        )}
      </TableCell>
      <TableCell className="pr-4 text-right text-muted-foreground">
        <ChevronRightIcon aria-hidden className="ml-auto size-4" />
      </TableCell>
    </TableRow>
  )
}

/** Números de página a mostrar: todas si son pocas; si no, la primera, la última y las vecinas. */
export function pageList(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: (number | "…")[] = [1]
  const from = Math.max(2, page - 1)
  const to = Math.min(pages - 1, page + 1)
  if (from > 2) out.push("…")
  for (let p = from; p <= to; p++) out.push(p)
  if (to < pages - 1) out.push("…")
  out.push(pages)
  return out
}

function MixPagination({
  total,
  page,
  per,
  onChange,
}: {
  total: number
  page: number
  per: number
  onChange: (patch: Patch) => void
}) {
  const pages = Math.max(1, Math.ceil(total / per))
  const current = Math.min(page, pages)
  const from = total ? (current - 1) * per + 1 : 0
  const to = Math.min(total, current * per)
  const go = (p: number) => onChange({ page: p === 1 ? undefined : p })
  const box = "size-7 min-w-7 px-0 text-xs"

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px] text-muted-foreground">
      <span>
        Mostrando {from}–{to} de {total}
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        Por página
        <Select
          value={String(per)}
          onValueChange={(v) =>
            onChange({
              per:
                Number(v) === DEFAULT_PER ? undefined : (Number(v) as 10 | 25),
              page: undefined,
            })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label="Mixes por página"
            className="h-7 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PER_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>
      <nav aria-label="Páginas" className="flex gap-1">
        <Button
          variant="outline"
          className={box}
          aria-label="Página anterior"
          disabled={current <= 1}
          onClick={() => go(current - 1)}
        >
          <ChevronLeftIcon aria-hidden className="size-3.5" />
        </Button>
        {pageList(current, pages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="grid w-5 place-items-center">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant="outline"
              aria-current={p === current ? "page" : undefined}
              className={cn(
                box,
                "text-foreground",
                p === current && "border-foreground bg-accent"
              )}
              onClick={() => go(p)}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="outline"
          className={box}
          aria-label="Página siguiente"
          disabled={current >= pages}
          onClick={() => go(current + 1)}
        >
          <ChevronRightIcon aria-hidden className="size-3.5" />
        </Button>
      </nav>
    </div>
  )
}
