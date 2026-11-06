import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useMemo, useState } from "react"

import { SearchBox } from "@/components/brand/SearchBox"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { AdminTable, EmptyState, QueryError } from "../../components/ui"
import { FilterChips } from "@/components/brand/FilterChips"
import { StatTile } from "@/components/brand/StatTile"
import {
  useServerTable,
  type DataColumn,
} from "@/components/data-table/useServerTable"
import { seasonPreviewOptions } from "../api/queries"
import type { PreviewFilter, SeasonPreviewRow } from "../types"
import { LIMITS, type SeasonForm } from "../lib/seasons"
import { SeasonMedal } from "@/features/medals/Medal"

const ok = (v: number, [min, max]: readonly [number, number]) =>
  Number.isInteger(v) && v >= min && v <= max

function previewColumns(minMatches: number): DataColumn<SeasonPreviewRow>[] {
  return [
    {
      id: "rank",
      header: "Puesto",
      headClassName: "w-20 pl-4",
      cellClassName: "pl-4 font-mono font-semibold",
      cell: ({ row }) => (row.original.rank ? `#${row.original.rank}` : "—"),
    },
    {
      id: "player",
      header: "Jugador",
      cellClassName: "font-semibold",
      cell: ({ row }) => row.original.player.alias,
    },
    {
      id: "matches",
      header: "Mixes",
      cellClassName: (r) =>
        cn(!r.eligible && "text-amber-700 dark:text-amber-400"),
      cell: ({ row: { original: r } }) =>
        r.eligible ? r.matches : `${r.matches}/${minMatches}`,
    },
    {
      id: "medal",
      header: "Medalla",
      cell: ({ row: { original: r } }) =>
        r.medal ? (
          <span className="inline-flex items-center gap-1.5">
            <SeasonMedal medal={r.medal} size={24} />
            {r.medal.name}
          </span>
        ) : (
          "—"
        ),
    },
    {
      id: "elo",
      header: "ELO al cerrar",
      cellClassName: (r) =>
        cn(
          "font-mono",
          r.elo_after < r.elo && "text-destructive",
          r.elo_after > r.elo && "text-win"
        ),
      cell: ({ row: { original: r } }) =>
        r.reset ? `${r.elo} → ${r.elo_after}` : r.elo,
    },
  ]
}

/** "Vista previa del cierre": con las reglas del formulario de la activa (guardadas o no). */
export function PreviewTab({ form }: { form: SeasonForm }) {
  const [filter, setFilter] = useState<PreviewFilter>(undefined)
  const [q, setQ] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  // Se compara como texto: un objeto nuevo en cada render reiniciaría el retardo.
  const key = useDebouncedValue(
    [
      form.top_n,
      form.min_matches,
      form.reset_pct,
      form.reset_floor,
      form.reset_all ? 1 : 0,
    ].join(","),
    400
  )
  const [top_n, min_matches, reset_pct, reset_floor, all] = key
    .split(",")
    .map(Number)
  const params = {
    top_n,
    min_matches,
    reset_pct,
    reset_floor,
    reset_all: all === 1,
  }
  const valid =
    ok(params.top_n, LIMITS.top_n) &&
    ok(params.min_matches, LIMITS.min_matches) &&
    ok(params.reset_pct, LIMITS.reset_pct) &&
    ok(params.reset_floor, LIMITS.reset_floor)
  const preview = useQuery({
    ...seasonPreviewOptions(params, filter, q ?? "", page),
    enabled: valid,
  })
  const s = preview.data?.summary
  const columns = useMemo(() => previewColumns(min_matches), [min_matches])
  const table = useServerTable({
    columns,
    data: preview.data?.items,
    total: preview.data?.total,
    page,
    per: 25,
    onPage: setPage,
    getRowId: (r) => r.player.id,
  })

  return (
    <section
      aria-label="Vista previa del cierre"
      className="flex flex-col gap-4"
    >
      <p className="max-w-[820px] text-[13px] leading-relaxed text-muted-foreground">
        Cómo quedaría si la temporada terminara ahora, con las reglas de
        "Temporada activa" (también las que todavía no guardaste). No guarda
        nada.
      </p>
      {!valid ? (
        <EmptyState>
          Corrige las reglas de "Temporada activa" para ver la vista previa.
        </EmptyState>
      ) : preview.isError ? (
        <QueryError
          error={preview.error}
          onRetry={() => void preview.refetch()}
        />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            {(
              [
                ["Jugadores", s?.players],
                ["En el ranking", s?.eligible],
                ["Medallas", s?.medals],
                ["Se reinician", s?.reset],
                ["Bajan en promedio", s?.avg_drop],
                ["Bajan como máximo", s?.max_drop],
              ] as const
            ).map(([label, value]) => (
              <StatTile
                key={label}
                label={label}
                value={value ?? "—"}
                className="px-3.5 py-3"
                valueClassName="tracking-normal"
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox
              value={q}
              label="Buscar jugadores"
              placeholder="Alias"
              onChange={(v) => {
                setQ(v)
                setPage(1)
              }}
            />
            <FilterChips
              label="Filtro"
              value={filter}
              onChange={(v) => {
                setFilter(v)
                setPage(1)
              }}
              options={[
                { value: undefined, label: "Todos" },
                { value: "medal", label: "Reciben medalla" },
                { value: "reset", label: "Se reinician" },
              ]}
            />
          </div>
          <AdminTable
            table={table}
            query={preview}
            className="min-w-[640px]"
            empty="Nadie con ese filtro."
          />
        </>
      )}
    </section>
  )
}
