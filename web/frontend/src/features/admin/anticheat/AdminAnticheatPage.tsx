import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { errorMessage } from "@/api/errors"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
import {
  evidenceOptions,
  holdSession,
  openMixes,
  requestCapture,
  sessionsOptions,
  verifySession,
  type AcSession,
} from "@/features/anticheat/queries"
import { fmtDate } from "../format"
import {
  AdminHeader,
  Card,
  Dot,
  EmptyState,
  FilterChips,
  PanelSection,
  PickHint,
  QueryError,
  SplitLayout,
  TableBox,
  headCell,
} from "../ui"

// Hechos observados y su nivel de verificación. Nunca "limpio", "cheater" ni "culpable": concluye una persona.

const STATUS: Record<AcSession["status"], { label: string; tone: "win" | "muted" | "warn" }> = {
  open: { label: "Agente conectado", tone: "win" },
  closed: { label: "Sesión cerrada", tone: "muted" },
  lost: { label: "Agente desconectado", tone: "warn" },
}

const SIGNATURE: Record<string, string> = {
  valid: "Firma válida",
  unsigned: "Sin firma",
  invalid: "Firma inválida",
  unknown: "No verificable",
}

const INTEGRITY = {
  verified: { label: "Integridad verificada", tone: "win" },
  failed: { label: "Integridad fallida", tone: "danger" },
  incomplete: { label: "Evidencia incompleta", tone: "warn" },
} as const

