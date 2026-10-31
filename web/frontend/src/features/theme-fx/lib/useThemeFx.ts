import { useEffect, useRef, useState } from "react"

import { useTheme, type Theme } from "@/components/theme-provider"
import { decideFx } from "./decide"
import { flashbang, smoke } from "./engine"
import { getThemeFxPref, setThemeFxPref, type ThemeFxPref } from "./pref"
import { preloadSamples } from "./samples"

/**
 * Cambio de tema con efectos. `pickTheme` reemplaza a `setTheme`; la primera vez que habría un
 * efecto deja el tema pendiente y abre el modal (`askOpen`), que se resuelve con `resolveAsk`.
 */
export function useThemeFx() {
  const { setTheme } = useTheme()
  const [pending, setPending] = useState<Theme | null>(null)
  const busy = useRef(false)

  useEffect(() => preloadSamples(), [])

  const pickTheme = (target: Theme) => {
    const decision = decideFx({
      target,
      isDark: document.documentElement.classList.contains("dark"),
      systemDark: window.matchMedia("(prefers-color-scheme: dark)").matches,
      pref: getThemeFxPref(),
      busy: busy.current,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
    })
    if (decision === "ask") return setPending(target)
    if (decision === "direct") return setTheme(target)
    busy.current = true
    const run = decision === "flashbang" ? flashbang : smoke
    run({
      applyTheme: () => setTheme(target),
      sound: getThemeFxPref() === "full",
      onEnd: () => {
        busy.current = false
      },
    })
  }

  /** Respuesta del modal. Sin elección (Esc, clic fuera, X): tema sin efecto y no se guarda nada. */
  const resolveAsk = (choice: ThemeFxPref | null) => {
    const target = pending
    setPending(null)
    if (!target) return
    if (!choice) return setTheme(target)
    setThemeFxPref(choice)
    pickTheme(target)
  }

  return { pickTheme, askOpen: pending !== null, resolveAsk }
}
