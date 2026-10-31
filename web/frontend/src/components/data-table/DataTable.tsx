import type { Header, Row, RowData } from "@tanstack/react-table"
import { cn } from "cn"
import type { KeyboardEvent, ReactNode } from "react"

import {
  QueryErrorMessage,
  type QueryLike,
} from "@/components/brand/QueryState"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  DataColumn,
  DataTableInstance,
  TableFeats,
} from "./useServerTable"

/** Clases de la cabecera de todas las tablas. */
export const HEAD_CELL =
  "h-auto py-2.5 text-xs font-medium text-muted-foreground"

/** Fila que abre algo (el perfil, la partida): clic o Enter. */
export type RowLink = {
  label: string
  onOpen: () => void
  /** Fila propia del usuario: resaltada y con `aria-current`. */
  me?: boolean
}

const colOf = <T extends RowData>(h: { column: { columnDef: unknown } }) =>
  h.column.columnDef as DataColumn<T>

const cellClass = <T extends RowData>(col: DataColumn<T>, row: T) =>
  typeof col.cellClassName === "function"
    ? col.cellClassName(row)
    : col.cellClassName

/**
 * Tabla de una lista paginada por la API, sobre la Table de shadcn. Dibuja la cabecera, las filas
 * de carga, el error con "Reintentar", el vacío y las filas (clicables con `rowLink`).
 * `stateAs="block"`: el error y el vacío reemplazan la tabla en lugar de ir en una fila.
 */
export function DataTable<T extends RowData>({
  table,
  query,
  empty,
  error,
  stateAs = "row",
  className,
  rowLink,
  rowClassName,
  skeletonRows = 8,
  skeletonCellClassName = "px-4 py-3",
  skeletonClassName = "h-7 w-full",
}: {
  table: DataTableInstance<T>
  query: Pick<QueryLike<unknown>, "isPending" | "isError" | "error" | "refetch">
  empty: ReactNode
  /** Error propio; si no, el mensaje con "Reintentar". */
  error?: ReactNode
  stateAs?: "row" | "block"
  className?: string
  rowLink?: (row: T) => RowLink
  rowClassName?: (row: T) => string | undefined
  skeletonRows?: number
  skeletonCellClassName?: string
  skeletonClassName?: string
}) {
  const cols = table.getAllLeafColumns().length
  const rows = table.getRowModel().rows
  const errorNode = error ?? (
    <QueryErrorMessage error={query.error} onRetry={query.refetch} />
  )

  if (stateAs === "block" && !query.isPending) {
    if (query.isError) return errorNode
    if (!rows.length) return empty
  }

  const stateRow = (children: ReactNode, className?: string) => (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={cols}
        className={cn("px-4 py-10 text-center", className)}
      >
        {children}
      </TableCell>
    </TableRow>
  )

  return (
    <Table className={className}>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id} className="hover:bg-transparent">
            {group.headers.map((h) => (
              <TableHead
                key={h.id}
                colSpan={h.colSpan}
                className={cn(HEAD_CELL, colOf<T>(h).headClassName)}
              >
                <HeaderContent table={table} header={h} />
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {query.isPending
          ? Array.from({ length: skeletonRows }, (_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell colSpan={cols} className={skeletonCellClassName}>
                  <Skeleton className={skeletonClassName} />
                </TableCell>
              </TableRow>
            ))
          : query.isError
            ? stateRow(errorNode)
            : !rows.length
              ? stateRow(empty, "text-[13px] text-muted-foreground")
              : rows.map((row) => (
                  <DataRow
                    key={row.id}
                    table={table}
                    row={row}
                    link={rowLink?.(row.original)}
                    className={rowClassName?.(row.original)}
                  />
                ))}
      </TableBody>
    </Table>
  )
}

function HeaderContent<T extends RowData>({
  table,
  header,
}: {
  table: DataTableInstance<T>
  header: Header<TableFeats, T, unknown>
}) {
  if (header.isPlaceholder) return null
  return <table.FlexRender header={header} />
}

function DataRow<T extends RowData>({
  table,
  row,
  link,
  className,
}: {
  table: DataTableInstance<T>
  row: Row<TableFeats, T>
  link?: RowLink
  className?: string
}) {
  const cells = row.getAllCells().map((cell) => (
    <TableCell
      key={cell.id}
      className={cellClass(colOf<T>(cell), row.original)}
    >
      <table.FlexRender cell={cell} />
    </TableCell>
  ))
  if (!link) return <TableRow className={className}>{cells}</TableRow>

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") link.onOpen()
  }
  return (
    <TableRow
      role="link"
      tabIndex={0}
      aria-label={link.label}
      aria-current={link.me ? "true" : undefined}
      onClick={link.onOpen}
      onKeyDown={onKey}
      className={cn(
        "cursor-pointer hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
        link.me && "bg-primary/6 hover:bg-primary/10",
        className
      )}
    >
      {cells}
    </TableRow>
  )
}
