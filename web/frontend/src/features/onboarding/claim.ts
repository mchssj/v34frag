import { formatDistanceStrict } from "date-fns"
import { es } from "date-fns/locale"
import { useEffect, useState } from "react"

import type { SteamStatus } from "./queries"

// Código de !claim: lo comparten la Bienvenida y Mi perfil → Vinculación.

export type ClaimCode = { code: string; expiresAt: number }

/** El último código si sigue vigente (el POST está limitado a 5 por hora). */
export function currentCode(status: SteamStatus | undefined): ClaimCode | null {
  const last = status?.last_code
  if (!last || last.status !== "pending") return null
  const expiresAt = Date.parse(last.expires_at)
  return expiresAt > Date.now() ? { code: last.code, expiresAt } : null
}

/** Segundos hasta el vencimiento; null hasta el primer cálculo. */
export function useSecondsLeft(expiresAt: number | undefined) {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!expiresAt) return
    const tick = () =>
      setLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)))
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [expiresAt])
  return left
}

/** "Vence en 8 minutos" o "Vence en 45 segundos" (redondea hacia arriba, como el contador). */
export const expiryText = (seconds: number) =>
  `Vence en ${formatDistanceStrict(0, seconds * 1000, { locale: es, roundingMethod: "ceil" })}`
