import { cn } from "cn"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { LEVEL_FLOORS } from "@/features/player/labels"

// Color de cada tramo de la barra de niveles: grises abajo, verdes en el medio y naranja arriba.
function segmentClass(n: number) {
  if (n >= 10) return "bg-primary"
  if (n >= 8) return "bg-sidebar-primary"
  if (n >= 4) return "bg-win"
  return "bg-muted-foreground"
}

/** ELO arriba a la derecha de Jugar: nivel, ELO, barra de los 10 niveles y cuánto falta. */
export function EloMeter({ elo, level }: { elo: number; level: number }) {
  const next = level < 10 ? LEVEL_FLOORS[level]! : null
  return (
    <div className="flex flex-col items-end gap-1.5">
      <span className="flex items-center gap-2">
        <LevelBadge level={level} size={24} className="rounded-full" />
        <span className="text-2xl font-bold tabular-nums">
          {elo.toLocaleString("es-AR")}
        </span>
        <span className="text-xs font-semibold text-muted-foreground">ELO</span>
      </span>
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 w-4 rounded-full",
              i < level ? segmentClass(i + 1) : "bg-muted"
            )}
          />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">
        {next === null ? (
          "Nivel máximo"
        ) : (
          <>
            +{next - elo} para el{" "}
            <strong className="text-foreground">nivel {level + 1}</strong>
          </>
        )}
      </span>
    </div>
  )
}
