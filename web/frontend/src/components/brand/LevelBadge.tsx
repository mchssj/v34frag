import { cn } from "cn"

// Colores por nivel del handoff (data.js → lvlColor / lvlFg).
function levelClasses(level: number) {
  if (level >= 10) return "bg-primary text-primary-foreground"
  if (level >= 8) return "bg-sidebar-primary text-primary-foreground"
  if (level >= 4) return "bg-foreground text-background"
  return "bg-muted-foreground text-background"
}

export function LevelBadge({
  level,
  className,
}: {
  level: number
  className?: string
}) {
  return (
    <span
      title={`Nivel ${level}`}
      className={cn(
        "grid size-[26px] shrink-0 place-items-center rounded-[6px] font-mono text-xs font-bold",
        levelClasses(level),
        className
      )}
    >
      {level}
    </span>
  )
}
