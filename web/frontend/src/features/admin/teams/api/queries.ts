import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"

export type TeamConfig = Schemas["TeamConfig"]

export const teamConfigOptions = queryOptions({
  queryKey: ["admin", "teams", "config"] as const,
  queryFn: ({ signal }) =>
    unwrap(api.GET("/api/v1/admin/teams/config", { signal })),
})

export function useSaveTeamConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TeamConfig) =>
      unwrap(api.PUT("/api/v1/admin/teams/config", { body })),
    onSuccess: (data) => qc.setQueryData(teamConfigOptions.queryKey, data),
  })
}
