import { useQuery } from "@tanstack/react-query"
import { CheckIcon } from "lucide-react"

import { aliasAvailabilityOptions, type AliasReason } from "@/auth/queries"
import { aliasField } from "@/auth/schemas"
import { FieldDescription } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { useDebouncedValue } from "@/lib/useDebouncedValue"

export const ALIAS_REASON_TEXT: Record<AliasReason, string> = {
  length: "El alias tiene que tener entre 2 y 24 caracteres.",
  chars: "El alias tiene caracteres no permitidos.",
  blocked: "Ese alias no está permitido.",
  taken: "Ese alias ya está en uso.",
}

/** Consulta la disponibilidad mientras se escribe (con espera de 400 ms). */
export function useAliasAvailability(value: string) {
  const debounced = useDebouncedValue(value.trim(), 400)
  const valid = aliasField.safeParse(debounced).success
  const query = useQuery({
    ...aliasAvailabilityOptions(debounced),
    enabled: valid,
  })
  const settled = debounced === value.trim()
  return {
    checking: valid && (!settled || query.isFetching),
    // null = no se pudo verificar (red o error del servidor): no bloquea el envío.
    result: valid && settled ? (query.data ?? null) : null,
  }
}

export function AliasStatus({ value }: { value: string }) {
  const { checking, result } = useAliasAvailability(value)
  if (checking) {
    return (
      <FieldDescription className="flex items-center gap-1.5">
        <Spinner className="size-3" /> Verificando disponibilidad…
      </FieldDescription>
    )
  }
  if (!result) return null
  if (result.available) {
    return (
      <FieldDescription className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
        <CheckIcon className="size-3.5" /> Disponible
      </FieldDescription>
    )
  }
  return (
    <FieldDescription className="text-destructive">
      {result.reason
        ? ALIAS_REASON_TEXT[result.reason]
        : "Ese alias no está disponible."}
    </FieldDescription>
  )
}
