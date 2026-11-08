import { cn } from "cn"

import { LevelBadge, levelColor } from "@/components/brand/LevelBadge"
import { LEVEL_FLOORS } from "@/features/player/lib/labels"

/** Tu ELO en el panel de partida: nivel, ELO, barra de los 10 niveles y cuánto falta. */
export function EloMeter({ elo, level }: { elo: number; level: number }) {
  const next = level < 10 ? LEVEL_FLOORS[level]! : null
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2">
        <LevelBadge level={level} size={24} />
        <span className="font-mono text-2xl font-bold tabular-nums">
          {elo.toLocaleString("es-AR")}
        </span>
        <span className="text-xs font-semibold text-muted-foreground">ELO</span>
      </span>
      <span className="flex w-full gap-1" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={cn("h-1 flex-1 rounded-full", i >= level && "bg-muted")}
            // Encendidos con el color del nivel, como el anillo de LevelBadge.
            style={
              i < level ? { backgroundColor: levelColor(level) } : undefined
            }
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
