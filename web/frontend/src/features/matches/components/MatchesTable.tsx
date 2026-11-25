import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import {
  ChevronRightIcon,
  FilterXIcon,
  StarIcon,
  SwordsIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { errorMessage } from "@/api/errors"
import { EmptyState } from "@/components/brand/EmptyState"
import { KindBadge } from "@/components/brand/KindBadge"
import { RetryButton } from "@/components/brand/QueryState"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table/DataTable"
import { DataTablePagination } from "@/components/data-table/DataTablePagination"
import { urlPaging } from "@/components/data-table/url"
import {
  useServerTable,
  type DataColumn,
} from "@/components/data-table/useServerTable"
import { cancelReasonLabel, fmtDay, fmtTime } from "@/features/mixes/lib/labels"
import { CancelChip, DemoStatus } from "@/features/mixes/components/parts"
import { matchesListOptions } from "../api/queries"
import type { MatchItem, MatchSummary } from "../types"
import {
  DEFAULT_PER,
  matchChips,
  PER_OPTIONS,
  type MatchesSearch,
} from "../lib/search"
import { useVip } from "@/features/vip/useVip"
import { FavoriteStar } from "./FavoriteStar"
import type { Patch } from "./MatchFilters"

const sideName = (s: MatchSummary["side1"], n: 1 | 2) =>
  s.name ?? s.team?.name ?? `Bando ${n}`

const cancelledOf = (m: MatchSummary) => m.status === "cancelled"

/** "win" o "loss" del bando; null si la partida no tiene ganador (o se canceló). */
const resultOf = (m: MatchSummary, side: 1 | 2) =>
  cancelledOf(m) || m.winner_side === null
    ? null
    : m.winner_side === side
      ? "win"
      : "loss"

const COLUMNS: DataColumn<MatchItem>[] = [
  {
    id: "favorite",
    header: () => <span className="sr-only">Favorita</span>,
    headClassName: "w-10 pl-3",
    cellClassName: "py-1 pl-3",
    cell: ({ row }) => (
      <FavoriteStar id={row.original.id} on={row.original.favorite} />
    ),
  },
  {
    id: "date",
    header: "Fecha",
    cellClassName: "py-2",
    cell: ({ row }) => {
      const at = row.original.played_at ?? row.original.starts_at
      return at ? (
        <span className="flex flex-col leading-tight">
          <span>{fmtDay(at)}</span>
          <span className="text-xs text-muted-foreground">{fmtTime(at)}</span>
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    },
  },
  {
    id: "kind",
    header: "Tipo",
    cell: ({ row }) => <KindBadge kind={row.original.kind} />,
  },
  {
    id: "map",
    header: "Mapa",
    cellClassName: "font-mono text-[13px] font-medium",
    cell: ({ row }) => {
      const m = row.original
      // En una serie el mapa no es uno solo: se muestra el formato. "?" es un mapa sin definir.
      return m.best_of > 1
        ? `BO${m.best_of}`
        : m.map && m.map.replace(/[?,\s]/g, "")
          ? m.map
          : "—"
    },
  },
  {
    id: "side1",
    header: "Bando 1",
    headClassName: "text-right",
    cellClassName: (m) =>
      cn("text-right", resultOf(m, 1) === "win" && "font-semibold"),
    cell: ({ row }) => sideName(row.original.side1, 1),
  },
  {
    id: "result",
    header: "Resultado",
    headClassName: "text-center",
    cellClassName: "text-center",
    cell: ({ row }) => {
      const m = row.original
      return cancelledOf(m) ? (
        <CancelChip reason={m.cancel_reason} />
      ) : (
        <span className="font-mono text-sm tabular-nums">
          <Score value={m.side1.score} result={resultOf(m, 1)} />
          <span className="text-muted-foreground"> : </span>
          <Score value={m.side2.score} result={resultOf(m, 2)} />
        </span>
      )
    },
  },
  {
    id: "side2",
    header: "Bando 2",
    cellClassName: (m) => cn(resultOf(m, 2) === "win" && "font-semibold"),
    cell: ({ row }) => sideName(row.original.side2, 2),
  },
  {
    id: "detail",
    header: "Detalle",
    cellClassName: "max-w-[240px] truncate text-[13px] text-muted-foreground",
    cell: ({ row }) => {
      const m = row.original
      return cancelledOf(m)
        ? cancelReasonLabel(m.cancel_reason)
        : m.kind === "official"
          ? [m.event?.name ?? "Torneo", m.label].filter(Boolean).join(" · ")
          : // El MVP del mix llega con el pedido E17.
            ""
    },
  },
  {
    id: "demo",
    header: "Demo / TV",
    cell: ({ row }) => <DemoStatus status={row.original.demo_status} />,
  },
  {
    id: "open",
    header: () => <span className="sr-only">Abrir</span>,
    headClassName: "pr-4",
    cellClassName: "pr-4 text-right text-muted-foreground",
    cell: () => <ChevronRightIcon aria-hidden className="ml-auto size-4" />,
  },
]

export function MatchesTable({
  search,
  onChange,
}: {
  search: MatchesSearch
  onChange: (patch: Patch) => void
}) {
  const { vip, ready } = useVip()
  const list = useQuery({
    ...matchesListOptions(search, vip),
    // Con filtros avanzados en la URL se espera a saber si es VIP, para no buscar dos veces.
    enabled: ready || matchChips(search).length === 0,
  })
  const navigate = useNavigate()
  const table = useServerTable({
    columns: COLUMNS,
    data: list.data?.items,
    total: list.data?.total,
    getRowId: (m) => m.id,
    ...urlPaging(search, onChange, DEFAULT_PER),
  })

  return (
    <>
      {/* Alto de 8 filas haya las que haya: la tarjeta no salta al filtrar. */}
      <div className="flex min-h-[420px] flex-col">
        <DataTable
          table={table}
          query={list}
          className="min-w-[940px] text-sm"
          stateAs="block"
          skeletonCellClassName="px-4 py-2.5"
          error={
            <EmptyState
              icon={TriangleAlertIcon}
              title="No se pudieron cargar las partidas"
              action={<RetryButton error={list.error} onRetry={list.refetch} />}
            >
              {errorMessage(list.error)}
            </EmptyState>
          }
          empty={<NoMatches search={search} vip={vip} onChange={onChange} />}
          rowClassName={(m) =>
            cn("h-12", cancelledOf(m) && "text-muted-foreground")
          }
          rowLink={(m) => {
            const a = sideName(m.side1, 1)
            const b = sideName(m.side2, 2)
            return {
              label: `${a} contra ${b}${m.map && m.best_of === 1 ? ` en ${m.map}` : ""}`,
              onOpen: () =>
                void navigate({ to: "/match/$id", params: { id: m.id } }),
            }
          }}
        />
      </div>
      {!!list.data?.total && (
        <div className="border-t">
          <DataTablePagination
            table={table}
            perOptions={PER_OPTIONS}
            perLabel="Partidas por página"
          />
        </div>
      )}
    </>
  )
}

/** Sin resultados: con búsqueda o mapa, "Quitar filtros"; si no, el vacío del tipo elegido. */
function NoMatches({
  search,
  vip,
  onChange,
}: {
  search: MatchesSearch
  vip: boolean
  onChange: (patch: Patch) => void
}) {
  const chips = vip ? matchChips(search) : []
  if (search.fav && !search.q && !search.map && !chips.length)
    return (
      <EmptyState icon={StarIcon} title="Todavía no tienes favoritas">
        {vip
          ? "Toca la estrella de una partida para guardarla acá."
          : "Con VIP puedes guardar las partidas que quieras con la estrella."}
      </EmptyState>
    )
  if (search.q || search.map || chips.length)
    return (
      <EmptyState
        icon={FilterXIcon}
        title="Ninguna partida con esos filtros"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                q: undefined,
                map: undefined,
                page: undefined,
                ...Object.fromEntries(
                  chips.flatMap((c) => c.clear).map((k) => [k, undefined])
                ),
              })
            }
          >
            Quitar filtros
          </Button>
        }
      >
        Prueba con otra búsqueda o quita algún filtro.
      </EmptyState>
    )
  if (search.kind === "pcw")
    return (
      <EmptyState icon={SwordsIcon} title="Todavía no se jugó ningún PCW">
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
