import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import { errorFromResponse, networkError } from "@/api/errors"
import { authFetch } from "@/auth/authFetch"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { FilterChips } from "@/components/brand/FilterChips"
import { SearchBox } from "@/components/brand/SearchBox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  useServerTable,
  type DataColumn,
} from "@/components/data-table/useServerTable"
import { env } from "@/lib/env"
import { AdminTable } from "../../components/ui"
import { fmtDateTime } from "../../lib/format"

// Sanciones por abandonar una PCW (replanteo 56): al equipo oficial y a cada jugador del bando. Las rutas
// todavía no están en la OpenAPI del frontend: se llama con authFetch directo.

export type PcwBan = {
  id: string
  team: { id: string; name: string } | null
  player: { id: string; nick: string } | null
  until: string
  reason: string
  match_id: string | null
  created_at: string
  lifted_at: string | null
  active: boolean
}
type Page = { items: PcwBan[]; total: number }
export type BanState = "active" | "all" | "past"

const PER = 20

async function call<T>(
  path: string,
  init?: RequestInit & { signal?: AbortSignal }
): Promise<T | undefined> {
  let res: Response
  try {
    res = await authFetch(`${env.apiUrl}${path}`, init)
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e
    throw networkError()
  }
  const body: unknown =
    res.status === 204 ? undefined : await res.json().catch(() => undefined)
  if (!res.ok) throw errorFromResponse(res, body)
  return body as T
}

const bansKey = ["admin", "pcw-bans"] as const

function bansOptions(state: BanState, q: string | undefined, page: number) {
  const p = new URLSearchParams({
    page: String(page),
    per: String(PER),
    sort: "created_at",
    order: "desc",
  })
  if (state !== "all") p.set("active", String(state === "active"))
  if (q) p.set("q", q)
  return queryOptions({
    queryKey: [...bansKey, state, q ?? "", page] as const,
    queryFn: async ({ signal }) =>
      (await call<Page>(`/api/v1/admin/pcw-bans?${p}`, { signal }))!,
    placeholderData: keepPreviousData,
  })
}

const COLUMNS = (onLift: (b: PcwBan) => void): DataColumn<PcwBan>[] => [
  {
    id: "who",
    header: "Sancionado",
    headClassName: "pl-4",
    cellClassName: "pl-4",
    cell: ({ row: { original: b } }) =>
      b.team ? (
        <span className="font-semibold">{b.team.name}</span>
      ) : (
        <span>{b.player?.nick ?? "—"}</span>
      ),
  },
  {
    id: "kind",
    header: "Tipo",
    cell: ({ row: { original: b } }) => (
      <Badge variant="muted">{b.team ? "equipo" : "jugador"}</Badge>
    ),
  },
  {
    id: "until",
    header: "Hasta",
    cellClassName: "text-xs",
    cell: ({ row: { original: b } }) =>
      b.lifted_at ? (
        <span className="text-muted-foreground">levantada</span>
      ) : (
        <span className={b.active ? "" : "text-muted-foreground"}>
          {fmtDateTime(b.until)}
        </span>
      ),
  },
  {
    id: "match",
    header: "PCW",
    cell: ({ row: { original: b } }) =>
      b.match_id ? (
        <Link
          to="/match/$id"
          params={{ id: b.match_id }}
          className="text-xs underline-offset-4 hover:underline"
        >
          Ver partida
        </Link>
      ) : (
        "—"
      ),
  },
  {
    id: "lift",
    header: "",
    headClassName: "pr-4",
    cellClassName: "pr-4 text-right",
    cell: ({ row: { original: b } }) =>
      b.active ? (
        <Button size="sm" variant="ghost" onClick={() => onLift(b)}>
          Levantar
        </Button>
      ) : null,
  },
]

/** Administración › Equipos › Sanciones de PCW (moderadores y admins). */
export function PcwBansTab() {
  const [state, setState] = useState<BanState>("active")
  const [q, setQ] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [lifting, setLifting] = useState<PcwBan | null>(null)
  const qc = useQueryClient()
  const list = useQuery(bansOptions(state, q, page))
  const lift = useMutation({
    mutationFn: (id: string) =>
      call<void>(`/api/v1/admin/pcw-bans/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setLifting(null)
      toast.success("Sanción levantada.")
      void qc.invalidateQueries({ queryKey: bansKey })
    },
  })
  const table = useServerTable({
    columns: COLUMNS(setLifting),
    data: list.data?.items,
    total: list.data?.total,
    page,
    per: PER,
    onPage: setPage,
    getRowId: (b) => b.id,
  })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted-foreground">
        Quien abandona una PCW (no se presenta o se va a mitad de un mapa) no
        puede crear ni aceptar PCW: 3 días, y 7 si se repite dentro de los 30
        días. Se sanciona al equipo oficial y a cada jugador del plantel de ese
        bando.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips
          label="Filtrar sanciones"
          value={state}
          onChange={(v) => {
            setState(v ?? "active")
            setPage(1)
          }}
          options={[
            { value: "active", label: "Vigentes" },
            { value: "past", label: "Vencidas o levantadas" },
            { value: "all", label: "Todas" },
          ]}
        />
        <div className="w-full sm:ml-auto sm:w-72">
          <SearchBox
            value={q}
            placeholder="Equipo o jugador"
            label="Buscar sanción"
            onChange={(v) => {
              setQ(v)
              setPage(1)
            }}
          />
        </div>
      </div>
      <AdminTable
        table={table}
        query={list}
        className="min-w-[560px]"
        empty="No hay sanciones con esos filtros."
      />
      <ConfirmDialog
        open={lifting !== null}
        onOpenChange={(o) => !o && setLifting(null)}
        title="¿Levantar la sanción?"
        description={`${lifting?.team?.name ?? lifting?.player?.nick ?? ""} vuelve a poder crear y aceptar PCW.`}
        confirmLabel="Levantar"
        pending={lift.isPending}
        error={lift.error}
        onConfirm={() => lifting && lift.mutate(lifting.id)}
      />
    </div>
  )
}
