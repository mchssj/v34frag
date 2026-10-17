import { cn } from "cn"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"

export const THEME_MODES = [
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Oscuro", icon: MoonIcon },
  { value: "system", label: "Sistema", icon: MonitorIcon },
] as const

/** Selector de tema segmentado (landing). La app interna usa ThemeToggle. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  return (
    <div
      role="group"
      aria-label="Tema"
      className={cn(
        "flex gap-0.5 rounded-lg border bg-muted p-[3px]",
        className
      )}
    >
      {THEME_MODES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className="grid size-[30px] place-items-center rounded-[calc(var(--radius)-4px)] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  )
}
