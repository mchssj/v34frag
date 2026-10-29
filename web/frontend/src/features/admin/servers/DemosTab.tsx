import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { TriangleAlertIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ConfirmDialog, SecretDialog } from "../dialogs"
import {
  ago,
  fmtBytes,
  fmtDate,
  fmtDateTime,
  olderThan,
  type Tone,
} from "../format"
import {
  Card,
  Chip,
  Dot,
  EmptyState,
  FilterChips,
  Pager,
  QueryError,
  TableBox,
  headCell,
} from "../ui"
import {
  DEMOS_PER,
  demoSummaryOptions,
  demosOptions,
  useRetryDemo,
  useRotateWorkerToken,
  useUpdateWorker,
  workersOptions,
  type AdminDemo,
  type DemoStatus,
  type DemoWorker,
} from "./queries"

const STATUS: Record<DemoStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pendiente", tone: "neutral" },
  uploaded: { label: "Subida", tone: "win" },
  missing: { label: "Perdida", tone: "danger" },
  expired: { label: "Vencida", tone: "neutral" },
}

const KIND: Record<string, string> = {
  mix: "Mix",
  pcw: "PCW",
  official: "Torneo",
}

const HOUR = 3_600_000

export function DemosTab() {
  const summary = useQuery(demoSummaryOptions)
  const [status, setStatus] = useState<DemoStatus | undefined>(undefined)
  const [page, setPage] = useState(1)
  const list = useQuery(demosOptions(status, page))
  const retry = useRetryDemo()

  const s = summary.data
  const pick = (v: DemoStatus | undefined) => {
    setStatus(v)
    setPage(1)
  }
  const oldPending =
    !!s?.oldest_pending_at && olderThan(s.oldest_pending_at, HOUR)

  return (
    <div className="flex flex-col gap-4">
      {s && !s.worker_online && (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertDescription>
            El Worker de demos no está corriendo: las demos nuevas no se suben.
          </AlertDescription>
        </Alert>
      )}
      {s && s.missing > 0 && (
        <Alert variant="warning">
          <TriangleAlertIcon aria-hidden />
          <AlertDescription>
            {s.missing === 1 ? "1 demo perdida" : `${s.missing} demos perdidas`}
            . Puedes volver a ponerlas en la cola.
          </AlertDescription>
          {status !== "missing" && (
            <AlertAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pick("missing")}
              >
                Ver perdidas
              </Button>
            </AlertAction>
          )}
        </Alert>
      )}
      {oldPending && (
        <Alert variant="warning">
          <TriangleAlertIcon aria-hidden />
          <AlertDescription>
            Hay una demo pendiente desde {ago(s?.oldest_pending_at)}.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-label="Demos"
          className="flex min-w-0 flex-[999_1_560px] flex-col gap-3"
        >
          <FilterChips
            label="Filtrar demos"
            value={status}
            onChange={pick}
            options={[
              { value: undefined, label: "Todas" },
              { value: "pending", label: "Pendientes", count: s?.pending },
              { value: "missing", label: "Perdidas", count: s?.missing },
              { value: "expired", label: "Vencidas", count: s?.expired },
            ]}
          />
          {list.isError ? (
            <QueryError
              error={list.error}
              onRetry={() => void list.refetch()}
            />
          ) : list.isPending ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : list.data.items.length === 0 ? (
            <EmptyState>No hay demos con ese filtro.</EmptyState>
          ) : (
            <TableBox>
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={cn(headCell, "pl-4")}>
                      Partida
                    </TableHead>
                    <TableHead className={headCell}>Servidor</TableHead>
                    <TableHead className={headCell}>Estado</TableHead>
                    <TableHead className={cn(headCell, "text-right")}>
                      Tamaño
                    </TableHead>
                    <TableHead className={headCell}>Vence</TableHead>
                    <TableHead className={headCell}>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.items.map((d) => (
                    <DemoRow
                      key={d.match_id}
                      demo={d}
                      retrying={
                        retry.isPending && retry.variables === d.match_id
                      }
                      onRetry={() =>
                        retry.mutate(d.match_id, {
                          onSuccess: () =>
                            toast.success(
                              "Demo en la cola: el Worker la busca en los próximos 10 minutos."
                            ),
                          onError: (e) => toast.error(errorMessage(e)),
                        })
                      }
                    />
                  ))}
                </TableBody>
              </Table>
              <Pager
                page={page}
                total={list.data.total}
                per={DEMOS_PER}
                onPage={setPage}
              />
            </TableBox>
          )}
        </section>

        <aside
          aria-label="Worker de demos"
          className="flex min-w-0 flex-[1_1_300px] flex-col gap-3"
        >
          <Card>
            <h2 className="text-[15px] font-semibold">Espacio en R2</h2>
            <span className="font-mono text-2xl font-semibold">
              {s ? fmtBytes(s.uploaded_bytes) : "—"}
            </span>
            <span className="text-[13px] leading-relaxed text-muted-foreground">
              {s ? `${s.uploaded.toLocaleString("es")} demos subidas. ` : ""}Se
              guardan 90 días y después vencen solas.
            </span>
          </Card>
          <Workers />
        </aside>
      </div>
    </div>
  )
}

