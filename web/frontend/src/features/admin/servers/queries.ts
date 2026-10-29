import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { CONFIRM_TEXT } from "../format"

// Administración › Servidores y ELO (contrato admin.md: Servidores, Demos, ELO, ajustes e interrumpidos).

export type AdminServer = Schemas["AdminServer"]
export type ServerToken = Schemas["AdminServerToken"]
export type ServerCreate = Schemas["AdminServerCreate"]
export type ServerPatch = Schemas["AdminServerPatch"]
export type AdminDemo = Schemas["AdminDemo"]
export type DemoStatus = AdminDemo["demo_status"]
export type DemoWorker = Schemas["DemoWorker"]
export type EloValues = Schemas["EloValues"]
export type EloAdjustment = Schemas["EloAdminAdjustment"]
export type PlayerSummary = Schemas["PlayerSummary"]

export const adminServerKeys = {
  all: ["admin", "servers"] as const,
  servers: ["admin", "servers", "list"] as const,
  demoSummary: ["admin", "servers", "demo-summary"] as const,
  demos: (status: DemoStatus | undefined, page: number) =>
    ["admin", "servers", "demos", status ?? "all", page] as const,
  workers: ["admin", "servers", "workers"] as const,
  eloConfig: ["elo", "config"] as const,
  eloPreview: (v: EloValues) => ["admin", "elo", "preview", v] as const,
  adjustments: (page: number) => ["admin", "elo", "adjustments", page] as const,
  pendingMixes: ["admin", "servers", "pending-mixes"] as const,
  pendingMix: (id: string) => ["admin", "servers", "pending-mix", id] as const,
  staleMixes: ["admin", "servers", "stale-mixes"] as const,
  playerSearch: (q: string) => ["admin", "player-search", q] as const,
}

// ---------- servidores ----------

// Son pocos: se piden todos y los filtros de la pantalla se aplican en el navegador.
export const serversOptions = queryOptions({
  queryKey: adminServerKeys.servers,
  queryFn: ({ signal }) =>
    unwrap(
      api.GET("/api/v1/admin/servers", {
        params: { query: { per: 100, sort: "name", order: "asc" } },
        signal,
      })
    ),
  refetchInterval: 60_000,
})

export function useCreateServer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ServerCreate) =>
      unwrap(api.POST("/api/v1/admin/servers", { body })),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: adminServerKeys.servers }),
  })
}

export function useUpdateServer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ServerPatch }) =>
      unwrap(
        api.PATCH("/api/v1/admin/servers/{id}", {
          params: { path: { id } },
          body,
        })
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: adminServerKeys.servers }),
  })
}

export function useRotateServerToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.POST("/api/v1/admin/servers/{id}/token", {
          params: { path: { id } },
        })
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: adminServerKeys.servers }),
  })
}

export function useDeleteServer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE("/api/v1/admin/servers/{id}", { params: { path: { id } } })
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: adminServerKeys.servers }),
  })
}

// ---------- demos ----------

export const demoSummaryOptions = queryOptions({
  queryKey: adminServerKeys.demoSummary,
  queryFn: ({ signal }) =>
    unwrap(api.GET("/api/v1/admin/demos/summary", { signal })),
  refetchInterval: 60_000,
})

export const DEMOS_PER = 25

export function demosOptions(status: DemoStatus | undefined, page: number) {
  return queryOptions({
    queryKey: adminServerKeys.demos(status, page),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/demos", {
          params: {
            query: { page, per: DEMOS_PER, ...(status ? { status } : {}) },
          },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })
}

export function useRetryDemo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (matchId: string) =>
      unwrap(
        api.POST("/api/v1/admin/demos/{matchId}/retry", {
          params: { path: { matchId } },
        })
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "servers"] as const }),
  })
}

export const workersOptions = queryOptions({
  queryKey: adminServerKeys.workers,
  queryFn: ({ signal }) =>
    unwrap(
      api.GET("/api/v1/admin/demo-workers", {
        params: { query: { per: 50 } },
        signal,
      })
    ),
})

export function useUpdateWorker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      unwrap(
        api.PATCH("/api/v1/admin/demo-workers/{id}", {
          params: { path: { id } },
          body: { active },
        })
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminServerKeys.all }),
  })
}

