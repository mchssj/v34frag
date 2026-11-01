import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { DataTable } from "./DataTable"
import { DataTablePagination, pageList } from "./DataTablePagination"
import { SortHeader } from "./SortHeader"
import {
  useServerTable,
  type DataColumn,
  type ServerSort,
} from "./useServerTable"

type Row = { id: string; name: string; elo: number; kd: number }

const COLUMNS: DataColumn<Row>[] = [
  { id: "name", header: "Jugador", cell: ({ row }) => row.original.name },
  {
    accessorKey: "elo",
    enableSorting: true,
    header: ({ column }) => <SortHeader column={column} label="ELO" />,
  },
  {
    accessorKey: "kd",
    enableSorting: true,
    header: ({ column }) => <SortHeader column={column} label="K/D" />,
  },
]

const ROWS: Row[] = [
  { id: "a", name: "Ada", elo: 1200, kd: 1.4 },
  { id: "b", name: "Beto", elo: 1100, kd: 0.9 },
]

const done = {
  isPending: false,
  isError: false,
  error: null as unknown,
  refetch: vi.fn(),
}

function Harness({
  query = done,
  rows = ROWS,
  onOpen = vi.fn(),
  onSort = vi.fn(),
  onPage = vi.fn(),
}: {
  query?: typeof done
  rows?: Row[]
  onOpen?: (r: Row) => void
  onSort?: (s: ServerSort) => void
  onPage?: (p: number) => void
}) {
  const [sort, setSort] = useState<ServerSort>()
  const table = useServerTable({
    columns: COLUMNS,
    data: rows,
    total: 60,
    page: 1,
    per: 25,
    onPage,
    sort,
    defaultSort: "elo",
    onSort: (s) => {
      setSort(s)
      onSort(s)
    },
    getRowId: (r) => r.id,
  })
  return (
    <>
      <DataTable
        table={table}
        query={query}
        empty="Sin jugadores."
        rowLink={(r) => ({ label: r.name, onOpen: () => onOpen(r) })}
      />
      <DataTablePagination
        table={table}
        perOptions={[25, 50]}
        perLabel="Filas"
      />
    </>
  )
}

describe("DataTable", () => {
  it("el orden alterna desc → asc → por defecto, y el por defecto se ve activo", async () => {
    const user = userEvent.setup()
    const onSort = vi.fn()
    render(<Harness onSort={onSort} />)
    const elo = screen.getByRole("button", { name: "Ordenar por ELO" })
    const kd = screen.getByRole("button", { name: "Ordenar por K/D" })
    expect(elo).toHaveClass("text-foreground")

    await user.click(kd)
    expect(onSort).toHaveBeenLastCalledWith({ id: "kd", desc: true })
    await user.click(kd)
    expect(onSort).toHaveBeenLastCalledWith({ id: "kd", desc: false })
    await user.click(kd)
    expect(onSort).toHaveBeenLastCalledWith(undefined)
    // Volver a hacer clic en la columna por defecto no la invierte: queda el orden por defecto.
    await user.click(elo)
    expect(onSort).toHaveBeenLastCalledWith(undefined)
  })

  it("la fila abre con clic y con Enter", async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<Harness onOpen={onOpen} />)
    await user.click(screen.getByRole("link", { name: "Ada" }))
    expect(onOpen).toHaveBeenCalledWith(ROWS[0])
    screen.getByRole("link", { name: "Beto" }).focus()
    await user.keyboard("{Enter}")
    expect(onOpen).toHaveBeenLastCalledWith(ROWS[1])
  })

  it("la paginación usa el total de la API", async () => {
    const user = userEvent.setup()
    const onPage = vi.fn()
    render(<Harness onPage={onPage} />)
    expect(screen.getByText("Mostrando 1–25 de 60")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Página siguiente" }))
    expect(onPage).toHaveBeenCalledWith(2)
  })

  it("muestra el vacío y el error con reintento", () => {
    const { rerender } = render(<Harness rows={[]} />)
    expect(screen.getByText("Sin jugadores.")).toBeInTheDocument()
    rerender(
      <Harness
        query={{ ...done, isError: true, error: new TypeError("offline") }}
      />
    )
    expect(screen.queryByRole("link", { name: "Ada" })).not.toBeInTheDocument()
  })
})

describe("pageList", () => {
  it("todas las páginas si son pocas", () => {
    expect(pageList(1, 1)).toEqual([1])
    expect(pageList(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it("la primera, la última y las vecinas si son muchas", () => {
    expect(pageList(1, 20)).toEqual([1, 2, "…", 20])
    expect(pageList(10, 20)).toEqual([1, "…", 9, 10, 11, "…", 20])
    expect(pageList(20, 20)).toEqual([1, "…", 19, 20])
  })
})