function DemoRow({
  demo: d,
  retrying,
  onRetry,
}: {
  demo: AdminDemo
  retrying: boolean
  onRetry: () => void
}) {
  const st = STATUS[d.demo_status]
  const score =
    d.score1 != null && d.score2 != null ? `${d.score1}–${d.score2}` : null
  return (
    <TableRow>
      <TableCell className="pl-4">
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">
            {KIND[d.kind] ?? d.kind} · {d.map ?? "—"}{" "}
            {score && (
              <span className="font-mono text-muted-foreground">{score}</span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {fmtDateTime(d.played_at)}
          </span>
        </span>
      </TableCell>
      <TableCell>{d.server?.name ?? "—"}</TableCell>
      <TableCell>
        <span className="flex flex-col gap-1">
          <Chip tone={st.tone}>{st.label}</Chip>
          {(d.demo_status === "missing" || d.demo_status === "pending") && (
            <span className="text-xs text-muted-foreground">
              {d.demo_attempts === 1
                ? "1 intento"
                : `${d.demo_attempts} intentos`}
            </span>
          )}
        </span>
      </TableCell>
      <TableCell className="text-right font-mono">
        {fmtBytes(d.demo_size)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {d.expires_at ? fmtDate(d.expires_at) : "—"}
      </TableCell>
      <TableCell className="pr-4 text-right whitespace-nowrap">
        {d.can_retry && (
          <Button
            variant="outline"
            size="sm"
            disabled={retrying}
            onClick={onRetry}
          >
            Reintentar
          </Button>
        )}
        {d.demo_status === "uploaded" && d.demo_url && (
          <a
            href={d.demo_url}
            className="text-[13px] text-primary hover:underline"
            rel="noreferrer"
          >
            Descargar
          </a>
        )}
      </TableCell>
    </TableRow>
  )
}

function Workers() {
  const workers = useQuery(workersOptions)
  const update = useUpdateWorker()
  const rotate = useRotateWorkerToken()
  const [confirm, setConfirm] = useState<DemoWorker | null>(null)
  const [secret, setSecret] = useState<{
    name: string
    command: string
  } | null>(null)

  return (
    <Card>
      <h2 className="text-[15px] font-semibold">Worker de demos</h2>
      {workers.isError ? (
        <QueryError
          error={workers.error}
          onRetry={() => void workers.refetch()}
        />
      ) : workers.isPending ? (
        <Skeleton className="h-12 rounded-lg" />
      ) : workers.data.items.length === 0 ? (
        <span className="text-[13px] text-muted-foreground">
          No hay Workers dados de alta.
        </span>
      ) : (
        workers.data.items.map((w) => (
          <div key={w.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <Dot tone={!w.active ? "danger" : w.online ? "win" : "warn"} />
              <span className="flex flex-col gap-0.5">
                <span className="font-mono font-medium">{w.name}</span>
                <span className="text-xs text-muted-foreground">
                  {!w.active
                    ? "Revocado"
                    : `${w.online ? "En línea" : "Sin señal"} · ${ago(w.last_seen_at)}`}
                </span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirm(w)}>
                Token nuevo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={
                  w.active ? "text-destructive hover:text-destructive" : ""
                }
                disabled={update.isPending}
                onClick={() =>
                  update.mutate(
                    { id: w.id, active: !w.active },
                    {
                      onSuccess: () =>
                        toast.success(
                          w.active ? "Worker revocado." : "Worker reactivado."
                        ),
                      onError: (e) => toast.error(errorMessage(e)),
                    }
                  )
                }
              >
                {w.active ? "Revocar" : "Reactivar"}
              </Button>
            </div>
          </div>
        ))
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Generar un token nuevo para el Worker?"
        description="El Worker deja de subir demos hasta que cargues el token nuevo en Cloudflare."
        confirmLabel="Generar token"
        typed
        pending={rotate.isPending}
        error={rotate.error}
        onConfirm={() =>
          confirm &&
          rotate.mutate(confirm.id, {
            onSuccess: (t) => {
              setSecret({ name: confirm.name, command: t.secret_command })
              setConfirm(null)
            },
          })
        }
      />
      <SecretDialog
        open={secret !== null}
        title={`Token nuevo de ${secret?.name ?? ""}`}
        intro="Cárgalo en Cloudflare con este comando."
        blocks={secret ? [{ label: "Comando", text: secret.command }] : []}
        doneLabel="Ya lo cargué"
        onDone={() => setSecret(null)}
      />
    </Card>
  )
}
