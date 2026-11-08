import { useEffect, useState } from "react"

import { serverNow } from "./serverClock"

/** Hora del servidor que se renueva cada `ms` mientras `on` (cuentas regresivas y tiempo en cola). */
export function useNow(on: boolean, ms = 1000) {
  const [now, setNow] = useState(() => serverNow())
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setNow(serverNow()), ms)
    return () => clearInterval(id)
  }, [on, ms])
  return now
}
