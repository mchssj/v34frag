import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import {
  ChevronRightIcon,
  FilterXIcon,
  SwordsIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { type KeyboardEvent, type ReactNode } from "react"
import { errorMessage } from "@/api/errors"
import { EmptyState } from "@/components/brand/EmptyState"
import { KindBadge } from "@/components/brand/KindBadge"
import { ListPagination } from "@/components/brand/ListPagination"
import { RetryButton } from "@/components/brand/QueryState"
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
import { cancelReasonLabel, fmtDay, fmtTime } from "@/features/mixes/lib/labels"
import { CancelChip, DemoStatus } from "@/features/mixes/components/parts"
import { matchesListOptions } from "../api/queries"
import type { MatchSummary } from "../types"
import { DEFAULT_PER, PER_OPTIONS, type MatchesSearch } from "../lib/search"
import type { Patch } from "./MatchFilters"

const sideName = (s: MatchSummary["side1"], n: 1 | 2) =>
  s.name ?? s.team?.name ?? `Bando ${n}`

export function MatchesTable({
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
            action={<RetryButton error={list.error} onRetry={list.refetch} />}
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
