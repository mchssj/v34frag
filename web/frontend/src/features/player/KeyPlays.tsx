import { cn } from "cn"

import type { Schemas } from "@/api/client"

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
      <Block label="Multi-kills">
        <div className="grid grid-cols-4 gap-2">
          {k.map((v, i) => (
            <Tile
              key={i}
              value={v}
              label={i === 3 ? "5k · ace" : `${i + 2}k`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {mkPerMap === null ? "—" : mkPerMap.toFixed(1)} por partida
        </span>
      </Block>
      <Block label="Entradas">
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          <span>
            <b className="font-mono font-semibold tabular-nums">
              {success === null ? "—" : `${Math.round(success * 100)}%`}
            </b>{" "}
            de éxito
          </span>
          <span>
            <b className="font-mono font-semibold tabular-nums">
              {perRound === null ? "—" : perRound.toFixed(2)}
            </b>{" "}
            entradas por ronda
          </span>
        </span>
      </Block>
      <Block label="Clutches ganados">
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
      <Block label="Objetivos">
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          <span>
            <b className="font-mono font-semibold tabular-nums">
              {stats.plants ?? 0}
            </b>{" "}
            bombas plantadas
          </span>
          <span>
            <b className="font-mono font-semibold tabular-nums">
              {stats.defuses ?? 0}
            </b>{" "}
            bombas desactivadas
          </span>
        </span>
      </Block>
    </>
  )
}

function Block({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
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
}: {
  value: number
  label: string
  hot?: boolean
  filled?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-px rounded-lg border px-1 py-2",
        filled && "border-transparent bg-muted"
      )}
    >
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
