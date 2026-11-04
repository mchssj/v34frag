import { useEffect, useState } from "react"

import { isApiError } from "@/api/errors"

/** Segundos que faltan para poder reintentar tras un RATE_LIMITED (0 si no hay que esperar). */
export function useRetryCountdown(error: unknown): number {
  const [left, setLeft] = useState(0)

  useEffect(() => {
    const until =
      isApiError(error, "RATE_LIMITED") && error.retryAfter
        ? Date.now() + error.retryAfter * 1000
        : 0
    const tick = () =>
      setLeft(until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0)
    const first = setTimeout(tick, 0)
    const interval = until ? setInterval(tick, 1000) : undefined
    return () => {
      clearTimeout(first)
      clearInterval(interval)
    }
  }, [error])

  return left
}
