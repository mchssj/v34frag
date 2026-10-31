import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { FilterXIcon, SwordsIcon, TriangleAlertIcon } from "lucide-react"
import { errorMessage } from "@/api/errors"
import { EmptyState } from "@/components/brand/EmptyState"
import { FilterChips } from "@/components/brand/FilterChips"
import { KindBadge } from "@/components/brand/KindBadge"
import { RetryButton } from "@/components/brand/QueryState"
import { DataTable } from "@/components/data-table/DataTable"
import { DataTablePagination } from "@/components/data-table/DataTablePagination"
import { urlPaging } from "@/components/data-table/url"
import {
  useServerTable,
  type DataColumn,
} from "@/components/data-table/useServerTable"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { fmtDay, matchTitle, resultOf, scoreOf } from "../../lib/labels"
import { playerMatchesOptions } from "../../api/queries"
import type { PlayerMatch } from "../../types"
import { DEFAULT_PER, PER_OPTIONS, type PlayerSearch } from "../../lib/search"
import { Delta, useOpenMatch } from "./shared"

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

const COLUMNS: DataColumn<PlayerMatch>[] = [
  {
    id: "date",
    header: "Fecha",
    headClassName: "pl-4",
    cellClassName: "pl-4",
    cell: ({ row }) =>
      row.original.played_at ? fmtDay(row.original.played_at) : "—",
  },
  {
    id: "kind",
    header: "Tipo",
    cell: ({ row }) => <KindBadge kind={row.original.kind} />,
  },
  {
    id: "map",
    header: "Mapa",
    cellClassName: "font-mono",
    cell: ({ row }) => row.original.map ?? "—",
  },
  {
    id: "game_nick",
    header: "Nombre en el juego",
    cellClassName: "text-muted-foreground",
    cell: ({ row }) => row.original.game_nick ?? "—",
  },
  {
    id: "result",
    header: "Resultado",
    cell: ({ row }) => {
      const r = resultOf(row.original.won)
      return (
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
          {r} {scoreOf(row.original) ?? ""}
        </span>
      )
    },
  },
  {
    id: "kd",
    header: "K-D",
    cellClassName: "font-mono tabular-nums",
    cell: ({ row }) => `${row.original.kills ?? 0}-${row.original.deaths ?? 0}`,
  },
  {
    id: "rating",
    header: "Rating",
    cellClassName: "font-mono font-semibold tabular-nums",
    cell: ({ row }) => row.original.rating?.toFixed(2) ?? "—",
  },
  {
    id: "elo",
    header: "ELO",
    headClassName: "pr-4 text-right",
    cellClassName:
      "pr-4 text-right font-mono text-xs font-semibold tabular-nums",
    cell: ({ row }) => <Delta v={row.original.elo_delta} />,
  },
]

export function Matches({
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
  const table = useServerTable({
    columns: COLUMNS,
    data: q.data?.items,
    total: q.data?.total,
    getRowId: (m) => m.match_id,
    ...urlPaging(search, onChange, DEFAULT_PER),
  })

  return (
    <Card variant="outline" className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <FilterChips
          size="sm"
          label="Tipo"
          options={KINDS}
          value={search.kind}
          onChange={(kind) => onChange({ kind, page: undefined })}
        />
        <Separator
          orientation="vertical"
          className="h-5 data-vertical:self-center"
        />
        <FilterChips
          size="sm"
          label="Resultado"
          options={RESULTS}
          value={search.result}
          onChange={(result) => onChange({ result, page: undefined })}
        />
      </div>
      {/* Alto de 8 filas haya las que haya: la tarjeta no salta al filtrar. */}
      <div className="flex min-h-[396px] flex-col">
        <DataTable
          table={table}
          query={q}
          className="min-w-[700px] text-[13px]"
          stateAs="block"
          skeletonCellClassName="px-4 py-2.5"
          skeletonClassName="h-6 w-full"
          error={
            <EmptyState
              icon={TriangleAlertIcon}
              title="No se pudieron cargar las partidas"
              action={<RetryButton error={q.error} onRetry={q.refetch} />}
            >
              {errorMessage(q.error)}
            </EmptyState>
          }
          empty={
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
                Aparecen acá al jugar un mix, un PCW o un partido de torneo en
                el servidor.
              </EmptyState>
            )
          }
          rowClassName={() => "h-11"}
          rowLink={(m) => ({
            label: matchTitle(m).title,
            onOpen: () => open(m),
          })}
        />
      </div>
      {!!q.data?.total && (
        <div className="border-t">
          <DataTablePagination
            table={table}
            perOptions={PER_OPTIONS}
            perLabel="Partidas por página"
          />
        </div>
      )}
    </Card>
  )
}
