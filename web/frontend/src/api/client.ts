import createClient from "openapi-fetch"

import { authFetch } from "@/auth/authFetch"
import { env } from "@/lib/env"
import { errorFromResponse, isApiError, networkError } from "./errors"
import type { components, paths } from "./schema"

export type Schemas = components["schemas"]

export const api = createClient<paths>({
  baseUrl: env.apiUrl,
  fetch: authFetch,
})

type Result<T> = { data?: T; error?: unknown; response: Response }

/** Espera la llamada de openapi-fetch y devuelve `data`, o lanza un ApiError. */
export async function unwrap<T>(call: Promise<Result<T>>): Promise<T> {
  let result: Result<T>
  try {
    result = await call
  } catch (e) {
    if (isApiError(e)) throw e
    // Una cancelación de Query no es un error de red.
    if (e instanceof DOMException && e.name === "AbortError") throw e
    throw networkError()
  }
  if (result.error !== undefined || !result.response.ok) {
    throw errorFromResponse(result.response, result.error)
  }
  return result.data as T
}
