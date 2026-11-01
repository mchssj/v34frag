import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { ArrowLeftIcon, ChevronsUpDownIcon } from "lucide-react"
import { useState } from "react"

import { errorMessage, isApiError, isRetryable } from "@/api/errors"
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
import { Skeleton } from "@/components/ui/skeleton"
import { myProfileOptions } from "@/features/profile/queries"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { barPct, compareWinner, fmt2 } from "./labels"
import { PlayerAvatar } from "./parts"
import {
  compareOptions,
  playerSearchOptions,
  type Compare as CompareData,
  type ComparePlayer,
} from "./queries"
import type { CompareSearch } from "./search"

// Comparador (/players/compare, handoff_ranking sección 6). A por defecto es el usuario logueado.

export function Compare({
  search,
  onChange,
}: {
  search: CompareSearch
  onChange: (patch: CompareSearch) => void
}) {
  const myNick = useQuery(myProfileOptions).data?.player?.nick
  const a = search.a ?? myNick
  const b = search.b

  return (
    <section className="flex flex-col gap-5">
      <Link
        to="/ranking"
        className="inline-flex w-fit items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden className="size-3.5" />
        Ranking
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-[200px] flex-1 text-2xl font-semibold tracking-[-0.4px]">
          Comparar jugadores
        </h1>
        <PlayerCombobox
          label="Jugador A"
          value={a}
          other={b}
          onSelect={(nick) => onChange({ a: nick, b })}
        />
        <span className="text-[13px] text-muted-foreground">vs</span>
        <PlayerCombobox
          label="Jugador B"
          value={b}
          other={a}
          onSelect={(nick) => onChange({ a: search.a, b: nick })}
        />
      </div>
      {a && b ? (
        <CompareBody a={a} b={b} />
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {a
            ? `Elige un jugador para comparar con ${a}.`
            : "Elige dos jugadores para compararlos."}
        </p>
      )}
    </section>
  )
}

