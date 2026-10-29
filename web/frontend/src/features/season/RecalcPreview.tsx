import { cn } from "cn"
import { CrownIcon, LockIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { Slider } from "@/components/ui/slider"
import { levelOf } from "@/features/matchmaking/room/roomData"
import { LEVEL_FLOORS } from "@/features/player/labels"

import { AVG, ME, SEASON, STANDINGS } from "./demo"
import {
  DEFAULT_RULES,
  previewFor,
  rankAll,
  resetElo,
  tierOf,
  type Preview,
  type Standing,
} from "./preview"

// Vista previa del próximo recálculo (cierre de temporada) para VIP
// (docs/bitacora/2026-10-29-proximo-recalculo en kyan/pruebas).

const rules = DEFAULT_RULES
const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

function useCountdown(iso: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const ms = Math.max(0, new Date(iso).getTime() - now)
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return ms === 0 ? "cerrando" : d > 0 ? `${d} d ${h} h` : `${h} h ${m} min`
}

function Tile({
  label,
  value,
  sub,
  className,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl border p-4", className)}>
      <span className="text-[11px] font-semibold tracking-[0.4px] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="font-heading text-2xl font-semibold tabular-nums">
        {value}
      </span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}

function Tiles({ p, matches }: { p: Preview; matches: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        label="Tu puesto"
        value={p.rank ? `#${p.rank}` : "Sin puesto"}
        sub={
          p.rank
            ? `entre los que llegan a ${rules.min_matches} mixes`
            : `Te faltan ${p.missing} mixes para entrar`
        }
      />
      <Tile
        label="Medalla"
        value={p.tier ? `${p.tier.icon} ${p.tier.name}` : "Ninguna"}
        sub={
          p.tier
            ? "si la temporada cerrara ahora"
            : `Las reciben los ${rules.top_n} primeros`
        }
      />
      <Tile
        label="ELO después del cierre"
        value={p.elo_after}
        sub={
          p.elo_after === p.elo
            ? `No cambia: el reinicio es solo arriba de ${rules.reset_floor}`
            : `${p.elo} → ${p.elo_after}: te quedás con el ${rules.reset_pct} % de lo que pasa ${rules.reset_floor}`
        }
      />
      <Tile
        label="Mixes"
        value={`${matches} / ${rules.min_matches}`}
        sub={p.missing ? `Faltan ${p.missing}` : "Llegaste al mínimo"}
        className={cn(p.missing > 0 && "border-amber-500/50")}
      />
    </div>
  )
}

function Goals({ p }: { p: Preview }) {
  const items: string[] = []
  if (p.missing)
    items.push(
      `Jugá ${p.missing} mixes más para tener puesto. Sin el mínimo no hay medalla, aunque tengas ELO de sobra.`
    )
  if (p.to_next_tier)
    items.push(
      `Con ${signed(p.to_next_tier.elo)} de ELO entrás a ${p.to_next_tier.tier.icon} ${p.to_next_tier.tier.name}.`
    )
  if (p.to_next_rank !== null && p.to_next_rank !== p.to_next_tier?.elo)
    items.push(
      `Con ${signed(p.to_next_rank)} pasás al de arriba (#${p.rank! - 1}).`
    )
  if (p.lead_below !== null)
    items.push(`Le llevás ${p.lead_below} de ELO al de abajo.`)
  if (p.rank === 1) items.push("Vas primero. Si cerrara ahora, sos el campeón.")
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <span aria-hidden className="text-primary">
            ›
          </span>
          {t}
        </li>
      ))}
    </ul>
  )
}

