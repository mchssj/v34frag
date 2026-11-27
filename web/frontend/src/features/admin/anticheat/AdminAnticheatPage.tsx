import type { ReactNode } from "react"
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
import { fmtDate } from "@/features/admin/lib/format"
import { FilterChips } from "@/components/brand/FilterChips"
import { HEAD_CELL as headCell } from "@/components/data-table/DataTable"
import {
  AgentTab,
  FlagList,
  FlagsTab,
  HashLink,
  MachinePanel,
  OpenHashContext,
  ServersTab,
  SignaturesTab,
  severityTone,
} from "@/features/admin/anticheat/AdminAnticheatTools"
import {
  AdminHeader,
  AdminTabs,
  Dot,
  EmptyState,
  PanelSection,
  PickHint,
  QueryError,
  SplitLayout,
  TableBox,
} from "@/features/admin/components/ui"

// Hechos observados y su nivel de verificación. Nunca "limpio", "cheater" ni "culpable": concluye una persona.

const STATUS: Record<
  AcSession["status"],
  { label: string; tone: "win" | "muted" | "warn" }
> = {
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
  const hold = useMutation({
    mutationFn: (held: boolean) => holdSession(session.id, held),
  })
  const result = verify.data
  return (
    <PanelSection title="Integridad">
      <p className="text-xs text-muted-foreground">
        Comprueba que nada cambió desde el envío. El origen sigue sin ser
        verificable: la aplicación corre en el equipo del jugador.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={verify.isPending}
          onClick={() => verify.mutate()}
        >
          Verificar
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={hold.isPending}
          onClick={() => hold.mutate(true)}
        >
          Conservar por caso abierto
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={hold.isPending}
          onClick={() => hold.mutate(false)}
        >
          Quitar
        </Button>
      </div>
      {hold.isSuccess && (
        <p className="text-xs text-muted-foreground">
          {hold.variables
            ? "No vence: tampoco se borran sus capturas."
            : "Vence como las demás: las capturas a los 7 días y el resto a los 30."}
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
          <AlertDescription>
            {errorMessage(verify.error ?? hold.error)}
          </AlertDescription>
        </Alert>
      )}
    </PanelSection>
  )
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      {children}
    </div>
  )
}

type Tab = "sessions" | "flags" | "signatures" | "servers" | "agent"

export function AdminAnticheatPage() {
  const [tab, setTab] = useState<Tab>("sessions")
  const [hash, setHash] = useState<string | undefined>()
  // Un hash de la evidencia lleva a "Firmas y hashes" con la búsqueda hecha.
  const openHash = (sha: string) => {
    setHash(sha)
    setTab("signatures")
  }
  return (
    <OpenHashContext.Provider value={openHash}>
      <div className="flex flex-col gap-4 p-4">
        <AdminHeader
          title="Anticheat"
          subtitle="Hechos observados para revisar. El origen no es verificable: la aplicación corre en el equipo del jugador."
          action={<OpenMixes />}
        />
        <AdminTabs
          label="Secciones del anticheat"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "sessions", label: "Sesiones" },
            { key: "flags", label: "Marcas" },
            { key: "signatures", label: "Firmas y hashes" },
            { key: "servers", label: "Servidores" },
            { key: "agent", label: "Agente" },
          ]}
        />
        {tab === "sessions" && <Sessions />}
        {tab === "flags" && <FlagsTab />}
        {tab === "signatures" && <SignaturesTab hash={hash} />}
        {tab === "servers" && <ServersTab />}
        {tab === "agent" && <AgentTab />}
      </div>
    </OpenHashContext.Provider>
  )
}

