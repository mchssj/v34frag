import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"

// Administración › Baneos: la lista única de todos los servidores (contrato admin.md).

export type Ban = Schemas["Ban"]
export type BanStatus = Ban["status"]
export type BanSource = Ban["source"]
export type BanCreate = Schemas["BanCreate"]
export type BanPatch = Schemas["BanPatch"]

/** Orden de la lista: los más recientes primero, o los que vencen antes (los permanentes al final). */
export type BanSort = "recent" | "soon"

export type BanFilters = {
  source?: BanSource
  server?: string
  q?: string
  sort: BanSort
}

export const BANS_PER = 25

export const banKeys = {
  all: ["admin", "bans"] as const,
  list: (status: BanStatus | undefined, f: BanFilters, page: number) =>
    ["admin", "bans", "list", status ?? "all", f, page] as const,
  count: (status: BanStatus, f: BanFilters) =>
    ["admin", "bans", "count", status, f] as const,
  person: (key: string) => ["admin", "bans", "person", key] as const,
}

const filterQuery = (f: BanFilters) => ({
  ...(f.source ? { source: f.source } : {}),
  ...(f.server ? { server: f.server } : {}),
  ...(f.q ? { q: f.q } : {}),
})

export function bansOptions(
  status: BanStatus | undefined,
  f: BanFilters,
  page: number
) {
  return queryOptions({
    queryKey: banKeys.list(status, f, page),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/bans", {
          params: {
            query: {
              page,
              per: BANS_PER,
              ...(status ? { status } : {}),
              ...filterQuery(f),
              ...(f.sort === "soon"
                ? { sort: "expires_at" as const, order: "asc" as const }
                : {}),
            },
          },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })
}

/** Total de un estado con los mismos filtros, para las pestañas (la API no tiene estadísticas). */
export function banCountOptions(status: BanStatus, f: BanFilters) {
  return queryOptions({
    queryKey: banKeys.count(status, f),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/bans", {
          params: { query: { status, per: 1, ...filterQuery(f) } },
          signal,
        })
      ),
    select: (page) => page.total,
    placeholderData: keepPreviousData,
  })
}

/** Baneos activos de todos los servidores, para el contador del sidebar. */
export const activeBanCountOptions = banCountOptions("active", {
  sort: "recent",
})

/** A quién alcanza un baneo: la ficha o, si no tiene, el SteamID. */
export type BanPerson =
  { kind: "player"; id: string } | { kind: "steam"; steamId: string }

export function banPerson(b: Ban): BanPerson | null {
  if (b.player) return { kind: "player", id: b.player.id }
  return b.steam_id ? { kind: "steam", steamId: b.steam_id } : null
}

/** Todos los baneos de esa persona: los de la ficha, o la búsqueda por SteamID si no tiene ficha. */
export function personBansOptions(p: BanPerson | null) {
  return queryOptions({
    queryKey: banKeys.person(
      p ? (p.kind === "player" ? `p:${p.id}` : `s:${p.steamId}`) : ""
    ),
    queryFn: ({ signal }) =>
      p?.kind === "player"
        ? unwrap(
            api.GET("/api/v1/players/{id}/bans", {
              params: { path: { id: p.id }, query: { per: 50 } },
              signal,
            })
          )
        : unwrap(
            api.GET("/api/v1/bans", {
              params: { query: { q: p?.steamId ?? "", per: 50 } },
              signal,
            })
          ),
    enabled: p !== null,
  })
}

/** Baneos activos de una ficha o un SteamID, para avisar que el nuevo los reemplaza. */
export function activeBansForOptions(q: string) {
  return queryOptions({
    queryKey: ["admin", "bans", "active-for", q] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/bans", {
          params: { query: { status: "active", q, per: 5 } },
          signal,
        })
      ),
    enabled: q.length > 0,
  })
}

const touchedBans = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: banKeys.all })
  void qc.invalidateQueries({ queryKey: ["player"] as const })
}

export function useCreateBan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BanCreate) =>
      unwrap(api.POST("/api/v1/admin/bans", { body })),
    onSuccess: () => touchedBans(qc),
  })
}

export function useUpdateBan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: BanPatch }) =>
      unwrap(
        api.PATCH("/api/v1/admin/bans/{id}", { params: { path: { id } }, body })
      ),
    onSuccess: () => touchedBans(qc),
  })
}

export function useLiftBan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      unwrap(
        api.POST("/api/v1/admin/bans/{id}/lift", {
          params: { path: { id } },
          body: { reason },
        })
      ),
    onSuccess: () => touchedBans(qc),
  })
}
