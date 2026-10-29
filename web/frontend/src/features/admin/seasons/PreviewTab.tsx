import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SearchBox } from "@/features/ranking/SearchBox"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import {
  EmptyState,
  FilterChips,
  Pager,
  QueryError,
  TableBox,
  headCell,
} from "../ui"
import { seasonPreviewOptions, type PreviewFilter } from "./queries"
import { LIMITS, type SeasonForm } from "./seasons"

const ok = (v: number, [min, max]: readonly [number, number]) =>
  Number.isInteger(v) && v >= min && v <= max

/** "Vista previa del cierre": con las reglas del formulario de la activa (guardadas o no). */
export function PreviewTab({ form }: { form: SeasonForm }) {
  const [filter, setFilter] = useState<PreviewFilter>(undefined)
  const [q, setQ] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  // Se compara como texto: un objeto nuevo en cada render reiniciaría el retardo.
  const key = useDebouncedValue(
    [form.top_n, form.min_matches, form.reset_pct, form.reset_floor].join(","),
    400
  )
  const [top_n, min_matches, reset_pct, reset_floor] = key
    .split(",")
    .map(Number)
  const params = { top_n, min_matches, reset_pct, reset_floor }
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
              <div
                key={label}
                className="flex flex-col gap-1 rounded-xl border bg-card px-3.5 py-3"
              >
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="font-mono text-[22px] font-semibold">
                  {value ?? "—"}
                </span>
              </div>
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
          {preview.isPending ? (
            <Skeleton className="h-80 rounded-xl" />
          ) : preview.data.items.length === 0 ? (
            <EmptyState>Nadie con ese filtro.</EmptyState>
          ) : (
            <TableBox>
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={cn(headCell, "w-20 pl-4")}>
                      Puesto
                    </TableHead>
                    <TableHead className={headCell}>Jugador</TableHead>
                    <TableHead className={headCell}>Mixes</TableHead>
                    <TableHead className={headCell}>Medalla</TableHead>
                    <TableHead className={headCell}>ELO al cerrar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.data.items.map((r) => (
                    <TableRow key={r.player.id}>
                      <TableCell className="pl-4 font-mono font-semibold">
                        {r.rank ? `#${r.rank}` : "—"}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {r.player.alias}
                      </TableCell>
                      <TableCell
                        className={cn(
                          !r.eligible && "text-amber-700 dark:text-amber-400"
                        )}
                      >
                        {r.eligible
                          ? r.matches
                          : `${r.matches}/${params.min_matches}`}
                      </TableCell>
                      <TableCell>
                        {r.medal ? `${r.medal.icon} ${r.medal.name}` : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-mono",
                          r.reset && "text-destructive"
                        )}
                      >
                        {r.reset ? `${r.elo} → ${r.elo_after}` : r.elo}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pager
                page={page}
                total={preview.data.total}
                per={25}
                onPage={setPage}
              />
            </TableBox>
          )}
        </>
      )}
    </section>
  )
}