export function useRotateWorkerToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.POST("/api/v1/admin/demo-workers/{id}/token", {
          params: { path: { id } },
          body: { confirm: CONFIRM_TEXT },
        })
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: adminServerKeys.workers }),
  })
}

// ---------- reglas del ELO ----------

export const eloConfigOptions = queryOptions({
  queryKey: adminServerKeys.eloConfig,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/elo/config", { signal })),
})

export function eloPreviewOptions(values: EloValues | null) {
  return queryOptions({
    queryKey: adminServerKeys.eloPreview(values ?? ({} as EloValues)),
    queryFn: ({ signal }) =>
      unwrap(api.POST("/api/v1/admin/elo/preview", { body: values!, signal })),
    enabled: values !== null,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  })
}

export function useSaveEloConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (config: EloValues) =>
      unwrap(api.PUT("/api/v1/admin/elo/config", { body: { config } })),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: adminServerKeys.eloConfig }),
  })
}

// ---------- ajustes manuales ----------

export const ADJ_PER = 20

export function adjustmentsOptions(page: number) {
  return queryOptions({
    queryKey: adminServerKeys.adjustments(page),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/elo/adjustments", {
          params: { query: { page, per: ADJ_PER } },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })
}

/** Buscador de fichas con SteamID (los ajustes las necesitan). */
export function playerSearchOptions(q: string) {
  return queryOptions({
    queryKey: adminServerKeys.playerSearch(q),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/players", {
          params: {
            query: {
              q,
              per: 8,
              has_steam: "true",
              sort: "alias",
              order: "asc",
            },
          },
          signal,
        })
      ),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
  })
}

export type AdjustInput =
  | { player_ids: string[]; delta: number; reason: string }
  | { player_ids: string[]; set_elo: number; reason: string }

export function useAdjustElo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AdjustInput) =>
      unwrap(api.POST("/api/v1/admin/elo/adjustments", { body })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "elo"] as const })
      void qc.invalidateQueries({
        queryKey: ["admin", "player-search"] as const,
      })
      void qc.invalidateQueries({ queryKey: ["player"] as const })
    },
  })
}

export function useUndoAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      unwrap(
        api.DELETE("/api/v1/admin/elo/adjustments/{id}", {
          params: { path: { id } },
          body: { confirm: CONFIRM_TEXT },
        })
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "elo"] as const })
      void qc.invalidateQueries({
        queryKey: ["admin", "player-search"] as const,
      })
    },
  })
}

// ---------- mixes por revisar ----------

export const pendingMixesOptions = queryOptions({
  queryKey: adminServerKeys.pendingMixes,
  queryFn: ({ signal }) =>
    unwrap(
      api.GET("/api/v1/matches", {
        params: {
          query: { kind: "mix", review: "pending", per: 50, sort: "played_at" },
        },
        signal,
      })
    ),
  refetchInterval: 60_000,
})

/** El detalle trae `review_detail` (rondas, si se puede aplicar y por qué no). */
export function pendingMixOptions(id: string) {
  return queryOptions({
    queryKey: adminServerKeys.pendingMix(id),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/matches/{id}", { params: { path: { id } }, signal })
      ),
  })
}

export const staleMixesOptions = queryOptions({
  queryKey: adminServerKeys.staleMixes,
  queryFn: ({ signal }) =>
    unwrap(
      api.GET("/api/v1/mixes/live", {
        params: { query: { stale: "true", per: 50 } },
        signal,
      })
    ),
  refetchInterval: 60_000,
})

const reviewDone = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: adminServerKeys.pendingMixes })
  void qc.invalidateQueries({ queryKey: adminServerKeys.staleMixes })
  void qc.invalidateQueries({ queryKey: ["mixes"] as const })
}

export function useApplyMixElo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.POST("/api/v1/admin/mixes/{id}/apply-elo", {
          params: { path: { id } },
          body: { confirm: CONFIRM_TEXT },
        })
      ),
    onSuccess: () => reviewDone(qc),
  })
}

export function useDiscardMix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.POST("/api/v1/admin/mixes/{id}/discard", {
          params: { path: { id } },
        })
      ),
    onSuccess: () => reviewDone(qc),
  })
}

export function useCloseStaleMix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (uid: string) =>
      unwrap(
        api.POST("/api/v1/admin/mixes/live/{uid}/close", {
          params: { path: { uid } },
        })
      ),
    onSuccess: () => reviewDone(qc),
  })
}
