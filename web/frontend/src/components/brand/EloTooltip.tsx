import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

import type { Schemas } from "@/api/client"

type Point = Schemas["EloPoint"]

/**
 * Globo de una partida de la gráfica de ELO: el ELO que quedó, el cambio en color, la fecha y el
 * mapa. Va dentro del contenedor `relative` de la gráfica, encima de ella. `left` es la posición
 * del punto (en %) y `frac` (0 a 1) cuánto se corre hacia adentro en los bordes.
 */
export function EloTooltip({
  point,
  left,
  frac,
}: {
  point: Point
  left: string
  frac: number
}) {
  const delta = point.elo_delta ?? 0
  return (
    <span
      className="pointer-events-none absolute bottom-[calc(100%+6px)] z-10 rounded-lg bg-foreground px-2.5 py-1.5 text-xs whitespace-nowrap text-background shadow-md"
      style={{
        left,
        transform: `translateX(${frac < 0.2 ? "-12%" : frac > 0.8 ? "-88%" : "-50%"})`,
      }}
    >
      <b className="font-mono">{point.elo_after}</b> ELO{" "}
      <span
        className={
          delta >= 0
            ? "font-mono font-semibold text-win"
            : "font-mono font-semibold text-destructive"
        }
      >
        {delta >= 0 ? "+" : ""}
        {delta}
      </span>
      <span className="block text-[11px] opacity-70">
        {[
          point.at && format(parseISO(point.at), "d MMM", { locale: es }),
          point.map,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </span>
  )
}
