import { cn } from "cn"

// Ilustraciones de estados vacíos, en SVG con los tokens del tema (se ven igual en claro y oscuro).

/** Insignia de nivel sin número: un "?" dentro del hexágono, para "Sin nivel todavía". */
export function NoLevelBadge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("relative block h-[104px] w-[92px]", className)}
    >
      <svg viewBox="0 0 92 104" className="absolute inset-0 size-full">
        <path
          d="M46 3 87 26.5v51L46 101 5 77.5v-51Z"
          className="fill-muted stroke-border"
          strokeWidth="2"
        />
        <path
          d="M46 15 76 32v40L46 89 16 72V32Z"
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth="1.5"
          strokeDasharray="4 5"
          opacity=".6"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-[34px] font-bold text-muted-foreground">
        ?
      </span>
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
