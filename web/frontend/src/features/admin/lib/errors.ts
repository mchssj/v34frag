import { isApiError } from "@/api/errors"

/**
 * El nombre choca con una palabra bloqueada: la API responde BUSINESS_RULE con el campo en
 * `details` y acepta `force: true` para guardarlo igual (contrato admin.md).
 */
export function isBlockedName(e: unknown, field: string): boolean {
  return (
    isApiError(e, "BUSINESS_RULE") && e.details.some((d) => d.path === field)
  )
}
