import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"

// Administración › Medallas (replanteo 79, plan docs/bitacora/2026-11-04-medallas-configurables, sección 9.1).

export type MedalDefinition = Schemas["MedalDefinition"]
export type MedalDefinitionCreate = Schemas["MedalDefinitionCreate"]
export type MedalDefinitionPatch = Schemas["MedalDefinitionPatch"]

export const medalKeys = {
  all: ["medal-definitions"] as const,
  admin: () => [...medalKeys.all, "admin"] as const,
  public: () => [...medalKeys.all, "public"] as const,
}

export const adminMedalsOptions = queryOptions({
  queryKey: medalKeys.admin(),
  queryFn: async () =>
    (await unwrap(api.GET("/api/v1/admin/medals/definitions"))).items,
})

export const activeMedalsOptions = queryOptions({
  queryKey: medalKeys.public(),
  queryFn: async () =>
    (await unwrap(api.GET("/api/v1/medals/definitions"))).items,
  staleTime: 5 * 60_000,
})

/** Lo que cambia con una medalla: las listas, los perfiles y las temporadas. */
function useTouched() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: medalKeys.all })
    void qc.invalidateQueries({ queryKey: ["public-player"] })
  }
}

export function useCreateMedal() {
  const touched = useTouched()
  return useMutation({
    mutationFn: (body: MedalDefinitionCreate) =>
      unwrap(api.POST("/api/v1/admin/medals/definitions", { body })),
    onSuccess: touched,
  })
}

export function usePatchMedal() {
  const touched = useTouched()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MedalDefinitionPatch }) =>
      unwrap(
        api.PATCH("/api/v1/admin/medals/definitions/{id}", {
          params: { path: { id } },
          body,
        })
      ),
    onSuccess: touched,
  })
}

export function useActivateMedal() {
  const touched = useTouched()
  return useMutation({
    mutationFn: ({ id, retroactive }: { id: string; retroactive: boolean }) =>
      unwrap(
        api.POST("/api/v1/admin/medals/definitions/{id}/activate", {
          params: { path: { id } },
          body: { retroactive },
        })
      ),
    onSuccess: touched,
  })
}

export function useArchiveMedal() {
  const touched = useTouched()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.POST("/api/v1/admin/medals/definitions/{id}/archive", {
          params: { path: { id } },
        })
      ),
    onSuccess: touched,
  })
}

export function useDeleteMedal() {
  const touched = useTouched()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE("/api/v1/admin/medals/definitions/{id}", {
          params: { path: { id } },
        })
      ),
    onSuccess: touched,
  })
}

/** "Calcular": cuántos la recibirían hoy. */
export function usePreviewMedal() {
  return useMutation({
    mutationFn: (body: Schemas["MedalPreviewBody"]) =>
      unwrap(api.POST("/api/v1/admin/medals/preview", { body })),
  })
}
