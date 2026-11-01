import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

// Cicla Sistema → Claro → Oscuro → Sistema.
const NEXT = { system: "light", light: "dark", dark: "system" } as const
const LABEL = { system: "Sistema", light: "Claro", dark: "Oscuro" } as const
const ICON = { system: MonitorIcon, light: SunIcon, dark: MoonIcon } as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = ICON[theme]
  const label = `Tema: ${LABEL[theme]}`
  return (
    <Button
      variant="outline"
      size="icon"
      title={label}
      aria-label={`${label}. Cambiar a ${LABEL[NEXT[theme]]}`}
      onClick={() => setTheme(NEXT[theme])}
    >
      <Icon className="size-[15px]" />
    </Button>
  )
}
