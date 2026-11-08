import { useId, useState, type PointerEvent } from "react"

import type { Schemas } from "@/api/client"
import { EloTooltip } from "@/components/brand/EloTooltip"

type Point = Schemas["EloPoint"]

const W = 240
const H = 60

/**
 * ELO de las últimas partidas, de la más vieja a la más nueva. Al pasar el mouse (o tocar) marca
 * la partida más cercana con el ELO que quedó, el cambio y el mapa.
 */
export function EloChart({ points }: { points: Point[] }) {
  const gradient = useId()
  const [hover, setHover] = useState<number | null>(null)
  if (points.length < 2) return null

  const vals = points.map((p) => p.elo_after)
  const lo = Math.min(...vals) - 8
  const hi = Math.max(...vals) + 8
  const x = (i: number) => (i / (points.length - 1)) * W
  const y = (v: number) => H - 4 - ((v - lo) / (hi - lo)) * (H - 8)
  const line = points.map((p, i) => `${x(i)},${y(p.elo_after)}`).join(" ")
  const first = points[0]
  const last = points[points.length - 1]
  const start = first.elo_before ?? first.elo_after
  const total = last.elo_after - start

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left) / r.width) * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, i)))
  }
  const pos = (i: number) => ({
    left: `${(x(i) / W) * 100}%`,
    top: `${(y(points[i].elo_after) / H) * 100}%`,
  })
  const h = hover === null ? null : points[hover]
  const frac = hover === null ? 0.5 : hover / (points.length - 1)

  return (
    <div className="flex min-h-[84px] flex-1 flex-col gap-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>ELO en tus últimas {points.length} partidas</span>
        <span className="font-mono tabular-nums">
          {total >= 0 ? "+" : ""}
          {total}
        </span>
      </div>
      <div
        role="img"
        aria-label={`ELO en tus últimas ${points.length} partidas: de ${start} a ${last.elo_after}`}
        className="relative min-h-16 flex-1 cursor-crosshair touch-pan-y"
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden
          className="absolute inset-0 size-full"
        >
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--primary)" stopOpacity={0.22} />
              <stop offset="1" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path
            d={`M${line.replaceAll(" ", " L")} L${W},${H} L0,${H} Z`}
            fill={`url(#${gradient})`}
          />
          <polyline
            points={line}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {hover !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-px bg-border"
            style={{ left: pos(hover).left }}
          />
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute -mt-[4.5px] -ml-[4.5px] size-[9px] rounded-full border-2 border-card bg-primary"
          style={pos(hover ?? points.length - 1)}
        />
        {h && <EloTooltip point={h} left={pos(hover!).left} frac={frac} />}
      </div>
      <div className="flex justify-between font-mono text-[10.5px] text-muted-foreground">
        <span>{start} al principio</span>
        <span>Hoy {last.elo_after}</span>
      </div>
    </div>
  )
}
