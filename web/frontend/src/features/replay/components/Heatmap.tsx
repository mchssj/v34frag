import { cn } from "cn"
import { useEffect, useRef } from "react"

import { radarBox, radarSvgUrl, type RadarInfo } from "../lib/radar"

export interface HeatPoint {
  x: number
  y: number
}

// Resolución del lienzo: una celda cada RES unidades del juego.
const RES = 4
// Radio de cada punto, en unidades del juego.
const RADIUS = 110

/** Mapa de calor: dónde se acumulan los puntos (kills o muertes) sobre el radar del mapa. */
export function Heatmap({
  map,
  radar,
  points,
  label,
  className,
}: {
  map: string
  radar: RadarInfo
  points: HeatPoint[]
  label: string
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const w = Math.ceil(radar.width / RES)
    const h = Math.ceil(radar.height / RES)
    cv.width = w
    cv.height = h
    const ctx = cv.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    if (!points.length) return
    // 1) Densidad en el canal alfa: cada punto suma un círculo difuso.
    const r = RADIUS / RES
    const a = Math.min(0.35, Math.max(0.06, 6 / Math.sqrt(points.length)))
    for (const p of points) {
      const x = (p.x - radar.minx) / RES
      const y = (radar.maxy - p.y) / RES
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(0,0,0,${a})`)
      g.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    // 2) Color según la densidad: azul → verde → amarillo → rojo.
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i + 3] / 255
      if (v === 0) continue
      const [cr, cg, cb] = ramp(v)
      d[i] = cr
      d[i + 1] = cg
      d[i + 2] = cb
      d[i + 3] = Math.round(Math.min(1, v * 1.6) * 210)
    }
    ctx.putImageData(img, 0, 0)
  }, [radar, points])

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
        className="absolute inset-0 size-full opacity-80 select-none"
      />
      <canvas
        ref={ref}
        role="img"
        aria-label={label}
        className="absolute inset-0 size-full"
      />
    </div>
  )
}

const STOPS: [number, [number, number, number]][] = [
  [0, [40, 90, 255]],
  [0.35, [40, 220, 120]],
  [0.65, [255, 220, 40]],
  [1, [240, 50, 40]],
]

function ramp(v: number): [number, number, number] {
  for (let i = 1; i < STOPS.length; i++) {
    const [p1, c1] = STOPS[i]
    if (v <= p1) {
      const [p0, c0] = STOPS[i - 1]
      const k = (v - p0) / (p1 - p0)
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * k)) as [
        number,
        number,
        number,
      ]
    }
  }
  return STOPS[STOPS.length - 1][1]
}
