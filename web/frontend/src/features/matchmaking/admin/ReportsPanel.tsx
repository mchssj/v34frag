import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { REASON_TEXT, fmtDateTime } from "../labels"
import {
  adminBansOptions,
  adminReportsOptions,
  useMmAdminMutation,
} from "../queries"
import { useMmSource } from "../source"
import type { MmAdminReport, ReportStatus } from "../types"

// Administración › Matchmaking › Reportes (plan, decisión "Reportes"): resolver los reportes y
// ver o levantar las exclusiones del matchmaking.

const STATUS_TEXT: Record<ReportStatus, string> = {
  pending: "Pendiente",
  dismissed: "Descartado",
  warned: "Advertido",
  banned: "Excluido",
}

export function ReportsPanel() {
  const source = useMmSource()
  const [filter, setFilter] = useState<"pending" | "all">("pending")
  const { data } = useQuery(adminReportsOptions(source))
  const list = data?.filter((r) => filter === "all" || r.status === "pending")

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Reportes</CardTitle>
          <CardDescription>
            Los mandan los jugadores desde la sala, hasta 24 h después de la
            partida. Excluir saca al jugador solo del matchmaking.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-1">
            {(["pending", "all"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "secondary" : "ghost"}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === "pending" ? "Pendientes" : "Todos"}
              </Button>
            ))}
          </div>
          {!list && <Skeleton className="h-24 w-full" />}
          {list?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay reportes {filter === "pending" ? "pendientes" : ""}.
            </p>
          )}
          {!!list?.length && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Reportado</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Lo reportó</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r) => (
                  <ReportRow key={r.id} report={r} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <BansCard />
    </div>
  )
}

function ReportRow({ report: r }: { report: MmAdminReport }) {
  const source = useMmSource()
  const [days, setDays] = useState("3")
  const resolve = useMmAdminMutation(
    ({ action, d }: { action: "dismiss" | "warn" | "ban"; d?: number }) =>
      source.resolveReport(r.id, action, d)
  )
  const run = (action: "dismiss" | "warn" | "ban") =>
    resolve.mutate(
      { action, d: action === "ban" ? Number(days) : undefined },
      {
        onSuccess: () => toast.success(`Reporte de ${r.reported} resuelto`),
        onError: (e) => toast.error(errorMessage(e)),
      }
    )
  const validDays = Number(days) >= 1 && Number(days) <= 90

  return (
    <TableRow>
      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
        {fmtDateTime(r.created_at)}
      </TableCell>
      <TableCell className="font-medium">{r.reported}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span>{REASON_TEXT[r.reason]}</span>
          {r.note && (
            <span className="max-w-64 text-xs text-muted-foreground">
              “{r.note}”
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm">
        {r.reporter} · <span className="font-mono">{r.mode}</span>
      </TableCell>
      <TableCell>
        <span
          className={cn(
            "text-sm",
            r.status === "pending"
              ? "text-sidebar-primary"
              : "text-muted-foreground"
          )}
        >
          {STATUS_TEXT[r.status]}
        </span>
      </TableCell>
      <TableCell className="text-right">
        {r.status === "pending" ? (
          <div className="inline-flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={resolve.isPending}
              onClick={() => run("dismiss")}
            >
              Descartar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={resolve.isPending}
              onClick={() => run("warn")}
            >
              Advertir
            </Button>
            <Input
              aria-label={`Días de exclusión de ${r.reported}`}
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="h-7 w-14 font-mono"
            />
            <Button
              size="sm"
              variant="destructive"
              disabled={resolve.isPending || !validDays}
              onClick={() => run("ban")}
            >
              Excluir {days} d
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}

function BansCard() {
  const source = useMmSource()
  const { data } = useQuery(adminBansOptions(source))
  const unban = useMmAdminMutation((userId: string) => source.unban(userId))
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Excluidos del matchmaking</CardTitle>
      </CardHeader>
      <CardContent>
        {data?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nadie excluido.</p>
        )}
        <ul className="flex flex-col divide-y">
          {data?.map((b) => (
            <li
              key={b.user_id}
              className="flex items-center gap-3 py-2 text-sm"
            >
              <span className="font-medium">{b.nick}</span>
              <span className="text-muted-foreground">
                {b.reason} · hasta {fmtDateTime(b.until)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                disabled={unban.isPending}
                onClick={() => unban.mutate(b.user_id)}
              >
                Levantar
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
