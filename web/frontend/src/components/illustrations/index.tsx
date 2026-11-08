import { cn } from "cn"

import { LEVEL_SEGMENTS } from "@/components/brand/LevelBadge"

// Ilustraciones de estados vacíos, en SVG con los tokens del tema (se ven igual en claro y oscuro).

/** Anillo de nivel vacío con un "?" (el mismo de `LevelBadge`), para "Sin nivel todavía". */
export function NoLevelBadge({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("block size-[92px]", className)}>
      <svg viewBox="0 0 240 240" className="size-full">
        {LEVEL_SEGMENTS.map((d, i) => (
          <path key={i} d={d} style={{ fill: "var(--level-off)" }} />
        ))}
        <text
          x={120}
          y={120}
          dominantBaseline="central"
          textAnchor="middle"
          fontSize={118}
          fontWeight={900}
          className="fill-muted-foreground font-sans"
        >
          ?
        </text>
      </svg>
    </span>
  )
}

/**
 * Gráfico fantasma: una curva punteada con su área tenue y la línea del piso, de fondo detrás del
 * mensaje de "todavía no hay datos".
 */
export function GhostChart({ className }: { className?: string }) {
  const curve =
    "M0 210 C70 200 110 170 170 176 S270 130 330 140 430 96 500 110 610 60 680 70 740 48 760 44"
  return (
    <svg
      aria-hidden
      viewBox="0 0 760 280"
      preserveAspectRatio="none"
      className={cn("size-full", className)}
    >
      <defs>
        <linearGradient id="ghost-chart-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity=".18" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="stroke-border" strokeWidth="1">
        {[56, 112, 168, 224].map((y) => (
          <line key={y} x1="0" x2="760" y1={y} y2={y} />
        ))}
      </g>
      <path d={`${curve} L760 280 L0 280Z`} fill="url(#ghost-chart-fill)" />
      <path
        d={curve}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeDasharray="7 7"
        opacity=".55"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1="0"
        x2="760"
        y1="190"
        y2="190"
        className="stroke-muted-foreground"
        strokeDasharray="3 6"
        opacity=".5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
