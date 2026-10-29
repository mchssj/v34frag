import { cn } from "cn"
import { CrownIcon, PlusIcon, TrophyIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import { byNick, COMPARE_PLAYERS, type ComparePlayer } from "./demo"

// Comparador de hasta 5 jugadores para VIP (docs/bitacora/2026-10-29-comparador-5 en kyan/pruebas).

export const FREE_MAX = 2
export const VIP_MAX = 5

// Colores categóricos 1 a 5, validados con el validador de dataviz en claro y oscuro (sin colisiones para
// daltonismo). En claro aqua, amarillo y magenta quedan bajo 3:1 contra el fondo: por eso siempre van con
// el nick al lado y la tabla, nunca el color solo.
const SERIES =
  "[--s0:#2a78d6] [--s1:#eb6834] [--s2:#1baf7a] [--s3:#eda100] [--s4:#e87ba4] dark:[--s0:#3987e5] dark:[--s1:#d95926] dark:[--s2:#199e70] dark:[--s3:#c98500] dark:[--s4:#d55181]"
const color = (slot: number) => `var(--s${slot})`

interface Metric {
  label: string
  value: (p: ComparePlayer) => number
  show: (v: number) => string
  /** true: gana el más bajo (no hay ninguna así hoy, queda por si se suma). */
  lower?: boolean
}

const METRICS: Metric[] = [
  { label: "ELO", value: (p) => p.elo, show: String },
  { label: "ELO máximo", value: (p) => p.peak_elo, show: String },
  { label: "Rating", value: (p) => p.rating, show: (v) => v.toFixed(2) },
  { label: "K/D", value: (p) => p.kd, show: (v) => v.toFixed(2) },
  { label: "HS %", value: (p) => p.hs, show: (v) => `${v.toFixed(1)}%` },
  { label: "ADR", value: (p) => p.adr, show: (v) => v.toFixed(1) },
  {
    label: "% Victorias",
    value: (p) => p.winrate,
    show: (v) => `${v.toFixed(1)}%`,
  },
  { label: "Mixes", value: (p) => p.matches, show: String },
]

export interface Picked {
  nick: string
  slot: number
}

function AddPlayer({
  taken,
  onAdd,
  disabled,
}: {
  taken: string[]
  onAdd: (nick: string) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const list = COMPARE_PLAYERS.filter((p) =>
    p.nick.toLowerCase().includes(q.trim().toLowerCase())
  ).slice(0, 30)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          aria-expanded={open}
          disabled={disabled}
        >
          <PlusIcon aria-hidden />
          Agregar jugador
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={q}
            onValueChange={setQ}
            placeholder="Buscar por alias"
          />
          <CommandList>
            <CommandEmpty>No hay jugadores con ese alias.</CommandEmpty>
            {list.map((p) => (
              <CommandItem
                key={p.id}
                value={p.id}
                disabled={taken.includes(p.nick)}
                onSelect={() => {
                  onAdd(p.nick)
                  setOpen(false)
                  setQ("")
                }}
              >
                <LevelBadge level={p.level} size={20} />
                <span className="flex-1 truncate">{p.nick}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {p.elo}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Líneas de ELO, una por jugador, con línea de referencia y tooltip al pasar el mouse. */
function EloChart({
  players,
}: {
  players: (ComparePlayer & { slot: number })[]
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720
  const H = 260
  const pad = { l: 44, r: 92, t: 12, b: 24 }
  const all = players.flatMap((p) => p.history)
  const min = Math.floor((Math.min(...all) - 20) / 50) * 50
  const max = Math.ceil((Math.max(...all) + 20) / 50) * 50
  const n = players[0]!.history.length
  const x = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r)
  const y = (v: number) =>
    pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b)
  const ticks = Array.from({ length: 5 }, (_, k) =>
    Math.round(min + ((max - min) * k) / 4)
  )

  // Etiquetas directas al final de cada línea, separadas para que no se pisen.
  const labels = players
    .map((p) => ({ p, y: y(p.history.at(-1)!) }))
    .sort((a, b) => a.y - b.y)
  for (let k = 1; k < labels.length; k++)
    labels[k]!.y = Math.max(labels[k]!.y, labels[k - 1]!.y + 14)

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="ELO de los últimos 30 mixes de cada jugador"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1))
          setHover(i >= 0 && i < n ? i : null)
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(t)}
              y2={y(t)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={pad.l - 8}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {t}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} className="fill-muted-foreground text-[10px]">
          hace 30 mixes
        </text>
        <text
          x={W - pad.r}
          y={H - 6}
          textAnchor="end"
          className="fill-muted-foreground text-[10px]"
        >
          último
        </text>
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.t}
            y2={H - pad.b}
            className="stroke-muted-foreground"
            strokeDasharray="3 3"
          />
        )}
        {players.map((p) => (
          <g key={p.id}>
            <polyline
              fill="none"
              stroke={color(p.slot)}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={p.history.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            />
            {hover !== null && (
              <circle
                cx={x(hover)}
                cy={y(p.history[hover]!)}
                r={4}
                fill={color(p.slot)}
                className="stroke-background"
                strokeWidth={2}
              />
            )}
          </g>
        ))}
        {labels.map(({ p, y: ly }) => (
          <g key={p.id}>
            <circle cx={W - pad.r + 10} cy={ly} r={3.5} fill={color(p.slot)} />
            <text
              x={W - pad.r + 18}
              y={ly}
              dominantBaseline="middle"
              className="fill-foreground text-[11px]"
            >
              {p.nick}
            </text>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
          style={{
            left: `min(calc(${(x(hover) / W) * 100}% + 12px), calc(100% - 160px))`,
          }}
        >
          <p className="mb-1 text-muted-foreground">
            {hover === n - 1 ? "Último mix" : `Hace ${n - 1 - hover} mixes`}
          </p>
          {[...players]
            .sort((a, b) => b.history[hover]! - a.history[hover]!)
            .map((p) => (
              <p key={p.id} className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ background: color(p.slot) }}
                />
                <span className="flex-1">{p.nick}</span>
                <span className="font-mono">{p.history[hover]}</span>
              </p>
            ))}
        </div>
      )}
    </div>
  )
}

