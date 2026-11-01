import { cn } from "cn"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useRef } from "react"
import type { RowData } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DataTableInstance } from "./useServerTable"

// Pie de las tablas paginadas, sobre la Pagination de shadcn. `full` (Partidas, Ranking):
// "Mostrando a–b de n", tamaño de página y números. `compact` (Administración): "Página n de m"
// con Anterior y Siguiente, solo si hay más de una.
// Va al pie de la tarjeta de la lista: al cambiar de página, si el inicio de la tarjeta quedó arriba
// de la pantalla, vuelve a él (las rutas no suben el scroll al cambiar la búsqueda).

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

export function DataTablePagination<T extends RowData>({
  table,
  mode = "full",
  perOptions = [],
  perLabel,
}: {
  table: DataTableInstance<T>
  mode?: "full" | "compact"
  perOptions?: readonly number[]
  /** aria-label del select de tamaño ("Filas por página"). */
  perLabel?: string
}) {
  const { pageIndex, pageSize: per } = table.state.pagination
  const total = table.getRowCount()
  const pages = Math.max(1, Math.ceil(total / per))
  const current = Math.min(pageIndex + 1, pages)
  const root = useRef<HTMLDivElement>(null)
  const go = (p: number) => {
    table.setPageIndex(p - 1)
    const list = root.current?.parentElement
    if (list && list.getBoundingClientRect().top < 0)
      list.scrollIntoView({ block: "start" })
  }

  if (mode === "compact") {
    if (pages <= 1) return null
    return (
      <div
        ref={root}
        className="flex items-center justify-end gap-2 border-t px-4 py-2.5 text-[13px] text-muted-foreground"
      >
        Página {current} de {pages}
        <Button
          variant="outline"
          size="sm"
          disabled={current <= 1}
          onClick={() => go(current - 1)}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={current >= pages}
          onClick={() => go(current + 1)}
        >
          Siguiente
        </Button>
      </div>
    )
  }

  const from = total ? (current - 1) * per + 1 : 0
  const to = Math.min(total, current * per)
  const box = "size-7 min-w-7 px-0 text-xs"
  return (
    <div
      ref={root}
      className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px] text-muted-foreground"
    >
      <span>
        Mostrando {from}–{to} de {total}
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        Por página
        <Select
          value={String(per)}
          onValueChange={(v) => table.setPageSize(Number(v))}
        >
          <SelectTrigger
            size="sm"
            aria-label={perLabel}
            className="h-7 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {perOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>
      <Pagination aria-label="Páginas" className="mx-0 w-auto">
        <PaginationContent className="gap-1">
          <PaginationItem>
            <Button
              variant="outline"
              className={box}
              aria-label="Página anterior"
              disabled={current <= 1}
              onClick={() => go(current - 1)}
            >
              <ChevronLeftIcon aria-hidden className="size-3.5" />
            </Button>
          </PaginationItem>
          {pageList(current, pages).map((p, i) =>
            p === "…" ? (
              <PaginationItem
                key={`gap-${i}`}
                className="grid w-5 place-items-center"
              >
                …
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <Button
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
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <Button
              variant="outline"
              className={box}
              aria-label="Página siguiente"
              disabled={current >= pages}
              onClick={() => go(current + 1)}
            >
              <ChevronRightIcon aria-hidden className="size-3.5" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
