import { cn } from "cn"

// Nivel con el anillo de 10 segmentos (bitácora 2026-11-07-niveles-con-anillo, diseño de
// badges/nuevas/niveles): se encienden tantos segmentos como el nivel, con el color de su tramo.

/** Tramo de color de un nivel: 1, 2-3, 4-7, 8-9 y 10. */
export function levelTier(level: number): 1 | 2 | 4 | 8 | 10 {
  if (level >= 10) return 10
  if (level >= 8) return 8
  if (level >= 4) return 4
  if (level >= 2) return 2
  return 1
}

/** Color del nivel (variable del tema `--level-*`, distinta en claro y en oscuro). */
export const levelColor = (level: number) => `var(--level-${levelTier(level)})`

// Los 10 segmentos del anillo en un lienzo de 240: de 4° a 32° de cada tramo de 36°, empezando arriba.
const C = 120
const R_IN = 90
const R_OUT = 112
const point = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180
  return `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`
}
export const LEVEL_SEGMENTS = Array.from({ length: 10 }, (_, i) => {
  const a1 = -90 + i * 36 + 4
  const a2 = -90 + i * 36 + 32
  return `M${point(R_OUT, a1)} A${R_OUT} ${R_OUT} 0 0 1 ${point(R_OUT, a2)} L${point(R_IN, a2)} A${R_IN} ${R_IN} 0 0 0 ${point(R_IN, a1)} Z`
})

// 60: tarjeta de nivel del perfil; 48: inicio; 30: comparador; 26: sidebar y perfil; 24: ranking; 22: sala del mix; 20: MVP del listado de mixes.
const SIZES = {
  20: "size-5",
  22: "size-[22px]",
  24: "size-6",
  26: "size-[26px]",
  30: "size-[30px]",
  48: "size-12",
  60: "size-[60px]",
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
  const n = Math.max(0, Math.min(10, Math.round(level)))
  const color = levelColor(n)
  return (
    <span
      role="img"
      title={`Nivel ${level}`}
      aria-label={`Nivel ${level}`}
      className={cn("inline-grid shrink-0", SIZES[size], className)}
    >
      <svg viewBox="0 0 240 240" className="size-full" aria-hidden>
        {LEVEL_SEGMENTS.map((d, i) => (
          <path
            key={i}
            d={d}
            data-on={i < n || undefined}
            style={{ fill: i < n ? color : "var(--level-off)" }}
          />
        ))}
        <text
          x={C}
          y={C}
          dominantBaseline="central"
          textAnchor="middle"
          fontSize={n >= 10 ? 96 : 118}
          fontWeight={900}
          letterSpacing={n >= 10 ? -6 : 0}
          className="fill-foreground font-sans"
        >
          {level}
        </text>
      </svg>
    </span>
  )
}
