import { cn } from "cn"
import { CrownIcon, LockIcon, TrophyIcon } from "lucide-react"
import { useState } from "react"

import { LevelBadge } from "@/components/brand/LevelBadge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PlayerAvatar } from "@/features/ranking/parts"

import { RANK_PLAYERS, seeded } from "./demo"

// Stats avanzadas post-torneo, primero para VIP (docs/bitacora/2026-10-29-stats-torneo en kyan/pruebas).
// Los VIP las ven apenas termina la final; el resto, 24 horas después.

export const TOURNAMENT = {
  name: "Copa CM League · Octubre",
  ended_at: "2026-10-29T02:10:00Z",
  /** Horas que los VIP las ven antes que nadie. */
  early_hours: 24,
}

const TEAMS = ["Los Pibes", "TNT", "Monkeys", "Sin Rumbo"]

export interface TourneyPlayer {
  id: string
  nick: string
  level: number
  team: string
  maps: number
  rating: number
  kd: number
  adr: number
  hs: number
  openings: number
  clutches: number
  multikills: number
}

function make(): TourneyPlayer[] {
  const r = seeded(2026)
  return RANK_PLAYERS.slice(0, 20).map((p, i) => ({
    id: p.id,
    nick: p.nick,
    level: p.level,
    team: TEAMS[i % 4]!,
    maps: 3 + Math.floor(r() * 5),
    rating: +(0.75 + r() * 0.7).toFixed(2),
    kd: +(0.6 + r() * 1).toFixed(2),
    adr: +(58 + r() * 45).toFixed(1),
    hs: +(35 + r() * 30).toFixed(1),
    openings: Math.floor(r() * 22),
    clutches: Math.floor(r() * 7),
    multikills: Math.floor(r() * 12),
  }))
}
export const TOURNEY_PLAYERS = make()

type Key =
  "rating" | "kd" | "adr" | "hs" | "openings" | "clutches" | "multikills"
const COLS: { key: Key; label: string; show: (v: number) => string }[] = [
  { key: "rating", label: "Rating", show: (v) => v.toFixed(2) },
  { key: "kd", label: "K/D", show: (v) => v.toFixed(2) },
  { key: "adr", label: "ADR", show: (v) => v.toFixed(1) },
  { key: "hs", label: "HS %", show: (v) => `${v.toFixed(1)}%` },
  { key: "openings", label: "Entradas", show: String },
  { key: "clutches", label: "Clutches", show: String },
  { key: "multikills", label: "3k+", show: String },
]
const AWARDS: { key: Key; title: string }[] = [
  { key: "adr", title: "Más daño por ronda" },
  { key: "openings", title: "Más entradas ganadas" },
  { key: "clutches", title: "Más clutches" },
  { key: "hs", title: "Mejor puntería" },
]

const best = (key: Key) =>
  [...TOURNEY_PLAYERS].sort((a, b) => b[key] - a[key])[0]!
const head = "h-auto py-2.5 text-xs font-medium text-muted-foreground"

function hoursLeft(now: number) {
  const open =
    new Date(TOURNAMENT.ended_at).getTime() + TOURNAMENT.early_hours * 3_600_000
  return Math.max(0, Math.ceil((open - now) / 3_600_000))
}

