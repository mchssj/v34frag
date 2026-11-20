import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import type { ReactNode } from "react"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Compare, RecapPlayer, StatKey } from "./types"

// Globos del recap: cada cifra con el promedio de la temporada y el percentil, y cada persona con su
// temporada en pocas cifras (y el link a su perfil).

export const fmt = (n: number, d = 0) =>
  n.toLocaleString("es-AR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })

const STAT: Record<StatKey, { label: string; show: (n: number) => string }> = {
  matches: { label: "Mixes", show: (n) => fmt(n, n % 1 ? 1 : 0) },
  rounds: { label: "Rondas", show: (n) => fmt(n) },
  hours: { label: "Horas", show: (n) => fmt(n, n % 1 ? 1 : 0) },
  win_pct: { label: "Victorias", show: (n) => `${fmt(n)}%` },
  best_streak: { label: "Mejor racha", show: (n) => fmt(n, n % 1 ? 1 : 0) },
  kills: { label: "Kills", show: (n) => fmt(n) },
  deaths: { label: "Muertes", show: (n) => fmt(n) },
  assists: { label: "Asistencias", show: (n) => fmt(n) },
  kd: { label: "K/D", show: (n) => fmt(n, 2) },
  hs_pct: { label: "% de headshots", show: (n) => `${fmt(n)}%` },
  adr: { label: "ADR (daño por ronda)", show: (n) => fmt(n, 1) },
  k3: { label: "3K (rondas de 3 kills)", show: (n) => fmt(n) },
  first_kills: {
    label: "Aperturas (primera kill de la ronda)",
    show: (n) => fmt(n),
  },
  k4: { label: "Rondas de 4 kills", show: (n) => fmt(n, n % 1 ? 1 : 0) },
  aces: { label: "Aces", show: (n) => fmt(n, n % 1 ? 1 : 0) },
  elo_delta: {
    label: "ELO ganado",
    show: (n) => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`,
  },
  rating: { label: "Rating promedio", show: (n) => fmt(n, 2) },
}

export const statLabel = (k: StatKey) => STAT[k].label

/** Frase del percentil: "Mejor que el 87% de los jugadores". */
export function pctText(k: StatKey, pct: number) {
  if (k === "deaths") return `Moriste menos que el ${pct}% de los jugadores`
  if (pct >= 50) return `Mejor que el ${pct}% de los jugadores`
  return `Por encima del ${pct}% de los jugadores`
}

/** Tooltip de una cifra: lo tuyo, el promedio de la temporada y una barra que los compara. */
export function StatHint({
  k,
  value,
  compare,
  players,
  className,
  children,
}: {
  k: StatKey
  value: number
  compare: Compare
  players: number
  className?: string
  children: ReactNode
}) {
  const c = compare[k]
  const s = STAT[k]
  const top = Math.max(value, c.avg) || 1
  const better = k === "deaths" ? value <= c.avg : value >= c.avg
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          data-interactive
          tabIndex={0}
          className={cn(
            "cursor-help rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="flex w-60 flex-col items-stretch gap-2 px-3 py-2.5"
      >
        <span className="font-semibold">{s.label}</span>
        <Bar
          label="Vos"
          value={s.show(value)}
          frac={value / top}
          tone={better ? "bg-win" : "bg-destructive"}
        />
        <Bar
          label="Promedio"
          value={s.show(c.avg)}
          frac={c.avg / top}
          tone="bg-background/50"
        />
        <span className="text-[11px] text-background/70">
          {pctText(k, c.pct)} · {players} jugaron la temporada
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

function Bar({
  label,
  value,
  frac,
  tone,
}: {
  label: string
  value: string
  frac: number
  tone: string
}) {
  return (
    <span className="grid grid-cols-[64px_1fr_auto] items-center gap-2 text-[11.5px]">
      <span className="text-background/70">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-background/15">
        <span
          className={cn("block h-full rounded-full", tone)}
          style={{ width: `${Math.max(4, frac * 100)}%` }}
        />
      </span>
      <span className="font-mono font-semibold tabular-nums">{value}</span>
    </span>
  )
}

/** Una persona del recap: link a su perfil y globo con su temporada y lo que hicieron juntos. */
export function PersonLink({
  p,
  lines,
  className,
  children,
}: {
  p: RecapPlayer
  /** Lo propio de la relación: "21 mixes juntos", "Duelo 58–23"… */
  lines: [string, string][]
  className?: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/player/$nick"
          params={{ nick: p.nick }}
          data-interactive
          className={cn(
            "rounded-xl transition-colors outline-none hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          {children}
        </Link>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="flex w-64 flex-col items-stretch gap-2.5 px-3 py-3"
      >
        <span className="flex items-center gap-2.5">
          <PlayerAvatar
            alias={p.nick}
            photo={p.photo}
            playerId={p.id}
            className="size-9"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{p.nick}</span>
            <span className="text-[11px] text-background/70">Su temporada</span>
          </span>
          {/* El globo invierte los colores: el número del nivel va en el color del globo. */}
          <LevelBadge
            level={p.level}
            size={26}
            className="[&_text]:fill-background"
          />
        </span>
        <span className="grid grid-cols-3 gap-1.5 text-center">
          <Mini label="ELO" value={fmt(p.elo)} />
          <Mini label="K/D" value={fmt(p.kd, 2)} />
          <Mini label="Mixes" value={String(p.matches)} />
        </span>
        {lines.length > 0 && (
          <span className="flex flex-col gap-1 border-t border-background/15 pt-2 text-[11.5px]">
            {lines.map(([k, v]) => (
              <span key={k} className="flex justify-between gap-2">
                <span className="text-background/70">{k}</span>
                <span className="font-mono font-semibold tabular-nums">
                  {v}
                </span>
              </span>
            ))}
          </span>
        )}
        <span className="text-[11px] text-background/60">
          Tocá para ver su perfil
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col rounded-md bg-background/10 py-1">
      <span className="font-mono text-[13px] font-semibold tabular-nums">
        {value}
      </span>
      <span className="text-[10.5px] text-background/70">{label}</span>
    </span>
  )
}

/** Globo simple para lo que no es una cifra con promedio (mapas, arma, partida). */
export function Hint({
  text,
  className,
  children,
}: {
  text: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          data-interactive
          tabIndex={0}
          className={cn(
            "cursor-help rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="flex max-w-64 flex-col items-start gap-1"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  )
}
