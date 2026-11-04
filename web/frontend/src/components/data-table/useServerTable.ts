import {
  functionalUpdate,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type PaginationState,
  type ReactTable,
  type RowData,
  type SortingState,
} from "@tanstack/react-table"

// Tablas paginadas y ordenadas por la API: la tabla no procesa filas, solo lleva la página y el
// orden, que viven afuera (en la búsqueda de la URL o en un useState).

const features = tableFeatures({ rowPaginationFeature, rowSortingFeature })
export type TableFeats = typeof features

/** Columna de una tabla: la de TanStack más las clases de su cabecera y sus celdas. */
export type DataColumn<T extends RowData> = ColumnDef<TableFeats, T> & {
  headClassName?: string
  /** Clases de la celda; con una función, según la fila. */
  cellClassName?: string | ((row: T) => string | undefined)
}

export type DataTableInstance<T extends RowData> = ReactTable<TableFeats, T>

/** Orden elegido; `undefined` es el orden por defecto de la API. */
export type ServerSort = { id: string; desc: boolean } | undefined

// Las columnas solo ordenan si lo piden (`enableSorting: true` y un accessor).
const defaultColumn = { enableSorting: false }

export function useServerTable<T extends RowData>({
  columns,
  data,
  total,
  page,
  per,
  onPage,
  onPer,
  sort,
  defaultSort,
  onSort,
  getRowId,
}: {
  columns: DataColumn<T>[]
  data: T[] | undefined
  total: number | undefined
  page: number
  per: number
  onPage: (page: number) => void
  onPer?: (per: number) => void
  sort?: ServerSort
  /** Columna que se ve activa (descendente) sin orden propio. */
  defaultSort?: string
  onSort?: (sort: ServerSort) => void
  getRowId?: (row: T) => string
}): DataTableInstance<T> {
  const pagination: PaginationState = { pageIndex: page - 1, pageSize: per }
  const sorting: SortingState = sort
    ? [sort]
    : defaultSort
      ? [{ id: defaultSort, desc: true }]
      : []

  return useTable({
    features,
    columns,
    defaultColumn,
    data: data ?? (EMPTY as T[]),
    rowCount: total ?? 0,
    getRowId: getRowId && ((row) => getRowId(row)),
    manualPagination: true,
    manualSorting: true,
    // Clic en una columna: descendente, ascendente y vuelta al orden por defecto.
    sortDescFirst: true,
    enableMultiSort: false,
    state: { pagination, sorting },
    onPaginationChange: (u) => {
      const next = functionalUpdate(u, pagination)
      if (next.pageSize !== per) onPer?.(next.pageSize)
      else if (next.pageIndex !== pagination.pageIndex)
        onPage(next.pageIndex + 1)
    },
    onSortingChange: (u) => {
      const first = functionalUpdate(u, sorting)[0]
      onSort?.(!first || first.id === defaultSort ? undefined : first)
    },
  })
}

// Fuera del render: un `[]` nuevo en cada render invalidaría las filas de la tabla.
const EMPTY: unknown[] = []
