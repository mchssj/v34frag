import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fmtClock } from "../labels"
import { adminStatsOptions } from "../queries"
import { useMmSource } from "../source"
import type { MmStatsDay } from "../types"

// Administración › Matchmaking › Métricas (plan, decisión "Métricas"): `mm_stats_daily` sumado por
// modo para el período elegido.

const CANCEL_TEXT: Record<string, string> = {
  no_accept: "No aceptaron",
  no_connect: "No se conectaron",
  admin: "Por un admin",
  no_server: "Sin servidor",
}

export type ModeSummary = {
  mode: string
  lobbies: number
  played: number
  cancelled: Record<string, number>
  avgWait: number
  p90Wait: number
  avgEloDiff: number
  abandons: number
}

/** Suma los días de cada modo. Los promedios se ponderan por salas jugadas. */
export function summarize(days: MmStatsDay[]): ModeSummary[] {
  const by = new Map<string, MmStatsDay[]>()
  for (const d of days) by.set(d.mode, [...(by.get(d.mode) ?? []), d])
  return [...by].map(([mode, rows]) => {
    const played = rows.reduce((s, r) => s + r.played, 0)
    const weighted = (f: (r: MmStatsDay) => number) =>
      played
        ? Math.round(rows.reduce((s, r) => s + f(r) * r.played, 0) / played)
        : 0
    const cancelled: Record<string, number> = {}
    for (const r of rows)
      for (const [k, v] of Object.entries(r.cancelled))
        cancelled[k] = (cancelled[k] ?? 0) + v
    return {
      mode,
      lobbies: rows.reduce((s, r) => s + r.lobbies, 0),
      played,
      cancelled,
      avgWait: weighted((r) => r.avg_wait_s),
      p90Wait: Math.max(...rows.map((r) => r.p90_wait_s)),
      avgEloDiff: weighted((r) => r.avg_elo_diff),
      abandons: rows.reduce((s, r) => s + r.abandons, 0),
    }
  })
}

export function StatsPanel() {
  const source = useMmSource()
  const [days, setDays] = useState(7)
  const { data } = useQuery(adminStatsOptions(source, days))
  const summary = data && summarize(data)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Métricas</CardTitle>
        <CardDescription>
          Para ajustar la ventana de ELO y los tiempos con números.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-1">
          {[7, 30].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "secondary" : "ghost"}
              aria-pressed={days === d}
              onClick={() => setDays(d)}
            >
              {d} días
            </Button>
          ))}
        </div>
        {!summary && <Skeleton className="h-40 w-full" />}
        {summary && (
          <div className="grid gap-4 lg:grid-cols-2">
            {summary.map((m) => (
              <ModeCard key={m.mode} m={m} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ModeCard({ m }: { m: ModeSummary }) {
  const cancelledTotal = Object.values(m.cancelled).reduce((s, v) => s + v, 0)
  const rate = m.lobbies ? Math.round((cancelledTotal / m.lobbies) * 100) : 0
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <h3 className="font-mono font-semibold">{m.mode}</h3>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Salas armadas" value={m.lobbies} />
        <Stat label="Jugadas" value={m.played} />
        <Stat label="Canceladas" value={`${rate} %`} />
        <Stat label="Abandonos" value={m.abandons} />
        <Stat label="Espera promedio" value={fmtClock(m.avgWait * 1000)} />
        <Stat label="Espera p90" value={fmtClock(m.p90Wait * 1000)} />
        <Stat label="Dif. de ELO" value={`±${m.avgEloDiff}`} />
      </dl>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Motivo de cancelación</TableHead>
            <TableHead className="text-right">Salas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(m.cancelled).map(([k, v]) => (
            <TableRow key={k}>
              <TableCell>{CANCEL_TEXT[k] ?? k}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {v}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
