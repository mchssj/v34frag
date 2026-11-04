import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import type { GrantBody, GrantedFilter, MedalPatch, RulePatch } from "../types"

// Administración › Medallas (replanteo 72, docs/bitacora/2026-11-04-medallas-automaticas).

export const GRANTED_PER = 25

export const adminMedalKeys = {
  all: ["admin", "medals"] as const,
  granted: (f: GrantedFilter, page: number) =>
    ["admin", "medals", "granted", f, page] as const,
  rules: ["admin", "medals", "rules"] as const,
  seasons: ["admin", "medals", "seasons"] as const,
  players: (q: string) => ["admin", "medals", "players", q] as const,
}

export const seasonsOptions = queryOptions({
  queryKey: adminMedalKeys.seasons,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/seasons", { params: { query: { per: 50 } }, signal })
      )
    ).items,
})

export function playerSearchOptions(q: string) {
  return queryOptions({
    queryKey: adminMedalKeys.players(q),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/players", {
            params: { query: { per: 20, sort: "alias", order: "asc", q } },
            signal,
          })
        )
      ).items,
    enabled: q.trim().length > 0,
    placeholderData: keepPreviousData,
  })
}

/** Los primeros 10 elegibles de una temporada (atajo "Top 10"). */
export async function seasonTop10(id: string) {
  const r = await unwrap(
    api.GET("/api/v1/seasons/{id}/standings", {
      params: { path: { id }, query: { per: 10, eligible: "true" } },
    })
  )
  return r.items.map((s) => ({
    id: s.player.id,
    alias: s.player.alias,
    photo_url: s.player.photo_url,
  }))
}

/** Busca cada alias de una lista pegada; devuelve los encontrados y los que no. */
export async function findByAlias(lines: string[]) {
  const found: { id: string; alias: string; photo_url: string | null }[] = []
  const missing: string[] = []
  for (const line of lines) {
    const r = await unwrap(
      api.GET("/api/v1/players", { params: { query: { per: 10, q: line } } })
    )
    const p = r.items.find((x) => x.alias.toLowerCase() === line.toLowerCase())
    if (p) found.push({ id: p.id, alias: p.alias, photo_url: p.photo_url })
    else missing.push(line)
  }
  return { found, missing }
}

export function grantedOptions(f: GrantedFilter, page: number) {
  return queryOptions({
    queryKey: adminMedalKeys.granted(f, page),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/medals", {
          params: {
            query: {
              page,
              per: GRANTED_PER,
              ...(f.q ? { q: f.q } : {}),
              ...(f.season ? { season: f.season } : {}),
              ...(f.source ? { source: f.source } : {}),
            },
          },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })
}

export const rulesOptions = queryOptions({
  queryKey: adminMedalKeys.rules,
  queryFn: async ({ signal }) =>
    (await unwrap(api.GET("/api/v1/admin/medal-rules", { signal }))).items,
})

const refresh = (qc: ReturnType<typeof useQueryClient>) =>
  void qc.invalidateQueries({ queryKey: adminMedalKeys.all })

export function useGrant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: GrantBody) =>
      unwrap(api.POST("/api/v1/admin/medals", { body })),
    onSuccess: () => refresh(qc),
  })
}

export function usePatchMedal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MedalPatch }) =>
      unwrap(
        api.PATCH("/api/v1/admin/medals/{id}", {
          params: { path: { id } },
          body,
        })
      ),
    onSuccess: () => refresh(qc),
  })
}

export function useRemoveMedals() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      unwrap(api.POST("/api/v1/admin/medals/delete", { body: { ids } })),
    onSuccess: () => refresh(qc),
  })
}

export function usePatchRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, body }: { key: string; body: RulePatch }) =>
      unwrap(
        api.PATCH("/api/v1/admin/medal-rules/{key}", {
          params: { path: { key } },
          body,
        })
      ),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: adminMedalKeys.rules }),
  })
}

export function useRecalculate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/admin/medal-rules/recalculate")),
    onSuccess: () => refresh(qc),
  })
}
