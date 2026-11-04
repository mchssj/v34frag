import { cn } from "cn"

// Colores por nivel del handoff (data.js → lvlColor / lvlFg).
function levelClasses(level: number) {
  if (level >= 10) return "bg-primary text-primary-foreground"
  if (level >= 8) return "bg-sidebar-primary text-primary-foreground"
  if (level >= 4) return "bg-foreground text-background"
  return "bg-muted-foreground text-background"
}

// 30: comparador; 26: sidebar y perfil; 24: ranking; 22: sala del mix; 20: MVP del listado de mixes.
const SIZES = {
  20: "size-5 rounded-[5px] text-[10px] font-semibold",
  22: "size-[22px] rounded-[5px] text-[11px] font-semibold",
  24: "size-6 rounded-[6px] text-xs font-semibold",
  26: "size-[26px] rounded-[6px] text-xs font-bold",
  30: "size-[30px] rounded-[7px] text-sm font-bold",
} as const

export function LevelBadge({
  level,
  size = 26,
  className,
}: {
  level: number
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <span
      title={`Nivel ${level}`}
      className={cn(
        "grid shrink-0 place-items-center font-mono",
        SIZES[size],
        levelClasses(level),
        className
      )}
    >
      {level}
    </span>
  )
}
