import { cn } from "cn"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Pie de los listados paginados (Mixes, Ranking): "Mostrando a–b de n", tamaño de página y páginas.

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

export function ListPagination({
  total,
  page,
  per,
  perOptions,
  perLabel,
  onPage,
  onPer,
}: {
  total: number
  page: number
  per: number
  perOptions: readonly number[]
  /** aria-label del select de tamaño ("Mixes por página"). */
  perLabel: string
  onPage: (page: number) => void
  onPer: (per: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / per))
  const current = Math.min(page, pages)
  const from = total ? (current - 1) * per + 1 : 0
  const to = Math.min(total, current * per)
  const box = "size-7 min-w-7 px-0 text-xs"

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px] text-muted-foreground">
      <span>
        Mostrando {from}–{to} de {total}
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        Por página
        <Select value={String(per)} onValueChange={(v) => onPer(Number(v))}>
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
      <nav aria-label="Páginas" className="flex gap-1">
        <Button
          variant="outline"
          className={box}
          aria-label="Página anterior"
          disabled={current <= 1}
          onClick={() => onPage(current - 1)}
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
              onClick={() => onPage(p)}
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
          onClick={() => onPage(current + 1)}
        >
          <ChevronRightIcon aria-hidden className="size-3.5" />
        </Button>
      </nav>
    </div>
  )
}
