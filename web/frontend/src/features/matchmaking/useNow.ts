import { useEffect, useState } from "react"

/** Hora actual que se renueva cada `ms` mientras `on` (cuentas regresivas y tiempo en cola). */
export function useNow(on: boolean, ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [on, ms])
  return now
}