export function MultiCompare({
  picked,
  onChange,
  vip,
}: {
  picked: Picked[]
  onChange: (p: Picked[]) => void
  vip: boolean
}) {
  const limit = vip ? VIP_MAX : FREE_MAX
  const players = picked
    .map((x) => ({ ...byNick(x.nick)!, slot: x.slot }))
    .filter((p) => p.id)
    .slice(0, limit)
  const over = picked.length > limit

  const add = (nick: string) => {
    if (players.length >= limit)
      return toast.error(
        vip
          ? `Hasta ${VIP_MAX} jugadores.`
          : `Sin VIP comparás hasta ${FREE_MAX}. Con VIP, hasta ${VIP_MAX}.`
      )
    // El color libre más bajo: los que ya están no cambian de color.
    const used = new Set(picked.map((x) => x.slot))
    const slot = [0, 1, 2, 3, 4].find((s) => !used.has(s))!
    onChange([...picked, { nick, slot }])
  }
  const remove = (nick: string) =>
    onChange(picked.filter((x) => x.nick !== nick))

  // Mejor valor de cada métrica (puede haber empate).
  const best = METRICS.map((m) => {
    const vs = players.map(m.value)
    return m.lower ? Math.min(...vs) : Math.max(...vs)
  })

  return (
    <div className={cn("flex flex-col gap-5", SERIES)}>
      <div className="flex flex-wrap items-center gap-2">
        {players.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-2 rounded-full border py-1 pr-1 pl-2.5 text-sm"
          >
            <span
              className="size-2.5 rounded-full"
              style={{ background: color(p.slot) }}
            />
            <LevelBadge level={p.level} size={20} />
            {p.nick}
            <button
              type="button"
              aria-label={`Sacar a ${p.nick}`}
              className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => remove(p.nick)}
            >
              <XIcon className="size-3.5" />
            </button>
          </span>
        ))}
        <AddPlayer
          taken={picked.map((x) => x.nick)}
          onAdd={add}
          disabled={players.length >= VIP_MAX}
        />
        <span className="text-xs text-muted-foreground">
          {players.length} de {limit}
          {!vip && (
            <>
              {" "}
              ·{" "}
              <CrownIcon
                aria-hidden
                className="inline size-3 text-amber-400"
              />{" "}
              con VIP, hasta {VIP_MAX}
            </>
          )}
        </span>
      </div>
      {over && (
        <p className="rounded-lg border border-amber-500/50 px-3 py-2 text-sm">
          El link trae {picked.length} jugadores, pero sin VIP se comparan los
          primeros {FREE_MAX}.
        </p>
      )}

      {players.length < 2 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Agregá al menos 2 jugadores para comparar.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-[0.4px] text-muted-foreground uppercase">
                    Métrica
                  </th>
                  {players.map((p) => (
                    <th key={p.id} className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: color(p.slot) }}
                        />
                        {p.nick}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m, k) => {
                  const top = Math.max(...players.map(m.value))
                  return (
                    <tr key={m.label} className="border-b last:border-0">
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {m.label}
                      </td>
                      {players.map((p) => {
                        const v = m.value(p)
                        const win = v === best[k]
                        return (
                          <td key={p.id} className="px-4 py-2.5 text-right">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 font-mono tabular-nums",
                                win && "font-semibold"
                              )}
                            >
                              {win && (
                                <TrophyIcon
                                  aria-label="Mejor"
                                  className="size-3 text-amber-500"
                                />
                              )}
                              {m.show(v)}
                            </span>
                            <span
                              className="mt-1 ml-auto block h-1 rounded-full bg-muted"
                              aria-hidden
                            >
                              <span
                                className="block h-1 rounded-full"
                                style={{
                                  width: `${top ? (v / top) * 100 : 0}%`,
                                  background: color(p.slot),
                                }}
                              />
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                <tr>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    Mejor en
                  </td>
                  {players.map((p) => (
                    <td
                      key={p.id}
                      className="px-4 py-2.5 text-right font-mono font-semibold"
                    >
                      {METRICS.filter((m, k) => m.value(p) === best[k]).length}{" "}
                      de {METRICS.length}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <section className="flex flex-col gap-2 rounded-xl border p-4">
            <h2 className="font-heading text-base font-semibold">
              ELO en los últimos 30 mixes
            </h2>
            <EloChart players={players} />
          </section>
        </>
      )}
    </div>
  )
}
