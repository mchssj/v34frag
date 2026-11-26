import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { ChevronsUpDownIcon, CrownIcon, PlusIcon, XIcon } from "lucide-react"
import { BackButton } from "@/components/brand/BackButton"
import { useState } from "react"

import { isApiError } from "@/api/errors"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { QueryErrorMessage } from "@/components/brand/QueryState"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { myProfileOptions } from "@/features/profile/api/queries"
import { PlayerPicker } from "@/features/search/components/fields"
import { useVip } from "@/features/vip/useVip"
import { VipDialog } from "@/features/vip/VipDialog"
import { barPct, bestOf, compareWinner, fmt2 } from "../lib/labels"
import { compareOptions } from "../api/queries"
import type {
  Compare as CompareData,
  ComparePlayer,
  CompareTogether,
} from "../types"
import {
  COMPARE_SLOTS,
  type CompareSearch,
  type CompareSlot,
} from "../lib/search"

// Comparador (/players/compare, handoff_ranking sección 6). A por defecto es el usuario logueado. Dos jugadores para
// todos, hasta cinco con VIP (bitácora 2026-11-24-comparador-y-favoritas-vip, prototipo de Kyan).

const FREE_MAX = 2
const EXTRA_SLOTS = COMPARE_SLOTS.slice(FREE_MAX)

// Los dos primeros colores son los de siempre; los otros tres se distinguen de ellos también con daltonismo.
const SERIES =
  "[--s2:#2a78d6] [--s3:#1baf7a] [--s4:#6250d6] dark:[--s2:#3987e5] dark:[--s3:#199e70] dark:[--s4:#9085e9]"
const COLOR: Record<CompareSlot, string> = {
  a: "var(--primary)",
  b: "var(--chart-2)",
  c: "var(--s2)",
  d: "var(--s3)",
  e: "var(--s4)",
}

/** Un jugador comparado: su letra (el color) y, desde el segundo, sus mixes con A. */
type Entry = {
  slot: CompareSlot
  p: ComparePlayer
  together: CompareTogether | null
}

