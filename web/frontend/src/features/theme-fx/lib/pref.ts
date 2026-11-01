import { BanIcon, Volume2Icon, VolumeXIcon } from "lucide-react"
import { useSyncExternalStore } from "react"

/** full: con sonido · silent: solo visual · off: desactivados. Sin valor: todavía no se preguntó. */
export type ThemeFxPref = "full" | "silent" | "off"

export const THEME_FX_KEY = "csstv.themeFx"

export const THEME_FX_OPTIONS = [
  { value: "full", label: "Con sonido", icon: Volume2Icon },
  { value: "silent", label: "Sin sonido", icon: VolumeXIcon },
  { value: "off", label: "Desactivados", icon: BanIcon },
] as const

const listeners = new Set<() => void>()
// Solo si el navegador bloquea localStorage: la elección vale para esta visita.
let memory: ThemeFxPref | null = null

function parse(value: string | null): ThemeFxPref | null {
  return value === "full" || value === "silent" || value === "off"
    ? value
    : null
}

export function getThemeFxPref(): ThemeFxPref | null {
  try {
    return parse(localStorage.getItem(THEME_FX_KEY))
  } catch {
    return memory
  }
}

/** `null` vuelve a "todavía no se preguntó". */
export function setThemeFxPref(value: ThemeFxPref | null) {
  memory = value
  try {
    if (value) localStorage.setItem(THEME_FX_KEY, value)
    else localStorage.removeItem(THEME_FX_KEY)
  } catch {
    // Sin storage: queda en memoria.
  }
  listeners.forEach((l) => l())
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // Otra pestaña cambió la preferencia.
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_FX_KEY) onChange()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onStorage)
  }
}

/** Preferencia de efectos de tema en este navegador (con sesión se sincroniza con la cuenta: useSyncThemeFx). */
export function useThemeFxPref() {
  const pref = useSyncExternalStore(subscribe, getThemeFxPref, () => null)
  return [pref, setThemeFxPref] as const
}
