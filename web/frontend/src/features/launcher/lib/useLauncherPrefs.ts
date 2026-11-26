import { useEffect, useState } from "react"

import {
  inLauncher,
  launcherPrefs,
  onLauncherPrefsChanged,
  type LauncherPrefs,
} from "@/lib/launcher"

/** La Configuración del launcher que ve la web, al día con los cambios. null fuera del launcher. */
export function useLauncherPrefs() {
  const launcher = inLauncher()
  const [prefs, setPrefs] = useState<LauncherPrefs | null>(null)
  useEffect(() => {
    if (!launcher) return
    const read = () => void launcherPrefs().then(setPrefs)
    read()
    return onLauncherPrefsChanged(read)
  }, [launcher])
  return [prefs, setPrefs] as const
}
