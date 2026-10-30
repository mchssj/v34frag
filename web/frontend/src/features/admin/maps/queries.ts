import { useMutation, useQueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { mapKeys } from "@/features/maps/queries"
import type { DraftMap } from "./catalog"
import { toBody } from "./catalog"

// Administración › Mapas: el catálogo entero (PUT) y la foto de cada mapa (contrato admin.md).

const touched = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: mapKeys.all })

export function useSaveCatalog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (draft: DraftMap[]) =>
      unwrap(api.PUT("/api/v1/admin/maps", { body: toBody(draft) })),
    onSuccess: () => touched(qc),
  })
}

export function useUploadMapImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, file }: { name: string; file: File }) =>
      unwrap(
        api.POST("/api/v1/admin/maps/{name}/image", {
          params: { path: { name } },
          // El schema tipa `file` como string (binary); se arma el multipart a mano.
          body: { file: "" },
          bodySerializer: () => {
            const form = new FormData()
            form.append("file", file, file.name)
            return form
          },
        })
      ),
    onSuccess: () => touched(qc),
  })
}

export function useDeleteMapImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      unwrap(
        api.DELETE("/api/v1/admin/maps/{name}/image", {
          params: { path: { name } },
        })
      ),
    onSuccess: () => touched(qc),
  })
}
