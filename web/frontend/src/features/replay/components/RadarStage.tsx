import { cn } from "cn"
import type { ReactNode } from "react"

import { radarBox, radarSvgUrl, type RadarInfo } from "../lib/radar"

/**
 * El radar del mapa con una capa SVG encima en coordenadas del dibujo (ver toRadar). `scale` agranda las marcas
 * en mapas grandes para que se vean igual en todos.
 */
export function RadarStage({
  map,
  radar,
  className,
  children,
  label,
}: {
  map: string
  radar: RadarInfo
  className?: string
  children?: (scale: number) => ReactNode
  label: string
}) {
  const scale = Math.max(radar.width, radar.height) / 1000
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border bg-[#20222a]",
        className
      )}
      style={radarBox(radar)}
    >
      <img
        src={radarSvgUrl(map)}
        alt=""
        draggable={false}
        className="absolute inset-0 size-full select-none"
      />
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${radar.width} ${radar.height}`}
        className="absolute inset-0 size-full"
      >
        {children?.(scale)}
      </svg>
    </div>
  )
}
