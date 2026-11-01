import type { Theme } from "@/components/theme-provider"
import type { ThemeFxPref } from "./pref"

export type FxDecision = "ask" | "direct" | "flashbang" | "smoke"

/**
 * Qué hacer al elegir un tema. Flashbang solo al elegir Claro desde oscuro; smoke al pasar de
 * claro a oscuro (Oscuro, o Sistema con el sistema en oscuro). Todo lo demás es directo.
 */
export function decideFx({
  target,
  isDark,
  systemDark,
  pref,
  busy,
  reducedMotion,
}: {
  target: Theme
  isDark: boolean
  systemDark: boolean
  pref: ThemeFxPref | null
  /** Ya hay un efecto en curso. */
  busy: boolean
  reducedMotion: boolean
}): FxDecision {
  const toDark = target === "dark" || (target === "system" && systemDark)
  const effect =
    target === "light" && isDark
      ? "flashbang"
      : toDark && !isDark
        ? "smoke"
        : null
  if (!effect || busy || reducedMotion) return "direct"
  if (pref === null) return "ask"
  if (pref === "off") return "direct"
  return effect
}