function Ladder({
  list,
  myRank,
}: {
  list: (Standing & { rank: number | null })[]
  myRank: number | null
}) {
  const ranked = list
    .filter((s) => s.rank !== null)
    .sort((a, b) => a.rank! - b.rank!)
  const center = myRank ?? rules.top_n
  const from = Math.max(0, center - 4)
  const rows = ranked.slice(from, from + 7)
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[11px] tracking-[0.4px] text-muted-foreground uppercase">
          <th className="py-2 text-left font-semibold">#</th>
          <th className="py-2 text-left font-semibold">Jugador</th>
          <th className="py-2 text-right font-semibold">ELO</th>
          <th className="py-2 text-right font-semibold">Después</th>
          <th className="py-2 pl-4 text-left font-semibold">Medalla</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => {
          const t = tierOf(s.rank)
          const me = s.id === ME
          return (
            <tr
              key={s.id}
              className={cn(
                "border-t",
                me && "bg-primary/10 font-semibold",
                s.rank === rules.top_n && "border-b-dashed border-b-2"
              )}
            >
              <td className="py-2 font-mono">{s.rank}</td>
              <td className="py-2">
                <span className="flex items-center gap-2">
                  <LevelBadge level={levelOf(s.elo, LEVEL_FLOORS)} size={20} />
                  {me ? "Vos" : s.nick}
                </span>
              </td>
              <td className="py-2 text-right font-mono">{s.elo}</td>
              <td className="py-2 text-right font-mono text-muted-foreground">
                {resetElo(s.elo)}
              </td>
              <td className="py-2 pl-4">{t ? `${t.icon} ${t.name}` : "-"}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function RecalcPreview({
  vip,
  list = STANDINGS,
}: {
  vip: boolean
  list?: Standing[]
}) {
  const left = useCountdown(SEASON.ends_at)
  const [wins, setWins] = useState([3])
  const [losses, setLosses] = useState([1])

  const meNow = list.find((s) => s.id === ME)!
  const now = previewFor(ME, list)
  const projectedList = list.map((s) =>
    s.id === ME
      ? {
          ...s,
          elo: Math.max(
            100,
            s.elo + wins[0]! * AVG.win + losses[0]! * AVG.loss
          ),
          matches: s.matches + wins[0]! + losses[0]!,
        }
      : s
  )
  const proj = previewFor(ME, projectedList)
  const meProj = projectedList.find((s) => s.id === ME)!

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.4px] text-muted-foreground uppercase">
            {SEASON.name}
          </p>
          <p className="font-heading text-lg font-semibold">
            Cierra en <span className="text-primary">{left}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(SEASON.ends_at).toLocaleString("es-AR", {
              dateStyle: "full",
              timeStyle: "short",
            })}
          </p>
        </div>
        <p className="max-w-md text-xs text-muted-foreground">
          Al cerrar se guarda el ranking, los {rules.top_n} primeros con al
          menos {rules.min_matches} mixes reciben su medalla y los que pasan{" "}
          {rules.reset_floor} de ELO se reinician.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-semibold">
          Si cerrara ahora
        </h2>
        <Tiles p={now} matches={meNow.matches} />
        {vip && <Goals p={now} />}
      </section>

      <section className="relative flex flex-col gap-4 rounded-xl border p-4">
        <div>
          <h2 className="font-heading text-base font-semibold">
            ¿Y si jugás más antes del cierre?
          </h2>
          <p className="text-sm text-muted-foreground">
            Proyección con tu promedio de la temporada: {signed(AVG.win)} por
            victoria y {signed(AVG.loss)} por derrota. Los demás quedan como
            están.
          </p>
        </div>
        <div
          className={cn(
            "flex flex-col gap-4",
            !vip && "pointer-events-none blur-[3px] select-none"
          )}
          aria-hidden={!vip}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["Victorias", wins, setWins],
                ["Derrotas", losses, setLosses],
              ] as const
            ).map(([label, v, set]) => (
              <label key={label} className="flex flex-col gap-2 text-sm">
                <span className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono">{v[0]}</span>
                </span>
                <Slider
                  aria-label={label}
                  min={0}
                  max={10}
                  step={1}
                  value={[...v]}
                  onValueChange={set}
                />
              </label>
            ))}
          </div>
          <Tiles p={proj} matches={meProj.matches} />
          <Goals p={proj} />
        </div>
        {!vip && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex max-w-sm flex-col items-center gap-2 rounded-xl border bg-background/95 p-5 text-center shadow-lg">
              <CrownIcon aria-hidden className="size-6 text-amber-400" />
              <p className="font-semibold">La proyección es para VIP</p>
              <p className="text-sm text-muted-foreground">
                Sabé cuántos mixes te faltan para la medalla y cómo te queda el
                ELO después del cierre.
              </p>
              <LockIcon aria-hidden className="size-4 text-muted-foreground" />
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border p-4">
        <h2 className="font-heading text-base font-semibold">Alrededor tuyo</h2>
        {(vip ? proj.rank : now.rank) === null && (
          <p className="text-xs text-muted-foreground">
            Todavía no tenés puesto: se muestra la zona del último puesto con
            medalla (#{rules.top_n}).
          </p>
        )}
        <Ladder
          list={rankAll(vip ? projectedList : list)}
          myRank={vip ? proj.rank : now.rank}
        />
        {vip && (
          <p className="text-xs text-muted-foreground">
            Con la proyección de arriba.
          </p>
        )}
      </section>
    </div>
  )
}
