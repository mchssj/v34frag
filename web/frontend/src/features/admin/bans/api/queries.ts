import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import type {
  Ban,
  BanStatus,
  BanCreate,
  BanPatch,
  BanFilters,
  BanPerson,
  SupportActionFilters,
} from "../types"

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

/** Cupo de baneos de soporte de la semana y si ya está baneado (replanteo 117). */
export function supportQuotaOptions(p: BanPerson | null) {
  return queryOptions({
    queryKey: [
      "admin",
      "bans",
      "support-quota",
      p ? (p.kind === "player" ? `p:${p.id}` : `s:${p.steamId}`) : "",
    ] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/bans/support-quota", {
          params: {
            query:
              p?.kind === "player"
                ? { player_id: p.id }
                : { steam_id: p?.kind === "steam" ? p.steamId : "" },
          },
          signal,
        })
      ),
    enabled: p !== null,
  })
}

export const SUPPORT_ACTIONS_PER = 25

/** Baneos › Actividad del soporte (moderadores y admins, replanteo 117). */
export function supportActionsOptions(f: SupportActionFilters, page: number) {
  return queryOptions({
    queryKey: ["admin", "bans", "support-actions", f, page] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/support-actions", {
          params: {
            query: {
              page,
              per: SUPPORT_ACTIONS_PER,
              ...(f.action ? { action: f.action } : {}),
              ...(f.actor ? { actor: f.actor } : {}),
            },
          },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
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