function PlayerCombobox({
  label,
  value,
  other,
  onSelect,
}: {
  label: string
  value: string | undefined
  /** El jugador del otro lado: no se puede elegir el mismo (la API da 400). */
  other: string | undefined
  onSelect: (nick: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const debounced = useDebouncedValue(q.trim(), 250)
  const results = useQuery({
    ...playerSearchOptions(debounced),
    enabled: open,
  })
  const same = (n: string) => n.toLowerCase() === other?.toLowerCase()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className="h-8 w-[170px] justify-between px-2.5 text-[13px] font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ?? "Elegir jugador"}
          </span>
          <ChevronsUpDownIcon aria-hidden className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            value={q}
            onValueChange={setQ}
            placeholder="Buscar por alias"
          />
          <CommandList>
            {results.isPending ? (
              <div className="p-2">
                <Skeleton className="h-7 w-full" />
              </div>
            ) : (
              <>
                <CommandEmpty>No hay jugadores con ese alias.</CommandEmpty>
                {results.data?.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    disabled={same(p.alias)}
                    onSelect={() => {
                      onSelect(p.alias)
                      setOpen(false)
                      setQ("")
                    }}
                  >
                    <PlayerAvatar
                      alias={p.alias}
                      photo={p.photo_url}
                      className="size-6"
                    />
                    <span className="flex-1 truncate">{p.alias}</span>
                    {p.elo !== null && (
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {p.elo}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function CompareBody({ a, b }: { a: string; b: string }) {
  const q = useQuery(compareOptions(a, b))
  if (q.isPending)
    return (
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[90px] rounded-xl" />
          <Skeleton className="h-[90px] rounded-xl" />
        </div>
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    )
  if (q.isError)
    return (
      <div className="rounded-xl border px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          {isApiError(q.error, "NOT_FOUND")
            ? "Ese jugador no existe."
            : errorMessage(q.error)}
        </p>
        {isRetryable(q.error) && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void q.refetch()}
          >
            Reintentar
          </Button>
        )}
      </div>
    )
  return <CompareView data={q.data} />
}

export function CompareView({ data }: { data: CompareData }) {
  const { a, b, together } = data
  const rows: {
    label: string
    va: number | null
    vb: number | null
    show: (v: number | null) => string
  }[] = [
    {
      label: "ELO",
      va: a.elo,
      vb: b.elo,
      show: (v) => (v === null ? "—" : String(v)),
    },
    { label: "Rating", va: a.rating, vb: b.rating, show: fmt2 },
    { label: "K/D", va: a.kd, vb: b.kd, show: fmt2 },
    {
      label: "HS %",
      va: a.hs,
      vb: b.hs,
      show: (v) => (v === null ? "—" : String(Math.round(v))),
    },
    {
      label: "ADR",
      va: a.adr,
      vb: b.adr,
      show: (v) => (v === null ? "—" : String(Math.round(v))),
    },
    {
      label: "% Victorias",
      va: a.win_rate,
      vb: b.win_rate,
      show: (v) => (v === null ? "—" : String(Math.round(v))),
    },
    {
      label: "Mixes",
      va: a.elo_matches,
      vb: b.elo_matches,
      show: (v) => String(v ?? 0),
    },
  ]

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Head p={a} color="var(--primary)" />
        <Head p={b} color="var(--chart-2)" />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card px-5 py-2 shadow-[0_1px_2px_rgb(0_0_0/.04)] max-sm:px-3.5">
          {rows.map((r) => {
            const w = compareWinner(r.va, r.vb)
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
                  {r.show(r.va)}
                </span>
                <span className="flex h-1.5 justify-end overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      "h-full",
                      w === "a" ? "bg-primary" : "bg-chart-3"
                    )}
                    style={{ width: `${barPct(r.va, r.vb)}%` }}
                  />
                </span>
                <span className="text-center text-xs text-muted-foreground">
                  {r.label}
                </span>
                <span className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      "h-full",
                      w === "b" ? "bg-chart-2" : "bg-chart-4"
                    )}
                    style={{ width: `${barPct(r.vb, r.va)}%` }}
                  />
                </span>
                <span
                  className={cn(
                    "text-right font-mono text-sm font-semibold tabular-nums",
                    w === "b" ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {r.show(r.vb)}
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-4 shadow-[0_1px_2px_rgb(0_0_0/.04)]">
          <div className="flex flex-wrap items-center gap-3.5 text-xs">
            <span className="flex-1 text-sm font-semibold">
              ELO en los últimos 30 mixes
            </span>
            <Key color="bg-primary" label={a.player.alias} />
            <Key color="bg-chart-2" label={b.player.alias} />
          </div>
          <EloCompareChart a={a} b={b} />
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            <span>
              Mixes jugados juntos:{" "}
              <b className="text-foreground">{together.same_team.matches}</b> ·
              ganaron{" "}
              <b className="text-foreground">{together.same_team.wins}</b>
            </span>
            <span>
              Como rivales:{" "}
              <b className="text-foreground">{together.against.matches}</b> ·{" "}
              {a.player.alias} ganó{" "}
              <b className="text-foreground">{together.against.a_wins}</b>
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("h-[3px] w-2.5 rounded-full", color)} />
      {label}
    </span>
  )
}

function Head({ p, color }: { p: ComparePlayer; color: string }) {
  const sub = [p.teams[0]?.name ?? "Libre", p.game_role]
    .filter(Boolean)
    .join(" · ")
  return (
    <div
      className="relative flex min-w-0 items-center gap-3.5 rounded-xl border bg-card p-[18px] transition-colors hover:bg-muted"
      style={{ boxShadow: `inset 0 3px 0 ${color}` }}
    >
      <PlayerAvatar
        alias={p.player.alias}
        photo={p.player.photo_url}
        className="size-[52px] [&_[data-slot=avatar-fallback]]:text-xl"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          to="/player/$nick"
          params={{ nick: p.player.alias }}
          className="truncate text-lg font-semibold after:absolute after:inset-0"
        >
          {p.player.alias}
        </Link>
        <span className="truncate text-[13px] text-muted-foreground">
          {sub}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        {p.level !== null && <LevelBadge level={p.level} size={30} />}
        <span className="font-mono text-[13px] font-semibold tabular-nums">
          {p.elo ?? "—"}
        </span>
      </span>
    </div>
  )
}

const W = 440
const H = 200
const PAD = { l: 40, r: 8, t: 10, b: 22 }

/** Las dos líneas con una escala común, tres valores en el eje Y y el punto final de cada una. */
export function EloCompareChart({
  a,
  b,
}: {
  a: ComparePlayer
  b: ComparePlayer
}) {
  const all = [...a.elo_history, ...b.elo_history]
  if (all.length === 0)
    return (
      <p className="py-10 text-center text-[13px] text-muted-foreground">
        Todavía no jugaron mixes.
      </p>
    )
  const lo = Math.floor(Math.min(...all) / 50) * 50
  const hi = Math.max(lo + 50, Math.ceil(Math.max(...all) / 50) * 50)
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b)
  // Cada historia ocupa el final del eje: la más corta arranca más a la derecha.
  const n = Math.max(a.elo_history.length, b.elo_history.length, 2)
  const x = (i: number, len: number) =>
    PAD.l + ((n - len + i) / (n - 1)) * (W - PAD.l - PAD.r)
  const line = (h: number[]) =>
    h.map((v, i) => `${x(i, h.length).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const ticks = [lo, Math.round((lo + hi) / 2), hi]
  const end = (h: number[]) => h[h.length - 1]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`ELO de ${a.player.alias} y ${b.player.alias} en los últimos mixes`}
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
      {b.elo_history.length > 0 && (
        <>
          <polyline
            points={line(b.elo_history)}
            fill="none"
            strokeWidth="2"
            strokeLinejoin="round"
            className="stroke-chart-2"
          />
          <circle
            cx={x(b.elo_history.length - 1, b.elo_history.length)}
            cy={y(end(b.elo_history))}
            r="3"
            className="fill-chart-2"
          />
        </>
      )}
      {a.elo_history.length > 0 && (
        <>
          <polyline
            points={line(a.elo_history)}
            fill="none"
            strokeWidth="2.5"
            strokeLinejoin="round"
            className="stroke-primary"
          />
          <circle
            cx={x(a.elo_history.length - 1, a.elo_history.length)}
            cy={y(end(a.elo_history))}
            r="3.5"
            className="fill-primary"
          />
        </>
      )}
    </svg>
  )
}
