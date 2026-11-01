import type { Column, RowData } from "@tanstack/react-table"
import { cn } from "cn"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

import type { TableFeats } from "./useServerTable"

/** Cabecera de una columna que ordena: clic alterna desc → asc → orden por defecto. */
export function SortHeader<T extends RowData>({
  column,
  label,
}: {
  column: Column<TableFeats, T, unknown>
  label: string
}) {
  const sorted = column.getIsSorted()
  const Icon = sorted === "asc" ? ArrowUpIcon : ArrowDownIcon
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      aria-label={`Ordenar por ${label}`}
      className={cn(
        "inline-flex items-center gap-[3px] rounded-sm hover:text-foreground",
        sorted && "text-foreground"
      )}
    >
      {label}
      {sorted && <Icon aria-hidden className="size-3" />}
    </button>
  )
}
