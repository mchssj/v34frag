import { cn } from "cn"
import type { ComponentType, ReactNode } from "react"

import type { Schemas } from "@/api/client"
import {
  C4Icon,
  CrosshairIcon,
  DefuseIcon,
  HourglassIcon,
  SkullIcon,
} from "@/components/icons/game"

type Stats = Schemas["PlayerStatsDetail"]

const ratio = (a: number, b: number) => (b > 0 ? a / b : null)

/**
 * "Jugadas clave" del perfil (plan docs/bitacora/2026-10-25-stats-partida, 4.4): multi-kills,
 * entradas, clutches ganados y objetivos de todas sus partidas.
 */
export function KeyPlays({ stats }: { stats: Stats | null | undefined }) {
  const maps = stats?.maps ?? 0
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <span className="text-sm font-semibold">Jugadas clave</span>
      {!stats || maps === 0 ? (
        <span className="text-[13px] text-muted-foreground">
          Todavía no jugó partidas en el servidor.
        </span>
      ) : (
        <Content stats={stats} maps={maps} />
      )}
    </div>
  )
}

function Content({ stats, maps }: { stats: NonNullable<Stats>; maps: number }) {
  const k = [stats.k2, stats.k3, stats.k4, stats.k5].map((v) => v ?? 0)
  const mkPerMap = ratio(
    k.reduce((s, v) => s + v, 0),
    maps
  )
  const fk = stats.first_kills ?? 0
  const fd = stats.first_deaths ?? 0
  const success = ratio(fk, fk + fd)
  const perRound = ratio(fk + fd, stats.rounds ?? 0)
  const clutches = ([1, 2, 3, 4, 5] as const).map(
    (n) => stats.clutches?.[n] ?? 0
  )
  const total = clutches.reduce((s, v) => s + v, 0)

  return (
    <>
      <Block label="Multi-kills" mark={SkullIcon}>
        <div className="grid grid-cols-4 gap-2">
          {k.map((v, i) => (
            <Tile
              key={i}
              value={v}
              label={i === 3 ? "5k · ace" : `${i + 2}k`}
              hot={i === 3 && v > 0}
              // 2k, 3k, 4k y 5k: tantas calaveras como bajas.
              top={
                <span className="flex h-3.5 gap-px" aria-hidden>
                  {Array.from({ length: i + 2 }, (_, n) => (
                    <SkullIcon key={n} className="size-3.5" />
                  ))}
                </span>
              }
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {mkPerMap === null ? "—" : mkPerMap.toFixed(1)} por partida
        </span>
      </Block>
      <Block label="Entradas" mark={CrosshairIcon}>
        <span className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
          <span className="flex items-center gap-2">
            <CrosshairIcon className="size-[18px] text-primary" />
            <span>
              <b className="font-mono text-base font-semibold tabular-nums">
                {success === null ? "—" : `${Math.round(success * 100)}%`}
              </b>{" "}
              de éxito
            </span>
          </span>
          <span>
            <b className="font-mono text-base font-semibold tabular-nums">
              {perRound === null ? "—" : perRound.toFixed(2)}
            </b>{" "}
            entradas por ronda
          </span>
        </span>
      </Block>
      <Block label="Clutches ganados" mark={HourglassIcon}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {clutches.map((v, i) => (
            <Tile
              key={i}
              value={v}
              label={`1v${i + 1}`}
              hot={i >= 3 && v > 0}
            />
          ))}
          <Tile value={total} label="total" filled />
        </div>
      </Block>
      <Block label="Objetivos" mark={C4Icon}>
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          <Objective
            icon={<C4Icon className="size-[22px]" />}
            tone="bg-primary/14 text-primary"
            value={stats.plants ?? 0}
            label="bombas plantadas"
          />
          <Objective
            icon={<DefuseIcon className="size-[18px]" />}
            tone="bg-win/15 text-win"
            value={stats.defuses ?? 0}
            label="bombas desactivadas"
          />
        </div>
      </Block>
    </>
  )
}

/** Bloque con su ícono grande de fondo, como marca de agua. */
function Block({
  label,
  mark: Mark,
  children,
}: {
  label: string
  mark: ComponentType<{ className?: string }>
  children: ReactNode
}) {
  return (
    <div className="relative flex flex-col gap-2 overflow-hidden rounded-[10px] border bg-background p-3.5">
      <Mark className="pointer-events-none absolute -right-3.5 -bottom-4 size-[120px] opacity-[.06]" />
      <span className="text-xs tracking-[.3px] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

function Tile({
  value,
  label,
  hot,
  filled,
  top,
}: {
  value: number
  label: string
  hot?: boolean
  filled?: boolean
  top?: ReactNode
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-lg border bg-card px-1 py-2",
        filled && "border-transparent bg-muted",
        hot &&
          top &&
          "border-primary/45 bg-[color-mix(in_oklch,var(--primary)_8%,var(--card))]"
      )}
    >
      {top && (
        <span className={hot ? "text-primary" : "text-muted-foreground"}>
          {top}
        </span>
      )}
      <b
        className={cn(
          "font-mono text-lg font-bold tabular-nums",
          value === 0 && !filled && "text-muted-foreground",
          hot && "text-primary"
        )}
      >
        {value}
      </b>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}

function Objective({
  icon,
  tone,
  value,
  label,
}: {
  icon: ReactNode
  tone: string
  value: number
  label: string
}) {
  return (
    <div className="relative flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5">
      <span
        className={cn(
          "grid size-[34px] shrink-0 place-items-center rounded-lg",
          tone
        )}
      >
        {icon}
      </span>
      <span className="flex flex-col">
        <b className="font-mono text-lg font-bold tabular-nums">{value}</b>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </span>
    </div>
  )
}