export function Compare({
  search,
  onChange,
}: {
  search: CompareSearch
  onChange: (patch: CompareSearch) => void
}) {
  const myNick = useQuery(myProfileOptions).data?.player?.nick
  const { vip, ready } = useVip()
  const a = search.a ?? myNick
  const b = search.b

  // Sin repetidos: un link con el mismo jugador dos veces se compara una.
  const seen = new Set<string>()
  const picked = COMPARE_SLOTS.map((slot) => ({
    slot,
    nick: slot === "a" ? a : search[slot],
  })).filter((x): x is { slot: CompareSlot; nick: string } => {
    const k = x.nick?.toLowerCase()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
  const extras = picked.filter((x) => EXTRA_SLOTS.includes(x.slot as never))
  const shown = vip
    ? picked
    : picked.filter((x) => x.slot === "a" || x.slot === "b")
  const taken = picked.map((x) => x.nick)

  return (
    <section className={cn("flex flex-col gap-5", SERIES)}>
      <BackButton
        fallback={{ to: "/ranking" }}
        label="Ranking"
        className="inline-flex w-fit items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
        iconClassName="size-3.5"
      />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-[200px] flex-1 text-2xl font-semibold tracking-[-0.4px]">
          Comparar jugadores
        </h1>
        <PlayerCombobox
          label="Jugador A"
          value={a}
          taken={taken}
          onSelect={(nick) => onChange({ ...search, a: nick })}
        />
        <span className="text-[13px] text-muted-foreground">vs</span>
        <PlayerCombobox
          label="Jugador B"
          value={b}
          taken={taken}
          onSelect={(nick) => onChange({ ...search, b: nick })}
        />
      </div>
      {ready && !vip && extras.length > 0 && (
        <p className="rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-3 py-2 text-[13px]">
          El link trae {picked.length} jugadores. Sin VIP se comparan los dos
          primeros.
        </p>
      )}
      {a && b ? (
        // Con más de dos en el link se espera a saber si es VIP.
        extras.length > 0 && !ready ? (
          <CompareSkeleton />
        ) : (
          <CompareBody
            picked={shown}
            vip={vip}
            taken={taken}
            onAdd={(nick) => {
              const free = EXTRA_SLOTS.find((s) => !search[s])
              if (free) onChange({ ...search, [free]: nick })
            }}
            onRemove={(slot) => onChange({ ...search, [slot]: undefined })}
          />
        )
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
  taken,
  onSelect,
}: {
  label: string
  value: string | undefined
  /** Los que ya se comparan: no se puede elegir el mismo (la API da 400). */
  taken: string[]
  onSelect: (nick: string) => void
}) {
  const [open, setOpen] = useState(false)
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
        <PlayerPicker
          taken={taken}
          onPick={(nick) => {
            onSelect(nick)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function CompareSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-[90px] rounded-xl" />
        <Skeleton className="h-[90px] rounded-xl" />
      </div>
      <Skeleton className="h-[320px] rounded-xl" />
    </div>
  )
}

type EditProps = {
  vip: boolean
  taken: string[]
  onAdd: (nick: string) => void
  onRemove: (slot: CompareSlot) => void
}

function CompareBody({
  picked,
  ...edit
}: { picked: { slot: CompareSlot; nick: string }[] } & EditProps) {
  const q = useQuery(compareOptions(picked.map((x) => x.nick)))
  if (q.isPending) return <CompareSkeleton />
  if (q.isError)
    return (
      <div className="rounded-xl border px-4 py-10 text-center">
        <QueryErrorMessage
          error={q.error}
          onRetry={q.refetch}
          message={
            isApiError(q.error, "NOT_FOUND")
              ? "Ese jugador no existe."
              : undefined
          }
        />
      </div>
    )
  return <CompareView data={q.data} picked={picked} {...edit} />
}

const int = (v: number | null) => (v === null ? "—" : String(Math.round(v)))

const ROWS: {
  label: string
  value: (p: ComparePlayer) => number | null
  show: (v: number | null) => string
}[] = [
  { label: "ELO", value: (p) => p.elo, show: int },
  { label: "Rating", value: (p) => p.rating, show: fmt2 },
  { label: "K/D", value: (p) => p.kd, show: fmt2 },
  { label: "HS %", value: (p) => p.hs, show: int },
  { label: "ADR", value: (p) => p.adr, show: int },
  { label: "% Victorias", value: (p) => p.win_rate, show: int },
  { label: "Mixes", value: (p) => p.elo_matches, show: (v) => String(v ?? 0) },
]

export function CompareView({
  data,
  picked,
  vip,
  taken,
  onAdd,
  onRemove,
}: {
  data: CompareData
  picked: { slot: CompareSlot; nick: string }[]
} & EditProps) {
  const players = [
    { p: data.a, together: null },
    { p: data.b, together: data.together },
    ...data.others.map((o) => ({ p: o.player, together: o.together })),
  ]
  // La letra va por el nick: mientras llega la comparación nueva se ve la anterior, con otros jugadores. Un link puede
  // traer el id en lugar del nick; ahí va por el orden.
  const entries: Entry[] = players.map((x, i) => ({
    ...x,
    slot:
      picked.find(
        (k) => k.nick.toLowerCase() === x.p.player.alias.toLowerCase()
      )?.slot ??
      COMPARE_SLOTS[i] ??
      "a",
  }))
  const [first, second] = entries as [Entry, Entry]
  const multi = entries.length > 2

  return (
    <>
      <div
        className={cn(
          "grid gap-4 md:grid-cols-2",
          (multi || vip) && "xl:grid-cols-3"
        )}
      >
        {entries.map((e) => (
          <Head
            key={e.p.player.id}
            e={e}
            onRemove={
              e.slot === "a" || e.slot === "b"
                ? undefined
                : () => onRemove(e.slot)
            }
          />
        ))}
        {entries.length < COMPARE_SLOTS.length && (
          <AddCard vip={vip} taken={taken} onAdd={onAdd} />
        )}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card
          variant="outline"
          className="overflow-x-auto px-5 py-2 shadow-[0_1px_2px_rgb(0_0_0/.04)] max-sm:px-3.5"
        >
          {multi ? (
            <MultiRows entries={entries} />
          ) : (
            <TwoRows a={first.p} b={second.p} />
          )}
        </Card>
        <Card
          variant="outline"
          className="flex flex-col gap-3 px-5 py-4 shadow-[0_1px_2px_rgb(0_0_0/.04)]"
        >
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs">
            <span
              className={cn(
                "flex-1 text-sm font-semibold",
                multi && "basis-full"
              )}
            >
              ELO en los últimos 30 mixes
            </span>
            {entries.map((e) => (
              <Key key={e.p.player.id} e={e} />
            ))}
          </div>
          <EloCompareChart entries={entries} />
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            {entries.slice(1).map(
              (e) =>
                e.together && (
                  <div key={e.p.player.id} className="flex flex-col gap-0.5">
                    {multi && (
                      <span className="font-medium text-foreground">
                        Con {e.p.player.alias}
                      </span>
                    )}
                    <span>
                      Mixes jugados juntos:{" "}
                      <b className="text-foreground">
                        {e.together.same_team.matches}
                      </b>{" "}
                      · ganaron{" "}
                      <b className="text-foreground">
                        {e.together.same_team.wins}
                      </b>
                    </span>
                    <span>
                      Como rivales:{" "}
                      <b className="text-foreground">
                        {e.together.against.matches}
                      </b>{" "}
                      · {first.p.player.alias} ganó{" "}
                      <b className="text-foreground">
                        {e.together.against.a_wins}
                      </b>
                    </span>
                  </div>
                )
            )}
          </div>
        </Card>
      </div>
    </>
  )
}

/** Con dos jugadores: las filas de dos lados. */
function TwoRows({ a, b }: { a: ComparePlayer; b: ComparePlayer }) {
  return (
    <>
      {ROWS.map((r) => {
        const va = r.value(a)
        const vb = r.value(b)
        const w = compareWinner(va, vb)
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
                className={cn(
                  "h-full",
                  w === "a" ? "bg-primary" : "bg-chart-3"
                )}
                style={{ width: `${barPct(va, vb)}%` }}
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
                style={{ width: `${barPct(vb, va)}%` }}
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

/** Con tres a cinco: una columna por jugador; el mejor de cada fila, en su color. */
function MultiRows({ entries }: { entries: Entry[] }) {
  const cols = {
    gridTemplateColumns: `76px repeat(${entries.length}, minmax(58px, 1fr))`,
  }
  return (
    <div role="table" aria-label="Stats comparadas">
      <div
        role="row"
        className="grid items-center gap-2.5 border-b py-2.5 text-xs"
        style={cols}
      >
        <span role="columnheader" className="sr-only">
          Stat
        </span>
        <span aria-hidden />
        {entries.map((e) => (
          <span
            key={e.p.player.id}
            role="columnheader"
            className="flex min-w-0 items-center gap-1.5 font-semibold"
          >
            <span
              aria-hidden
              className="h-[3px] w-2.5 shrink-0 rounded-full"
              style={{ background: COLOR[e.slot] }}
            />
            <span className="truncate">{e.p.player.alias}</span>
          </span>
        ))}
      </div>
      {ROWS.map((r) => {
        const best = bestOf(entries.map((e) => r.value(e.p)))
        return (
          <div
            key={r.label}
            role="row"
            className="grid items-center gap-2.5 border-b py-2.5 text-[13px] last:border-b-0"
            style={cols}
          >
            <span role="rowheader" className="text-xs text-muted-foreground">
              {r.label}
            </span>
            {entries.map((e) => {
              const v = r.value(e.p)
              const win = v !== null && v === best
              return (
                <span
                  key={e.p.player.id}
                  role="cell"
                  className="flex min-w-0 flex-col gap-1.5"
                >
                  <span
                    className={cn(
                      "font-mono text-sm font-semibold tabular-nums",
                      win ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {r.show(v)}
                  </span>
                  <span
                    aria-hidden
                    className="flex h-1.5 overflow-hidden rounded-full bg-muted"
                  >
                    <span
                      className={cn("h-full", !win && "bg-muted-foreground/40")}
                      style={{
                        width: `${barPct(v, best)}%`,
                        background: win ? COLOR[e.slot] : undefined,
                      }}
                    />
                  </span>
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function Key({ e }: { e: Entry }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="h-[3px] w-2.5 rounded-full"
        style={{ background: COLOR[e.slot] }}
      />
      {e.p.player.alias}
    </span>
  )
}

function Head({ e, onRemove }: { e: Entry; onRemove?: () => void }) {
  const p = e.p
  const sub = [p.teams[0]?.name ?? "Libre", p.game_role]
    .filter(Boolean)
    .join(" · ")
  return (
    <Card
      variant="outline"
      className="relative flex min-w-0 items-center gap-3.5 overflow-visible p-[18px] transition-colors hover:bg-muted"
      style={{ boxShadow: `inset 0 3px 0 ${COLOR[e.slot]}` }}
    >
      <PlayerAvatar
        size="row"
        alias={p.player.alias}
        playerId={p.player.id}
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
      {onRemove && (
        <button
          type="button"
          aria-label={`Quitar a ${p.player.alias}`}
          onClick={onRemove}
          className="absolute -top-2 -right-2 z-10 rounded-full border bg-card p-1 text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon aria-hidden className="size-3.5" />
        </button>
      )}
    </Card>
  )
}

/** Tarjeta punteada para sumar otro jugador. Sin VIP abre "Cómo ser VIP". */
function AddCard({ vip, taken, onAdd }: Omit<EditProps, "onRemove">) {
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState(false)
  const className =
    "flex min-h-[90px] items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
  if (!vip)
    return (
      <>
        <button
          type="button"
          className={className}
          onClick={() => setDialog(true)}
        >
          <CrownIcon
            aria-hidden
            className="size-4 text-yellow-600 dark:text-yellow-300"
          />
          Con VIP comparas hasta {COMPARE_SLOTS.length} jugadores
        </button>
        <VipDialog open={dialog} onOpenChange={setDialog} />
      </>
    )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={className}>
          <PlusIcon aria-hidden className="size-4" />
          Agregar jugador
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <PlayerPicker
          taken={taken}
          onPick={(nick) => {
            onAdd(nick)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

const W = 440
const H = 200
const PAD = { l: 40, r: 8, t: 10, b: 22 }

const list = new Intl.ListFormat("es", { type: "conjunction" })

/** Una línea por jugador con una escala común, tres valores en el eje Y y el punto final de cada una. */
function EloCompareChart({ entries }: { entries: Entry[] }) {
  const all = entries.flatMap((e) => e.p.elo_history)
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
  const n = Math.max(...entries.map((e) => e.p.elo_history.length), 2)
  const x = (i: number, len: number) =>
    PAD.l + ((n - len + i) / (n - 1)) * (W - PAD.l - PAD.r)
  const ticks = [lo, Math.round((lo + hi) / 2), hi]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`ELO de ${list.format(entries.map((e) => e.p.player.alias))} en los últimos mixes`}
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
      {/* A se dibuja al final, para que quede arriba. */}
      {entries
        .filter((e) => e.p.elo_history.length > 0)
        .reverse()
        .map((e) => {
          const h = e.p.elo_history
          const main = e.slot === "a"
          return (
            <g key={e.p.player.id}>
              <polyline
                points={h
                  .map(
                    (v, i) => `${x(i, h.length).toFixed(1)},${y(v).toFixed(1)}`
                  )
                  .join(" ")}
                fill="none"
                strokeWidth={main ? 2.5 : 2}
                strokeLinejoin="round"
                style={{ stroke: COLOR[e.slot] }}
              />
              <circle
                cx={x(h.length - 1, h.length)}
                cy={y(h[h.length - 1])}
                r={main ? 3.5 : 3}
                style={{ fill: COLOR[e.slot] }}
              />
            </g>
          )
        })}
    </svg>
  )
}
