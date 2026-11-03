import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { errorFromResponse, networkError } from "@/api/errors"
import { authFetch } from "@/auth/authFetch"
import { env } from "@/lib/env"

// Imagen del panel de Iniciar sesión, Registro y Bienvenida (replanteo 67, bitácora
// 2026-11-03-imagen-login). Las rutas todavía no están en schema.d.ts: se llama con authFetch,
// como la imagen del MVP. Al regenerarlo, se pasa a `api.GET(...)` con `unwrap`.

type AuthImage = { url: string | null }

async function call(
  path: string,
  init?: RequestInit & { signal?: AbortSignal }
): Promise<AuthImage> {
  let res: Response
  try {
    res = await authFetch(`${env.apiUrl}${path}`, init)
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e
    throw networkError()
  }
  const body: unknown = await res.json().catch(() => undefined)
  if (!res.ok) throw errorFromResponse(res, body)
  return body as AuthImage
}

const ADMIN_PATH = "/api/v1/admin/site/auth-image"

export const authImageOptions = queryOptions({
  queryKey: ["site", "auth-image"] as const,
  queryFn: ({ signal }) =>
    call("/api/v1/site/auth-image", { signal }).then((r) => r.url),
  staleTime: 5 * 60_000,
  // Sin imagen o si falla, el panel queda gris: no vale la pena insistir.
  retry: false,
})

function useAuthImageMutation<V>(fn: (v: V) => Promise<AuthImage>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) =>
      queryClient.setQueryData(authImageOptions.queryKey, r.url),
  })
}

export const useUploadAuthImage = () =>
  useAuthImageMutation((file: Blob) => {
    const body = new FormData()
    body.set("file", file, "login.jpg")
    return call(ADMIN_PATH, { method: "PUT", body })
  })

export const useDeleteAuthImage = () =>
  useAuthImageMutation(() => call(ADMIN_PATH, { method: "DELETE" }))
