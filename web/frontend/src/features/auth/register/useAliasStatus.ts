import { useQuery } from "@tanstack/react-query"

import { aliasAvailabilityOptions } from "@/auth/queries"
import { useDebouncedValue } from "@/lib/useDebouncedValue"

export type AliasState =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "short"
  | "blocked"
  /** No se pudo verificar (red o error del servidor): no bloquea, el backend valida al crear. */
  | "unknown"

export const ALIAS_LABEL: Partial<Record<AliasState, string>> = {
  available: "Disponible",
  taken: "En uso",
  short: "Muy corto",
  blocked: "No permitido",
}

/** Estado sin consultar a la API (largo y caracteres). */
export function localAliasState(alias: string): AliasState | null {
  const value = alias.trim()
  if (!value) return "idle"
  if (value.length < 2) return "short"
  if (/[<>]/.test(value)) return "blocked"
  return null
}

/** Disponibilidad en vivo con una espera de 300 ms entre teclas. */
export function useAliasStatus(alias: string): AliasState {
  const value = alias.trim()
  const debounced = useDebouncedValue(value, 300)
  const local = localAliasState(debounced)
  const query = useQuery({
    ...aliasAvailabilityOptions(debounced),
    enabled: local === null,
  })

  const now = localAliasState(value)
  if (now !== null) return now
  if (debounced !== value || query.isFetching) return "checking"
  if (query.isError) return "unknown"
  const result = query.data
  if (!result) return "checking"
  if (result.available) return "available"
  switch (result.reason) {
    case "taken":
      return "taken"
    case "length":
      return "short"
    case "chars":
    case "blocked":
      return "blocked"
    default:
      return "taken"
  }
}

export const aliasReady = (state: AliasState) =>
  state === "available" || state === "unknown"