function Sessions() {
  const [status, setStatus] = useState<AcSession["status"] | undefined>("open")
  const [picked, setPicked] = useState<AcSession | null>(null)
  const sessions = useQuery(sessionsOptions(status))

  return (
    <>
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
            <QueryError
              error={sessions.error}
              onRetry={() => void sessions.refetch()}
            />
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
                    <TableHead className={headCell}>Marcas</TableHead>
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
                      <TableCell>
                        {s.open_flags ? (
                          <span className="inline-flex items-center gap-2">
                            <Dot tone={severityTone(s.max_severity)} />
                            {s.open_flags}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
    </>
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
    return (
      <QueryError
        error={evidence.error}
        onRetry={() => void evidence.refetch()}
      />
    )
  if (evidence.isPending) return <Skeleton className="h-64 w-full" />
  const { screenshots, processes, requests } = evidence.data
  // Lo inesperado primero, sin juzgar: un dato que falta no es un indicio.
  const flags = evidence.data.flags ?? []
  const started = processes.filter((p) => p.kind === "start" || p.kind === "end")
  const modules = processes.filter((p) => p.kind === "module")
  const handles = processes.filter((p) => p.kind === "handle")
  const overlays = processes.filter((p) => p.kind === "overlay")
  const gameFiles = processes.filter((p) => p.kind === "game_file")
  // Los drivers firmados por Microsoft son cientos: se muestran solo los demás.
  const drivers = processes.filter((p) => p.kind === "driver")
  const oddDrivers = drivers.filter(
    (p) => p.signature !== "valid" || !(p.publisher ?? "").startsWith("Microsoft")
  )

  return (
    <Card>
      <PanelSection title={session.nick}>
        <p className="text-xs text-muted-foreground">
          SteamID {session.steam_id}
          {session.match_uid ? ` · Partida ${session.match_uid}` : ""}
        </p>
      </PanelSection>

      <PanelSection
        title={`Marcas (${flags.filter((f) => !f.reviewed_at).length} sin revisar)`}
      >
        <FlagList
          flags={flags}
          onReviewed={() =>
            void queryClient.invalidateQueries({
              queryKey: evidenceOptions(session.id).queryKey,
            })
          }
        />
      </PanelSection>

      <Integrity session={session} />

      <PanelSection title="Máquina">
        <MachinePanel sessionId={session.id} />
      </PanelSection>

      {session.status === "open" && (
        <PanelSection title="Pedir una captura">
          <p className="text-xs text-muted-foreground">
            El jugador no ve ningún aviso. Solo se toma con el juego al frente.
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
              <AlertDescription>{errorMessage(capture.error)}</AlertDescription>
            </Alert>
          )}
        </PanelSection>
      )}

      <PanelSection
        title={`Capturas (${screenshots.length})`}
        aside={
          <Button
            variant="ghost"
            size="sm"
            disabled={evidence.isFetching}
            onClick={() => void evidence.refetch()}
          >
            Actualizar
          </Button>
        }
      >
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
                  {fmtDate(s.taken_at)} ·{" "}
                  {s.kind === "manual" ? "Pedida" : "Automática"}
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

      <PanelSection
        title={`Programas abiertos o cerrados durante la sesión (${started.length})`}
      >
        <ProcessList items={started} />
      </PanelSection>
      <PanelSection title={`Acceso a la memoria del juego (${handles.length})`}>
        <ProcessList items={handles} />
      </PanelSection>
      <PanelSection title={`Overlays encima del juego (${overlays.length})`}>
        <ProcessList items={overlays} />
      </PanelSection>
      <PanelSection title={`Archivos del juego (${gameFiles.length})`}>
        <ProcessList items={gameFiles} />
      </PanelSection>
      <PanelSection
        title={`Drivers que no son de Microsoft (${oddDrivers.length} de ${drivers.length})`}
      >
        <ProcessList items={oddDrivers} />
      </PanelSection>
      <PanelSection title={`Módulos del juego (${modules.length})`}>
        <p className="text-xs text-muted-foreground">
          Las DLL que cargó CMLauncher.exe durante la sesión.
        </p>
        <ProcessList items={modules} />
      </PanelSection>
      <PanelSection
        title={`Inventario inicial (${processes.filter((p) => p.kind === "inventory").length})`}
      >
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
    detail?: Record<string, unknown> | null
  }[]
}) {
  if (items.length === 0) return <EmptyState>Sin eventos.</EmptyState>
  // Lo que agrega cada tipo nuevo (replanteo 156), en palabras.
  const extra = (d: Record<string, unknown> | null | undefined) => {
    if (!d) return ""
    const parts: string[] = []
    if (typeof d.access === "string") parts.push(`permisos ${d.access}`)
    if (d.parent === true) parts.push("es el programa que abrió el juego")
    if (typeof d.class === "string") parts.push(`ventana ${d.class}`)
    if (typeof d.cover === "number") parts.push(`tapa el ${Math.round(d.cover * 100)} % del juego`)
    if (typeof d.service === "string") parts.push(`servicio ${d.service}`)
    return parts.join(" · ")
  }
  return (
    <ul className="flex max-h-80 flex-col gap-1 overflow-auto text-xs">
      {items.map((p, i) => (
        <li key={i} className="rounded border p-2">
          <span className="font-medium">{p.name}</span>{" "}
          <span className="text-muted-foreground">
            {p.kind === "end" ? "cerrado" : p.kind === "start" ? "abierto" : ""}{" "}
            PID {p.pid}
          </span>
          {p.path && (
            <div className="truncate text-muted-foreground" title={p.path}>
              {p.path}
            </div>
          )}
          <div className="text-muted-foreground">
            {SIGNATURE[p.signature ?? "unknown"] ?? "No verificable"}
            {p.publisher ? ` · ${p.publisher}` : ""}
            {p.note ? ` · Dato no disponible: ${p.note}` : ""}
          </div>
          {extra(p.detail) && <div className="text-muted-foreground">{extra(p.detail)}</div>}
          {p.sha256 && <HashLink sha256={p.sha256} />}
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
      <Button
        variant="outline"
        size="sm"
        disabled={open.isPending}
        onClick={() => open.mutate(60)}
      >
        Abrir mixes 1 hora
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={open.isPending}
        onClick={() => open.mutate(0)}
      >
        Cerrar
      </Button>
    </div>
  )
}