function Integrity({ session }: { session: AcSession }) {
  const verify = useMutation({ mutationFn: () => verifySession(session.id) })
  const hold = useMutation({ mutationFn: (held: boolean) => holdSession(session.id, held) })
  const result = verify.data
  return (
    <PanelSection title="Integridad">
      <p className="text-xs text-muted-foreground">
        Comprueba que nada cambió desde el envío. El origen sigue sin ser
        verificable: la aplicación corre en el equipo del jugador.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={verify.isPending} onClick={() => verify.mutate()}>
          Verificar
        </Button>
        <Button variant="outline" size="sm" disabled={hold.isPending} onClick={() => hold.mutate(true)}>
          Conservar por caso abierto
        </Button>
        <Button variant="ghost" size="sm" disabled={hold.isPending} onClick={() => hold.mutate(false)}>
          Quitar
        </Button>
      </div>
      {hold.isSuccess && (
        <p className="text-xs text-muted-foreground">
          {hold.variables ? "No vence a los 30 días." : "Vence a los 30 días."}
        </p>
      )}
      {result && (
        <div className="text-sm">
          <span className="inline-flex items-center gap-2 font-medium">
            <Dot tone={INTEGRITY[result.result].tone} />
            {INTEGRITY[result.result].label} · {result.checked} entradas
          </span>
          {result.problems.length > 0 && (
            <ul className="mt-1 text-xs text-muted-foreground">
              {result.problems.map((p, i) => (
                <li key={i}>
                  {p.seq === null ? "" : `Entrada ${p.seq}: `}
                  <code>{p.problem}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {(verify.isError || hold.isError) && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(verify.error ?? hold.error)}</AlertDescription>
        </Alert>
      )}
    </PanelSection>
  )
}

export function AdminAnticheatPage() {
  const [status, setStatus] = useState<AcSession["status"] | undefined>("open")
  const [picked, setPicked] = useState<AcSession | null>(null)
  const sessions = useQuery(sessionsOptions(status))

  return (
    <div className="flex flex-col gap-4 p-4">
      <AdminHeader
        title="Anticheat"
        subtitle="Hechos observados para revisar. El origen no es verificable: la aplicación corre en el equipo del jugador."
        action={<OpenMixes />}
      />
      <FilterChips
        label="Estado"
        value={status}
        onChange={setStatus}
        options={[
          { value: "open", label: "Abiertas" },
          { value: "lost", label: "Perdidas" },
          { value: "closed", label: "Cerradas" },
          { value: undefined, label: "Todas" },
        ]}
      />
      <SplitLayout
        main={
          sessions.isError ? (
            <QueryError error={sessions.error} onRetry={() => void sessions.refetch()} />
          ) : sessions.isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : sessions.data.items.length === 0 ? (
            <EmptyState>No hay sesiones con este filtro.</EmptyState>
          ) : (
            <TableBox>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={headCell}>Jugador</TableHead>
                    <TableHead className={headCell}>Servidor</TableHead>
                    <TableHead className={headCell}>Estado</TableHead>
                    <TableHead className={headCell}>Inicio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.data.items.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      data-state={picked?.id === s.id ? "selected" : undefined}
                      onClick={() => setPicked(s)}
                    >
                      <TableCell className="font-medium">{s.nick}</TableCell>
                      <TableCell>{s.server_name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <Dot tone={STATUS[s.status].tone} />
                          {STATUS[s.status].label}
                        </span>
                      </TableCell>
                      <TableCell>{fmtDate(s.started_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableBox>
          )
        }
        asideLabel="Evidencia de la sesión"
        aside={
          picked ? (
            <Evidence session={picked} key={picked.id} />
          ) : (
            <PickHint
              title="Elige una sesión"
              text="Ver la evidencia queda registrado."
            />
          )
        }
      />
    </div>
  )
}

function Evidence({ session }: { session: AcSession }) {
  const queryClient = useQueryClient()
  const evidence = useQuery(evidenceOptions(session.id))
  const [reason, setReason] = useState("")
  const capture = useMutation({
    mutationFn: () => requestCapture(session.id, reason),
    onSuccess: () => {
      setReason("")
      void queryClient.invalidateQueries({
        queryKey: evidenceOptions(session.id).queryKey,
      })
    },
  })

  if (evidence.isError)
    return <QueryError error={evidence.error} onRetry={() => void evidence.refetch()} />
  if (evidence.isPending) return <Skeleton className="h-64 w-full" />
  const { screenshots, processes, requests } = evidence.data
  // Lo inesperado primero, sin juzgar: un dato que falta no es un indicio.
  const started = processes.filter((p) => p.kind !== "inventory")

  return (
    <Card>
      <PanelSection title={session.nick}>
        <p className="text-xs text-muted-foreground">
          SteamID {session.steam_id}
          {session.match_uid ? ` · Partida ${session.match_uid}` : ""}
        </p>
      </PanelSection>

      <Integrity session={session} />

      {session.status === "open" && (
        <PanelSection title="Pedir una captura">
          <p className="text-xs text-muted-foreground">
            El jugador ve el aviso. Solo se toma con el juego al frente.
          </p>
          <div className="flex gap-2">
            <Input
              value={reason}
              maxLength={200}
              placeholder="Motivo"
              onChange={(e) => setReason(e.target.value)}
            />
            <Button
              disabled={reason.trim().length < 3 || capture.isPending}
              onClick={() => capture.mutate()}
            >
              Pedir
            </Button>
          </div>
          {capture.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage(capture.error)}
              </AlertDescription>
            </Alert>
          )}
        </PanelSection>
      )}

      <PanelSection title={`Capturas (${screenshots.length})`}>
        {screenshots.length === 0 ? (
          <EmptyState>Sin capturas.</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {screenshots.map((s) => (
              <figure key={s.id} className="flex flex-col gap-1">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer noopener">
                    <img
                      src={s.url}
                      alt={`Captura del ${fmtDate(s.taken_at)}`}
                      className="aspect-video w-full rounded-md object-cover"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <Skeleton className="aspect-video w-full" />
                )}
                <figcaption className="text-xs text-muted-foreground">
                  {fmtDate(s.taken_at)} · {s.kind === "manual" ? "Pedida" : "Automática"}
                  <br />
                  <span className="font-mono" title={s.sha256}>
                    SHA-256 {s.sha256.slice(0, 12)}…
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </PanelSection>

      {requests.length > 0 && (
        <PanelSection title="Solicitudes">
          <ul className="text-sm">
            {requests.map((r) => (
              <li key={r.id}>
                {fmtDate(r.created_at)}: {r.reason} ({r.status})
              </li>
            ))}
          </ul>
        </PanelSection>
      )}

      <PanelSection title={`Programas abiertos o cerrados durante la sesión (${started.length})`}>
        <ProcessList items={started} />
      </PanelSection>
      <PanelSection title={`Inventario inicial (${processes.length - started.length})`}>
        <ProcessList items={processes.filter((p) => p.kind === "inventory")} />
      </PanelSection>
    </Card>
  )
}

function ProcessList({
  items,
}: {
  items: {
    kind: string
    pid: number
    name: string
    path: string | null
    sha256: string | null
    signature: string | null
    publisher: string | null
    note: string | null
    observed_at: string
  }[]
}) {
  if (items.length === 0) return <EmptyState>Sin eventos.</EmptyState>
  return (
    <ul className="flex max-h-80 flex-col gap-1 overflow-auto text-xs">
      {items.map((p, i) => (
        <li key={i} className="rounded border p-2">
          <span className="font-medium">{p.name}</span>{" "}
          <span className="text-muted-foreground">
            {p.kind === "end" ? "cerrado" : p.kind === "start" ? "abierto" : ""} PID {p.pid}
          </span>
          {p.path && <div className="truncate text-muted-foreground" title={p.path}>{p.path}</div>}
          <div className="text-muted-foreground">
            {SIGNATURE[p.signature ?? "unknown"] ?? "No verificable"}
            {p.publisher ? ` · ${p.publisher}` : ""}
            {p.note ? ` · Dato no disponible: ${p.note}` : ""}
          </div>
        </li>
      ))}
    </ul>
  )
}

function OpenMixes() {
  const open = useMutation({ mutationFn: openMixes })
  return (
    <div className="flex items-center gap-2">
      {open.data?.open_until && (
        <span className="text-xs text-muted-foreground">
          Abiertos hasta {fmtDate(open.data.open_until)}
        </span>
      )}
      <Button variant="outline" size="sm" disabled={open.isPending} onClick={() => open.mutate(60)}>
        Abrir mixes 1 hora
      </Button>
      <Button variant="ghost" size="sm" disabled={open.isPending} onClick={() => open.mutate(0)}>
        Cerrar
      </Button>
    </div>
  )
}
