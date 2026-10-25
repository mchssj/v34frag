import { useState, type PointerEvent } from "react"

import type { Schemas } from "@/api/client"
import { fmtDay } from "./labels"

type Point = Schemas["EloPoint"]

const W = 600
const H = 200

/**
 * Evolución de ELO (handoff 2): área y línea en `primary`, la línea punteada en el piso del nivel
 * actual y el punto bajo el puntero con su valor.
 */
export function EloChart({
  points,
  floor,
  level,
  onHover,
}: {
  points: Point[]
  /** Piso del nivel actual (línea punteada); null sin nivel. */
  floor: number | null
  level: number | null
  onHover: (label: string | null) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  if (points.length < 2)
    return (
      <p className="grid min-h-[200px] place-items-center text-[13px] text-muted-foreground">
        Todavía no hay mixes para el gráfico.
      </p>
    )

  const values = points.map((p) => p.elo_after)
  const all = floor === null ? values : [...values, floor]
  const min = Math.min(...all) - 20
  const max = Math.max(...all) + 20
  const x = (i: number) => (i / (points.length - 1)) * W
  const y = (v: number) => H - 10 - ((v - min) / (max - min)) * (H - 20)
  const line = points
    .map((p, i) => `${x(i).toFixed(1)},${y(p.elo_after).toFixed(1)}`)
    .join(" ")

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left) / r.width) * (points.length - 1))
    const idx = Math.max(0, Math.min(points.length - 1, i))
    if (idx === hover) return
    setHover(idx)
    const p = points[idx]
    onHover(
      [p.elo_after, p.map, p.at ? fmtDay(p.at) : null]
        .filter(Boolean)
        .join(" · ")
    )
  }
  const leave = () => {
    setHover(null)
    onHover(null)
  }

  const h = hover === null ? null : points[hover]
  return (
    <div
      className="relative min-h-[200px] flex-1 touch-none"
      onPointerMove={move}
      onPointerLeave={leave}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`ELO en los últimos ${points.length} mixes: de ${values[0]} a ${values[values.length - 1]}`}
        className="absolute inset-0 size-full"
      >
        <defs>
          <linearGradient id="elo-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity=".28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {floor !== null && (
          <line
            x1="0"
            x2={W}
            y1={y(floor)}
            y2={y(floor)}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
            className="stroke-muted-foreground/60"
          />
        )}
        <polygon points={`0,${H} ${line} ${W},${H}`} fill="url(#elo-fill)" />
        <polyline
          points={line}
          fill="none"
          strokeWidth="2.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="stroke-primary"
        />
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1="0"
            y2={H}
            vectorEffect="non-scaling-stroke"
            className="stroke-border"
          />
        )}
      </svg>
      {h && hover !== null && (
        <span
          aria-hidden
          className="pointer-events-none absolute -mt-[5px] -ml-[5px] size-2.5 rounded-full bg-primary shadow-[0_0_0_3px_var(--card)]"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: `${(y(h.elo_after) / H) * 100}%`,
          }}
        />
      )}
      {floor !== null && level !== null && (
        <span
          className="pointer-events-none absolute right-0 -translate-y-[120%] font-mono text-[11px] font-medium text-muted-foreground"
          style={{ top: `${(y(floor) / H) * 100}%` }}
        >
          Nivel {level} · {floor}
        </span>
      )}
    </div>
  )
}
