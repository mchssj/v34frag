import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { errorFromResponse, networkError } from "@/api/errors"
import { authFetch } from "@/auth/authFetch"
import { env } from "@/lib/env"

// Aptitud de cada servidor (replanteo 56): matchmaking, torneos y PCW. Las rutas todavía no están en la OpenAPI
// del frontend: se llama con authFetch directo, como el matchmaking.

export type ServerFlags = {
  id: string
  name: string
  state: "free" | "lobby" | "booking" | "live" | "offline"
  mm_enabled: boolean
  official_enabled: boolean
  pcw_enabled: boolean
}
export type FlagKey = "mm_enabled" | "official_enabled" | "pcw_enabled"

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

const flagsKey = ["admin", "servers", "flags"] as const

/** La lista de servidores del matchmaking (son pocos) trae las tres marcas y el estado de cada uno. */
export const serverFlagsOptions = queryOptions({
  queryKey: flagsKey,
  queryFn: async ({ signal }) =>
    (await call<ServerFlags[]>("/api/v1/admin/mm/servers", { signal })) ?? [],
  refetchInterval: 30_000,
})

export function useSetServerFlag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      flag,
      value,
    }: {
      id: string
      flag: FlagKey
      value: boolean
    }) =>
      call<void>(`/api/v1/admin/servers/${id}/flags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [flag]: value }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: flagsKey })
      void qc.invalidateQueries({ queryKey: ["mm", "admin", "servers"] })
    },
  })
}
