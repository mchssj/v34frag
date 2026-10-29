import { cn } from "cn"
import { CrownIcon, PlusIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { LevelBadge } from "@/components/brand/LevelBadge"
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
import { barPct } from "@/features/ranking/labels"
import { PlayerAvatar } from "@/features/ranking/parts"

import { byNick, COMPARE_PLAYERS, together, type ComparePlayer } from "./demo"

// Comparador de hasta 5 jugadores para VIP (docs/bitacora/2026-10-29-comparador-5 en kyan/pruebas). Es el
// mismo de /players/compare (features/ranking/Compare.tsx): tarjetas arriba, stats y gráfico de ELO, con
// tarjetas de jugador que se suman y se sacan. Con 2 jugadores se ve igual que el actual.

export const FREE_MAX = 2
export const VIP_MAX = 5

// Los dos primeros son los del comparador actual (primary y chart-2). Los otros tres salen de la paleta
// categórica de dataviz, elegidos para que con los dos primeros se distingan también con daltonismo
// (validado en claro y en oscuro). El gris no tiene color: lo compensan el nick en la leyenda y la tarjeta.
const SERIES =
  "[--s2:#2a78d6] [--s3:#1baf7a] [--s4:#6250d6] dark:[--s2:#3987e5] dark:[--s3:#199e70] dark:[--s4:#9085e9]"
const COLORS = [
  "var(--primary)",
  "var(--chart-2)",
  "var(--s2)",
  "var(--s3)",
  "var(--s4)",
]
const color = (slot: number) => COLORS[slot]!

const card = "rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]"

interface Row {
  label: string
  value: (p: ComparePlayer) => number
  show: (v: number) => string
}

// Las mismas filas y formatos que CompareView.
const ROWS: Row[] = [
  { label: "ELO", value: (p) => p.elo, show: String },
  { label: "Rating", value: (p) => p.rating, show: (v) => v.toFixed(2) },
  { label: "K/D", value: (p) => p.kd, show: (v) => v.toFixed(2) },
  { label: "HS %", value: (p) => p.hs, show: (v) => String(Math.round(v)) },
  { label: "ADR", value: (p) => p.adr, show: (v) => String(Math.round(v)) },
  {
    label: "% Victorias",
    value: (p) => p.winrate,
    show: (v) => String(Math.round(v)),
  },
  { label: "Mixes", value: (p) => p.matches, show: String },
]

export interface Picked {
  nick: string
  slot: number
}
type Player = ComparePlayer & { slot: number }

function Key({ slot, label }: { slot: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="h-[3px] w-2.5 rounded-full"
        style={{ background: color(slot) }}
      />
      {label}
    </span>
  )
}

/** La tarjeta del comparador actual (Head), con la X para sacar al jugador. */
function Head({ p, onRemove }: { p: Player; onRemove?: () => void }) {
  return (
    <div
      className="relative flex min-w-0 items-center gap-3.5 rounded-xl border bg-card p-[18px] transition-colors hover:bg-muted"
      style={{ boxShadow: `inset 0 3px 0 ${color(p.slot)}` }}
    >
      <PlayerAvatar
        alias={p.nick}
        photo={null}
        className="size-[52px] [&_[data-slot=avatar-fallback]]:text-xl"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-lg font-semibold">{p.nick}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          {p.team_tag ?? "Libre"}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <LevelBadge level={p.level} size={30} />
        <span className="font-mono text-[13px] font-semibold tabular-nums">
          {p.elo}
        </span>
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Sacar a ${p.nick}`}
          onClick={onRemove}
          className="absolute -top-2 -right-2 z-10 rounded-full border bg-card p-1 text-muted-foreground shadow-sm hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/** Tarjeta punteada para sumar otro jugador. */
function AddCard({
  taken,
  onAdd,
  vip,
  count,
}: {
  taken: string[]
  onAdd: (nick: string) => void
  vip: boolean
  count: number
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const list = COMPARE_PLAYERS.filter((p) =>
    p.nick.toLowerCase().includes(q.trim().toLowerCase())
  ).slice(0, 30)
  const locked = !vip && count >= FREE_MAX
  return (
    <Popover
      open={open}
      onOpenChange={(o) =>
        locked
          ? toast.error(
              `Sin VIP comparás hasta ${FREE_MAX}. Con VIP, hasta ${VIP_MAX}.`
            )
          : setOpen(o)
      }
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          className="flex min-h-[90px] items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {locked ? (
            <CrownIcon aria-hidden className="size-4 text-amber-400" />
          ) : (
            <PlusIcon aria-hidden className="size-4" />
          )}
          {locked ? `Con VIP, hasta ${VIP_MAX} jugadores` : "Agregar jugador"}
        </button>
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
                <PlayerAvatar alias={p.nick} photo={null} className="size-6" />
                <span className="flex-1 truncate">{p.nick}</span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
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

/** Con 2 jugadores: las filas de dos lados del comparador actual. */
function TwoSided({ a, b }: { a: Player; b: Player }) {
  return (
    <>
      {ROWS.map((r) => {
        const va = r.value(a)
        const vb = r.value(b)
        const w = va >= vb ? "a" : "b"
        return (
          <div
            key={r.label}
            className="grid grid-cols-[56px_1fr_84px_1fr_56px] items-center gap-2.5 border-b py-2.5 text-[13px] last:border-b-0 max-sm:grid-cols-[44px_1fr_64px_1fr_44px] max-sm:gap-1.5"
          >
            <span
              className={cn(
                "font-mono text-sm font-semibold tabular-nums",
                w === "a" ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {r.show(va)}
            </span>
            <span className="flex h-1.5 justify-end overflow-hidden rounded-full bg-muted">
              <span
                className={cn("h-full", w !== "a" && "bg-chart-3")}
                style={{
                  width: `${barPct(va, vb)}%`,
                  background: w === "a" ? color(a.slot) : undefined,
                }}
              />
            </span>
            <span className="text-center text-xs text-muted-foreground">
              {r.label}
            </span>
            <span className="flex h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className={cn("h-full", w !== "b" && "bg-chart-4")}
                style={{
                  width: `${barPct(vb, va)}%`,
                  background: w === "b" ? color(b.slot) : undefined,
                }}
              />
            </span>
            <span
              className={cn(
                "text-right font-mono text-sm font-semibold tabular-nums",
                w === "b" ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {r.show(vb)}
            </span>
          </div>
        )
      })}
    </>
  )
}

/** Con 3 a 5: una fila por métrica y una columna por jugador; el mejor se ve en blanco y con su color. */
function Multi({ players }: { players: Player[] }) {
  const cols = {
    gridTemplateColumns: `84px repeat(${players.length}, minmax(0, 1fr))`,
  }
  return (
    <>
      <div
        className="grid items-center gap-2.5 border-b py-2.5 text-xs max-sm:gap-1.5"
        style={cols}
      >
        <span />
        {players.map((p) => (
          <span
            key={p.id}
            className="flex min-w-0 items-center gap-1.5 font-semibold"
          >
            <span
              aria-hidden
              className="h-[3px] w-2.5 shrink-0 rounded-full"
              style={{ background: color(p.slot) }}
            />
            <span className="truncate">{p.nick}</span>
          </span>
        ))}
      </div>
      {ROWS.map((r) => {
        const vs = players.map(r.value)
        const max = Math.max(...vs)
        return (
          <div
            key={r.label}
            className="grid items-center gap-2.5 border-b py-2.5 text-[13px] last:border-b-0 max-sm:gap-1.5"
            style={cols}
          >
            <span className="text-xs text-muted-foreground">{r.label}</span>
            {players.map((p, i) => {
              const v = vs[i]!
              const win = v === max
              return (
                <span key={p.id} className="flex min-w-0 flex-col gap-1.5">
                  <span
                    className={cn(
                      "font-mono text-sm font-semibold tabular-nums",
                      win ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {r.show(v)}
                  </span>
                  <span className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className={cn("h-full", !win && "bg-chart-4")}
                      style={{
                        width: `${max > 0 ? Math.round((v / max) * 100) : 0}%`,
                        background: win ? color(p.slot) : undefined,
                      }}
                    />
                  </span>
                </span>
              )
            })}
          </div>
        )
      })}
    </>
  )
}

const W = 440
const H = 200
const PAD = { l: 40, r: 8, t: 10, b: 22 }

/** EloCompareChart con N líneas: misma escala, tres valores en el eje Y y el punto final de cada una. */
function EloChart({ players }: { players: Player[] }) {
  const all = players.flatMap((p) => p.history)
  const lo = Math.floor(Math.min(...all) / 50) * 50
  const hi = Math.max(lo + 50, Math.ceil(Math.max(...all) / 50) * 50)
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b)
  const n = Math.max(...players.map((p) => p.history.length), 2)
  const x = (i: number, len: number) =>
    PAD.l + ((n - len + i) / (n - 1)) * (W - PAD.l - PAD.r)
  const ticks = [lo, Math.round((lo + hi) / 2), hi]
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`ELO de ${players.map((p) => p.nick).join(", ")} en los últimos mixes`}
      className="block h-auto w-full"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(t)}
            y2={y(t)}
            className="stroke-border"
            strokeDasharray="3 4"
          />
          <text
            x={PAD.l - 6}
            y={y(t) + 4}
            textAnchor="end"
            fontSize="10"
            className="fill-muted-foreground font-mono"
          >
            {t}
          </text>
        </g>
      ))}
      <text x={PAD.l} y={H - 6} fontSize="10" className="fill-muted-foreground">
        hace {n} mixes
      </text>
      <text
        x={W - PAD.r}
        y={H - 6}
        textAnchor="end"
        fontSize="10"
        className="fill-muted-foreground"
      >
        último
      </text>
      {/* El primero se dibuja último, para que quede arriba como en el comparador actual. */}
      {[...players].reverse().map((p) => {
        const h = p.history
        const first = p.slot === players[0]!.slot
        return (
          <g key={p.id}>
            <polyline
              points={h
                .map(
                  (v, i) => `${x(i, h.length).toFixed(1)},${y(v).toFixed(1)}`
                )
                .join(" ")}
              fill="none"
              strokeWidth={first ? 2.5 : 2}
              strokeLinejoin="round"
              stroke={color(p.slot)}
            />
            <circle
              cx={x(h.length - 1, h.length)}
              cy={y(h.at(-1)!)}
              r={first ? 3.5 : 3}
              fill={color(p.slot)}
            />
          </g>
        )
      })}
    </svg>
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
  const players: Player[] = picked
    .map((x) => ({ p: byNick(x.nick), slot: x.slot }))
    .filter((x): x is { p: ComparePlayer; slot: number } => !!x.p)
    .map((x) => ({ ...x.p, slot: x.slot }))
    .slice(0, limit)
  const over = picked.length > limit

  const add = (nick: string) => {
    // El color libre más bajo: los que ya están no cambian de color.
    const used = new Set(picked.map((x) => x.slot))
    const slot = [0, 1, 2, 3, 4].find((s) => !used.has(s))!
    onChange([...picked, { nick, slot }])
  }
  const remove = (nick: string) =>
    onChange(picked.filter((x) => x.nick !== nick))
  const first = players[0]

  return (
    <div className={cn("flex flex-col gap-4", SERIES)}>
      {over && (
        <p className="rounded-lg border border-amber-500/50 px-3 py-2 text-sm">
          El link trae {picked.length} jugadores, pero sin VIP se comparan los
          primeros {FREE_MAX}.
        </p>
      )}
      <div
        className={cn(
          "grid gap-4 md:grid-cols-2",
          players.length >= 2 && "xl:grid-cols-3"
        )}
      >
        {players.map((p) => (
          <Head key={p.id} p={p} onRemove={() => remove(p.nick)} />
        ))}
        {players.length < VIP_MAX && (
          <AddCard
            taken={picked.map((x) => x.nick)}
            onAdd={add}
            vip={vip}
            count={players.length}
          />
        )}
      </div>

      {players.length < 2 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {first
            ? `Elige un jugador para comparar con ${first.nick}.`
            : "Elige dos jugadores para comparar."}
        </p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className={cn(card, "px-5 py-2 max-sm:px-3.5")}>
            {players.length === 2 ? (
              <TwoSided a={players[0]!} b={players[1]!} />
            ) : (
              <Multi players={players} />
            )}
          </div>
          <div className={cn(card, "flex flex-col gap-3 px-5 py-4")}>
            <div className="flex flex-wrap items-center gap-3.5 text-xs">
              <span
                className={cn(
                  "flex-1 text-sm font-semibold",
                  players.length > 2 && "basis-full"
                )}
              >
                ELO en los últimos 30 mixes
              </span>
              {players.map((p) => (
                <Key key={p.id} slot={p.slot} label={p.nick} />
              ))}
            </div>
            <EloChart players={players} />
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              {players.slice(1).map((p) => {
                const t = together(first!.nick, p.nick)
                const prefix = players.length > 2 ? `Con ${p.nick}: ` : ""
                return (
                  <span key={p.id} className="flex flex-col gap-0.5">
                    <span>
                      {prefix}Mixes jugados juntos:{" "}
                      <b className="text-foreground">{t.same_team.matches}</b> ·
                      ganaron{" "}
                      <b className="text-foreground">{t.same_team.wins}</b>
                    </span>
                    <span>
                      {players.length > 2 && (
                        <span className="invisible">{prefix}</span>
                      )}
                      Como rivales:{" "}
                      <b className="text-foreground">{t.against.matches}</b> ·{" "}
                      {first!.nick} ganó{" "}
                      <b className="text-foreground">{t.against.a_wins}</b>
                    </span>
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