export function TournamentStats({
  vip,
  now,
}: {
  vip: boolean
  /** Momento a mirar (en la web real, Date.now() del reloj del servidor). */
  now: number
}) {
  const [sort, setSort] = useState<Key>("rating")
  const [team, setTeam] = useState<string | null>(null)
  const left = hoursLeft(now)
  const locked = !vip && left > 0
  const mvp = best("rating")
  const rows = TOURNEY_PLAYERS.filter((p) => !team || p.team === team).sort(
    (a, b) => b[sort] - a[sort]
  )

  return (
    <div className="flex flex-col gap-5">
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-sm",
          vip && left > 0 ? "border-amber-500/50 bg-amber-400/5" : "bg-muted/30"
        )}
      >
        {vip && left > 0 ? (
          <>
            <CrownIcon aria-hidden className="size-4 text-amber-400" />
            Las estás viendo antes que nadie: se publican para todos en{" "}
            <b>{left} h</b>.
          </>
        ) : locked ? (
          <>
            <LockIcon aria-hidden className="size-4 text-muted-foreground" />
            Se publican para todos en <b>{left} h</b>. Los VIP ya las pueden
            ver.
          </>
        ) : (
          "Stats finales del torneo."
        )}
      </div>

      <div className="relative flex flex-col gap-5">
        <div
          className={cn(
            "flex flex-col gap-5",
            locked && "pointer-events-none blur-[6px] select-none"
          )}
          aria-hidden={locked}
        >
          <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
            <div className="relative flex items-center gap-4 rounded-xl border border-[color-mix(in_oklch,var(--primary)_50%,var(--border))] bg-card p-[18px] shadow-[0_1px_2px_rgb(0_0_0/.04)]">
              <span className="relative">
                <PlayerAvatar
                  alias={mvp.nick}
                  photo={null}
                  className="size-[52px] [&_[data-slot=avatar-fallback]]:text-xl"
                />
                <CrownIcon
                  aria-hidden
                  className="absolute -top-3 left-1/2 size-[18px] -translate-x-1/2 fill-primary text-primary"
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xs font-semibold tracking-[0.4px] text-primary uppercase">
                  MVP del torneo
                </span>
                <span className="truncate text-lg font-semibold">
                  {mvp.nick}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {mvp.team} · {mvp.maps} mapas
                </span>
              </span>
              <span className="font-mono text-2xl font-semibold tabular-nums">
                {mvp.rating.toFixed(2)}
              </span>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {AWARDS.map((a) => {
                const p = best(a.key)
                const col = COLS.find((c) => c.key === a.key)!
                return (
                  <li
                    key={a.key}
                    className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3"
                  >
                    <TrophyIcon
                      aria-hidden
                      className="size-4 shrink-0 text-amber-500"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-xs text-muted-foreground">
                        {a.title}
                      </span>
                      <span className="truncate font-semibold">{p.nick}</span>
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      {col.show(p[a.key])}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="flex flex-wrap gap-1">
            {[null, ...TEAMS].map((t) => (
              <button
                key={t ?? "all"}
                type="button"
                aria-pressed={team === t}
                onClick={() => setTeam(t)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground",
                  team === t && "border-primary bg-primary/10 text-foreground"
                )}
              >
                {t ?? "Todos los equipos"}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]">
            <Table className="min-w-[860px] text-sm">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn(head, "pl-4")}>Jugador</TableHead>
                  <TableHead className={head}>Equipo</TableHead>
                  <TableHead className={cn(head, "text-right")}>
                    Mapas
                  </TableHead>
                  {COLS.map((c) => (
                    <TableHead
                      key={c.key}
                      className={cn(head, "text-right last:pr-4")}
                    >
                      <button
                        type="button"
                        onClick={() => setSort(c.key)}
                        aria-label={`Ordenar por ${c.label}`}
                        className={cn(
                          "hover:text-foreground",
                          sort === c.key && "text-foreground"
                        )}
                      >
                        {c.label}
                        {sort === c.key && " ↓"}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted">
                    <TableCell className="pl-4">
                      <span className="flex items-center gap-2.5">
                        <LevelBadge level={p.level} size={22} />
                        <span className="font-medium">{p.nick}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.team}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                      {p.maps}
                    </TableCell>
                    {COLS.map((c) => (
                      <TableCell
                        key={c.key}
                        className={cn(
                          "text-right font-mono tabular-nums last:pr-4",
                          sort === c.key
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {c.show(p[c.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        {locked && (
          <div className="absolute inset-0 grid place-items-start justify-center pt-16">
            <div className="flex max-w-sm flex-col items-center gap-2 rounded-xl border bg-background/95 p-5 text-center shadow-lg">
              <CrownIcon aria-hidden className="size-6 text-amber-400" />
              <p className="font-semibold">
                Los VIP las ven {TOURNAMENT.early_hours} h antes
              </p>
              <p className="text-sm text-muted-foreground">
                MVP, premios y la tabla completa de cada jugador: entradas,
                clutches y multikills.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
