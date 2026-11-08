import { queryOptions, useQuery } from "@tanstack/react-query"

import { errorFromResponse, networkError } from "@/api/errors"
import { authFetch } from "@/auth/authFetch"
import { env } from "@/lib/env"
import type { ManualIndice, ManualPagina } from "../types"

// Las rutas del manual no están en la OpenAPI del frontend (están en la línea del matchmaking de la
// API): se llama con authFetch directo, como el matchmaking y las reservas.
async function get(path: string, signal?: AbortSignal): Promise<Response> {
  let res: Response
  try {
    res = await authFetch(`${env.apiUrl}${path}`, { signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e
    throw networkError()
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => undefined)
    throw errorFromResponse(res, body)
  }
  return res
}
const getJson = async <T>(path: string, signal?: AbortSignal) =>
  (await (await get(path, signal)).json()) as T

const seg = encodeURIComponent

export const helpKeys = {
  index: ["help", "index"] as const,
  page: (seccion: string, tarea: string) =>
    ["help", "page", seccion, tarea] as const,
  image: (seccion: string, archivo: string) =>
    ["help", "image", seccion, archivo] as const,
}

// El manual cambia solo con un despliegue de la API: se guarda un buen rato.
const STALE = 10 * 60_000

export const manualIndexOptions = () =>
  queryOptions({
    queryKey: helpKeys.index,
    queryFn: ({ signal }) => getJson<ManualIndice>("/api/v1/manual", signal),
    staleTime: STALE,
  })

export const manualPageOptions = (seccion: string, tarea: string) =>
  queryOptions({
    queryKey: helpKeys.page(seccion, tarea),
    queryFn: ({ signal }) =>
      getJson<ManualPagina>(
        `/api/v1/manual/${seg(seccion)}/${seg(tarea)}`,
        signal
      ),
    staleTime: STALE,
  })

/**
 * Una captura del manual como URL `blob:`. Un `<img>` común no manda la sesión y la API solo da las
 * capturas de las secciones que ve la cuenta, así que se piden con authFetch. La URL se crea una vez
 * por captura y queda mientras dure la sesión (son pocas y livianas).
 */
export function useManualImage(seccion: string, archivo: string | null) {
  const img = useQuery({
    queryKey: helpKeys.image(seccion, archivo ?? ""),
    queryFn: async ({ signal }) => {
      const res = await get(
        `/api/v1/manual/${seg(seccion)}/img/${seg(archivo ?? "")}`,
        signal
      )
      return URL.createObjectURL(await res.blob())
    },
    enabled: !!archivo,
    staleTime: Infinity,
    gcTime: Infinity,
  })
  return { url: img.data ?? null, isError: img.isError }
}
