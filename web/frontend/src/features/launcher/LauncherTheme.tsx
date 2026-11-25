import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { equippedOptions } from "@/features/shop/api"
import "@/features/shop/cosmeticos.css"
import {
  inLauncher,
  launcherPrefs,
  launcherWindowTheme,
  registerLauncherHandlers,
} from "@/lib/launcher"

/** "#rrggbb" de una variable CSS, o null si no es un color hexadecimal (los de fábrica están en oklch). */
function hexVar(name: string) {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return /^#[0-9a-f]{6}$/i.test(v) ? v : null
}

/**
 * Solo en el launcher de escritorio y si el jugador lo prendió en su Configuración: pinta toda la web, y la barra de
 * título, con el tema de la tienda que tiene equipado en su perfil (solo se equipan los que tiene). En el navegador
 * no hace nada. Los temas son oscuros, como en el perfil, así que con el tema puesto la web queda en oscuro.
 */
export function LauncherTheme() {
  const launcher = inLauncher()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (!launcher) return
    const read = () =>
      void launcherPrefs().then((p) => setEnabled(!!p?.shop_theme))
    read()
    return registerLauncherHandlers({ prefsChanged: read })
  }, [launcher])

  const theme =
    useQuery({ ...equippedOptions, enabled: launcher && enabled }).data
      ?.theme ?? null
  const cls =
    launcher && enabled && theme && /^[a-z0-9-]+$/.test(theme) ? theme : null

  useEffect(() => {
    if (!launcher) return
    if (!cls) {
      launcherWindowTheme(null, null)
      return
    }
    const root = document.documentElement
    const addedDark = !root.classList.contains("dark")
    root.classList.add(cls, "dark")
    launcherWindowTheme(hexVar("--card"), hexVar("--primary"))
    return () => {
      root.classList.remove(cls)
      if (addedDark) root.classList.remove("dark")
      launcherWindowTheme(null, null)
    }
  }, [launcher, cls])

  return null
}
