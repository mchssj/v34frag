import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"

import { useMe } from "@/auth/queries"
import { catalogOptions, equippedOptions } from "@/features/shop/api"
import "@/features/shop/cosmeticos.css"
import "./launcher-tema.css"
import { inLauncher, launcherWindowTheme } from "@/lib/launcher"
import { useLauncherPrefs } from "./lib/useLauncherPrefs"

/** "#rrggbb" de una variable CSS, o null si no es un color hexadecimal (los de fábrica están en oklch). */
function hexVar(name: string) {
  const v = getComputedStyle(document.body).getPropertyValue(name).trim()
  return /^#[0-9a-f]{6}$/i.test(v) ? v : null
}

/**
 * Solo en el launcher de escritorio y si el jugador lo prendió: pinta toda la web, y la barra de título, con el tema
 * de la tienda elegido para el launcher (Perfil › Preferencias, solo entre los que tiene) o con el equipado en su
 * perfil. En el navegador no hace nada. Los temas son oscuros, como en el perfil: con el tema, la web queda oscura.
 */
export function LauncherTheme() {
  const launcher = inLauncher()
  const [prefs] = useLauncherPrefs()
  const enabled = launcher && !!prefs?.shop_theme
  const chosen = prefs?.shop_theme_id ?? null

  const me = useMe().data
  const equipped =
    useQuery({ ...equippedOptions, enabled: enabled && !chosen }).data?.theme ??
    null
  // El elegido solo si sigue siendo tuyo.
  const owned = useQuery({
    ...catalogOptions(me?.id ?? null),
    enabled: enabled && !!chosen,
  }).data?.items.some((i) => i.id === chosen && i.kind === "theme" && i.owned)
  const theme = chosen ? (owned ? chosen : null) : equipped
  const cls = enabled && theme && /^[a-z0-9-]+$/.test(theme) ? theme : null

  useEffect(() => {
    if (!launcher) return
    if (!cls) {
      launcherWindowTheme(null, null)
      return
    }
    const root = document.documentElement
    const addedDark = !root.classList.contains("dark")
    root.classList.add("dark")
    // El tema va en <body> y no en <html>: en la web compilada cosmetics.css se carga antes que index.css, y en <html>
    // el .dark de index.css le pisaba los colores (2026-11-27, no se veía nada). En <body> los define el propio
    // elemento y le ganan a lo heredado. Como en el perfil (perfil-tema) y en toda la web (launcher-tema.css).
    const body = document.body
    body.classList.add(cls, "perfil-tema", "launcher-tema")
    launcherWindowTheme(hexVar("--card"), hexVar("--primary"))
    return () => {
      body.classList.remove(cls, "perfil-tema", "launcher-tema")
      if (addedDark) root.classList.remove("dark")
      launcherWindowTheme(null, null)
    }
  }, [launcher, cls])

  return null
}
