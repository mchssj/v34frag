import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, useContext, useEffect, useState } from "react"

import { errorMessage } from "@/api/errors"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FilterChips } from "@/components/brand/FilterChips"
import { HEAD_CELL as headCell } from "@/components/data-table/DataTable"
import {
  addMachineException,
  addSignature,
  agentConfigOptions,
  banMachine,
  flagsOptions,
  hashSearch,
  liftMachineBan,
  machineOptions,
  removeSignature,
  reviewFlag,
  serverPoliciesOptions,
  setAgentConfig,
  setServerMode,
  signaturesOptions,
  type AcAgentConfig,
  type AcServerMode,
  type AcSettableMode,
  type AcEventKind,
  type AcFlag,
  type AcHashSearch,
} from "@/features/anticheat/queries"
import { fmtDate } from "@/features/admin/lib/format"
import { Dot, EmptyState, PanelSection, QueryError, TableBox } from "@/features/admin/components/ui"

// Panel del staff del anticheat (plan docs/bitacora/2026-11-27-anticheat-deteccion). Solo admins.
// Hechos observados, no conclusiones: la decisión es de una persona.

export const RULES: Record<string, string> = {
  signature: "Coincide con una trampa conocida (hash)",
  signature_name: "Coincide con una trampa conocida (nombre)",
  module_unsigned: "DLL sin firma dentro del juego",
  handle_to_game: "Un programa tiene permiso sobre la memoria del juego",
  handle_parent: "El programa que abrió el juego tiene permiso sobre su memoria",
  overlay: "Ventana transparente encima del juego",
  driver_unsigned: "Driver sin firma",
  game_file_unknown: "Archivo del juego distinto de los conocidos",
  port_mismatch: "El puerto del servidor no es el del juego en la PC del agente",
  ip_family: "El agente llegó por IPv6 y el juego por IPv4 (o al revés): no se pudo comparar la IP",
  agent_modified: "El agente no es una versión publicada",
  aim_snap: "Giros de mira anormales antes de matar",
  aim_smoke: "Muchas kills a través del humo",
  aim_headshot: "Porcentaje de headshots anormal",
}

export const KIND_LABEL: Record<AcEventKind, string> = {
  inventory: "Programa",
  start: "Programa abierto",
  end: "Programa cerrado",
  module: "DLL del juego",
  handle: "Acceso a la memoria",
  overlay: "Overlay",
  driver: "Driver",
  game_file: "Archivo del juego",
}

export function severityTone(s: number | null | undefined): "danger" | "warn" | "muted" {
  return s === 3 ? "danger" : s === 2 ? "warn" : "muted"
}

const SEVERITY = { 1: "Leve", 2: "Revisar", 3: "Grave" } as const

// ---------- marcas ----------

export function FlagList({ flags, onReviewed }: { flags: AcFlag[]; onReviewed?: () => void }) {
  if (flags.length === 0) return <EmptyState>Sin marcas.</EmptyState>
  return (
    <ul className="flex flex-col gap-2">
      {flags.map((f) => (
        <FlagRow key={f.id} flag={f} onReviewed={onReviewed} />
      ))}
    </ul>
  )
}

function FlagRow({ flag, onReviewed }: { flag: AcFlag; onReviewed?: () => void }) {
  const [note, setNote] = useState("")
  const review = useMutation({ mutationFn: () => reviewFlag(flag.id, note), onSuccess: () => onReviewed?.() })
  const d = flag.detail
  return (
    <li className="flex flex-col gap-1 rounded border p-2 text-xs">
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        <Dot tone={severityTone(flag.severity)} />
        {RULES[flag.rule] ?? flag.rule}
        <span className="text-xs font-normal text-muted-foreground">{SEVERITY[flag.severity]}</span>
      </span>
      {flag.nick && (
        <span className="text-muted-foreground">
          {flag.nick} · {flag.server_name} · {fmtDate(flag.created_at)}
        </span>
      )}
      {typeof d.name === "string" && (
        <span className="truncate font-mono" title={String(d.path ?? d.name)}>
          {String(d.name)}
          {typeof d.label === "string" ? ` · ${d.label}` : ""}
        </span>
      )}
      {typeof d.sha256 === "string" && <HashLink sha256={d.sha256} />}
      {flag.reviewed_at ? (
        <span className="text-muted-foreground">
          Revisada el {fmtDate(flag.reviewed_at)}
          {flag.review_note ? `: ${flag.review_note}` : ""}
        </span>
      ) : (
        <div className="flex gap-2">
          <Input value={note} maxLength={300} placeholder="Nota (opcional)" onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate()}>
            Revisada
          </Button>
        </div>
      )}
      {review.isError && <span className="text-destructive">{errorMessage(review.error)}</span>}
    </li>
  )
}

export function FlagsTab() {
  const [open, setOpen] = useState(true)
  const [min, setMin] = useState(2)
  const flags = useQuery(flagsOptions(open, min))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-2">
          <Switch checked={open} onCheckedChange={setOpen} /> Solo sin revisar
        </label>
        <span className="inline-flex gap-1">
          {[1, 2, 3].map((s) => (
            <Button key={s} size="sm" variant={min === s ? "default" : "outline"} onClick={() => setMin(s)}>
              {s === 1 ? "Todas" : s === 2 ? "Revisar y graves" : "Solo graves"}
            </Button>
          ))}
        </span>
      </div>
      {flags.isError ? (
        <QueryError error={flags.error} onRetry={() => void flags.refetch()} />
      ) : flags.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <FlagList flags={flags.data.items} onReviewed={() => void flags.refetch()} />
      )}
    </div>
  )
}

// ---------- buscar un hash ----------

// La página lo provee: lleva a la pestaña de firmas con el hash ya buscado.
export const OpenHashContext = createContext<(sha256: string) => void>(() => {})

export function HashLink({ sha256 }: { sha256: string }) {
  const open = useContext(OpenHashContext)
  return (
    <button
      type="button"
      className="w-fit font-mono text-muted-foreground underline-offset-2 hover:underline"
      title="Buscar este hash en todos los jugadores"
      onClick={() => open(sha256)}
    >
      SHA-256 {sha256.slice(0, 12)}…
    </button>
  )
}

export function HashSearch({ initial }: { initial?: string }) {
  const [sha, setSha] = useState(initial ?? "")
  const search = useMutation({ mutationFn: (s: string) => hashSearch(s) })
  const { mutate } = search
  useEffect(() => {
    if (initial && /^[0-9a-f]{64}$/.test(initial)) {
      mutate(initial)
    }
  }, [initial, mutate])
  const valid = /^[0-9a-f]{64}$/.test(sha.trim())
  return (
    <PanelSection title="Buscar un hash">
      <p className="text-xs text-muted-foreground">
        En qué jugadores y sesiones apareció un archivo. Si una DLL rara sale en varias cuentas, puede ser una trampa que se está pasando.
      </p>
      <div className="flex gap-2">
        <Input value={sha} placeholder="SHA-256" onChange={(e) => setSha(e.target.value.toLowerCase())} />
        <Button disabled={!valid || search.isPending} onClick={() => search.mutate(sha.trim())}>
          Buscar
        </Button>
      </div>
      {search.isError && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(search.error)}</AlertDescription>
        </Alert>
      )}
      {search.data && <HashResult r={search.data} />}
    </PanelSection>
  )
}

function HashResult({ r }: { r: AcHashSearch }) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <span className="text-sm font-medium">
        {r.players} {r.players === 1 ? "jugador" : "jugadores"}
        {r.signature ? ` · firma cargada: ${r.signature.verdict === "bad" ? "trampa" : "conocido"} (${r.signature.label})` : ""}
      </span>
      {r.items.length === 0 ? (
        <EmptyState>No apareció en ninguna sesión.</EmptyState>
      ) : (
        <ul className="flex max-h-72 flex-col gap-1 overflow-auto">
          {r.items.map((i, k) => (
            <li key={k} className="rounded border p-2">
              <span className="font-medium">{i.nick}</span> · {KIND_LABEL[i.kind] ?? i.kind} · {i.name} · {i.times}{" "}
              {i.times === 1 ? "vez" : "veces"} · {fmtDate(i.first_seen)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- firmas ----------

export function SignaturesTab({ hash }: { hash?: string }) {
  const qc = useQueryClient()
  const list = useQuery(signaturesOptions())
  const [sha, setSha] = useState("")
  const [name, setName] = useState("")
  const [label, setLabel] = useState("")
  const [kind, setKind] = useState<AcEventKind | "">("")
  const refresh = () => void qc.invalidateQueries({ queryKey: signaturesOptions().queryKey })
  const add = useMutation({
    mutationFn: (verdict: "bad" | "good") =>
      addSignature({
        ...(sha.trim() ? { sha256: sha.trim() } : {}),
        ...(name.trim() ? { name: name.trim().toLowerCase() } : {}),
        ...(kind ? { kinds: [kind] } : {}),
        verdict,
        label: label.trim(),
      }),
    onSuccess: () => {
      setSha("")
      setName("")
      setLabel("")
      refresh()
    },
  })
  const remove = useMutation({ mutationFn: removeSignature, onSuccess: refresh })
  const ok = (/^[0-9a-f]{64}$/.test(sha.trim()) || (!sha.trim() && name.trim())) && label.trim()
  return (
    <div className="flex flex-col gap-4">
      <HashSearch initial={hash} key={hash ?? ""} />
      <PanelSection title="Cargar una firma">
        <p className="text-xs text-muted-foreground">
          <b>Trampa</b>: cada vez que aparezca, marca grave. <b>Conocido</b>: no marca por firma ausente, overlay ni acceso a la
          memoria (Discord, Steam, NVIDIA…). En <b>Archivo del juego</b>, los hashes conocidos son los buenos: uno distinto se marca.
          Las firmas nunca viajan al agente.
        </p>
        <Input value={sha} placeholder="SHA-256 (o vacío y el nombre)" onChange={(e) => setSha(e.target.value.toLowerCase())} />
        <Input value={name} placeholder="Nombre del archivo, por ejemplo cheat.dll" onChange={(e) => setName(e.target.value)} />
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value as AcEventKind | "")}
        >
          <option value="">Cualquier tipo</option>
          {(Object.keys(KIND_LABEL) as AcEventKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <Input value={label} maxLength={120} placeholder="Qué es" onChange={(e) => setLabel(e.target.value)} />
        <div className="flex gap-2">
          <Button disabled={!ok || add.isPending} variant="destructive" onClick={() => add.mutate("bad")}>
            Cargar como trampa
          </Button>
          <Button disabled={!ok || add.isPending} variant="outline" onClick={() => add.mutate("good")}>
            Cargar como conocido
          </Button>
        </div>
        {add.isError && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(add.error)}</AlertDescription>
          </Alert>
        )}
      </PanelSection>
      <PanelSection title="Firmas cargadas">
        {list.isError ? (
          <QueryError error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : list.data.items.length === 0 ? (
          <EmptyState>Todavía no hay firmas.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-1 text-xs">
            {list.data.items.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded border p-2">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Dot tone={s.verdict === "bad" ? "danger" : "win"} />
                  <span className="truncate">
                    <b>{s.label}</b> · {s.sha256 ? `${s.sha256.slice(0, 12)}…` : s.name}
                    {s.kinds ? ` · ${s.kinds.map((k) => KIND_LABEL[k] ?? k).join(", ")}` : ""}
                  </span>
                </span>
                <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(s.id)}>
                  Borrar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
    </div>
  )
}

// ---------- configuración del agente ----------

// ---------- servidores (replanteo 160) ----------

const MODES: Record<AcServerMode, { label: string; help: string; tone: "win" | "warn" | "muted" }> = {
  always: { label: "Siempre", help: "Exige el anticheat desde que el jugador entra, también en el calentamiento.", tone: "win" },
  // Ya no se elige (Daniel, 2026-11-27): quien entra sin el anticheat juega el calentamiento y lo expulsan al arrancar el mix.
  // Solo se muestra si un servidor ya lo tiene (la demo de Kyan, o un cambio por SQL).
  mixes: { label: "Solo en la partida", help: "Ya no se usa: cámbialo a Siempre.", tone: "warn" },
  off: { label: "No lo exige", help: "No abre sesiones ni expulsa a nadie por el anticheat.", tone: "muted" },
}
const SETTABLE: AcSettableMode[] = ["always", "off"]

export function ServersTab() {
  const qc = useQueryClient()
  const [mode, setMode] = useState<AcSettableMode | undefined>(undefined)
  const [page, setPage] = useState(1)
  const list = useQuery(serverPoliciesOptions({ mode, page }))
  const change = useMutation({
    mutationFn: (v: { id: string; mode: AcSettableMode }) => setServerMode(v.id, v.mode),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "anticheat", "servers"] }),
  })
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.per)) : 1
  return (
    <div className="flex flex-col gap-4">
      <PanelSection title="Cuándo exige el anticheat cada servidor">
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {SETTABLE.map((m) => (
            <li key={m}>
              <span className="font-medium text-foreground">{MODES[m].label}:</span> {MODES[m].help}
            </li>
          ))}
          <li>
            <span className="font-medium text-foreground">Servidores del matchmaking:</span> los que toman salas siguen a
            "Anticheat obligatorio" de Administración › Matchmaking (prendido es Siempre, apagado es No lo exige) y no se cambian
            acá. Así la cola y el servidor piden lo mismo.
          </li>
          <li>
            En cualquier modo menos "No lo exige", el servidor expulsa siempre por AC-3, AC-4 y AC-5. El cambio llega al servidor
            en la próxima revisión del jugador (al entrar y cada minuto). "Abrir mixes" deja jugar sin el anticheat mientras dure.
          </li>
        </ul>
      </PanelSection>
      <FilterChips
        label="Modo"
        value={mode}
        onChange={(v) => {
          setMode(v)
          setPage(1)
        }}
        options={[
          { value: undefined, label: "Todos" },
          { value: "always", label: MODES.always.label },
          { value: "off", label: MODES.off.label },
        ]}
      />
      {list.isError ? (
        <QueryError error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : list.data.items.length === 0 ? (
        <EmptyState>No hay servidores activos con este filtro.</EmptyState>
      ) : (
        <TableBox>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={headCell}>Servidor</TableHead>
                <TableHead className={headCell}>Anticheat</TableHead>
                <TableHead className={headCell}>Último cambio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((s) => (
                <TableRow key={s.server_id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <Dot tone={MODES[s.mode].tone} />
                      {s.mm ? (
                        // Toma salas: lo decide "Anticheat obligatorio" del matchmaking (la API no deja cambiarlo acá).
                        <span className="flex flex-col" aria-label={`Anticheat en ${s.name}`}>
                          <span>{MODES[s.mode].label}</span>
                          <span className="text-xs text-muted-foreground">Lo decide el matchmaking</span>
                        </span>
                      ) : (
                        <Select
                          value={s.mode}
                          disabled={change.isPending}
                          onValueChange={(v) => change.mutate({ id: s.server_id, mode: v as AcSettableMode })}
                        >
                          <SelectTrigger aria-label={`Anticheat en ${s.name}`} className="h-9 w-[190px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {s.mode === "mixes" ? (
                              <SelectItem value="mixes" disabled>
                                {MODES.mixes.label}
                              </SelectItem>
                            ) : null}
                            {SETTABLE.map((m) => (
                              <SelectItem key={m} value={m}>
                                {MODES[m].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.updated_at ? fmtDate(s.updated_at) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableBox>
      )}
      {pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span className="text-muted-foreground">
            Página {page} de {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Siguiente
          </Button>
        </div>
      )}
      {change.isError && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(change.error)}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export function AgentTab() {
  const cfg = useQuery(agentConfigOptions())
  if (cfg.isError) return <QueryError error={cfg.error} onRetry={() => void cfg.refetch()} />
  if (cfg.isPending) return <Skeleton className="h-64 w-full" />
  return <AgentForm initial={cfg.data} key={JSON.stringify(cfg.data)} />
}

function AgentForm({ initial }: { initial: AcAgentConfig }) {
  const qc = useQueryClient()
  const a = initial.agent_config
  const [checks, setChecks] = useState({
    handles: a.handles ?? true,
    overlays: a.overlays ?? true,
    drivers: a.drivers ?? true,
    game_files: a.game_files ?? true,
  })
  const [files, setFiles] = useState((a.files ?? []).join("\n"))
  const [capMin, setCapMin] = useState(initial.capture_min_s)
  const [capMax, setCapMax] = useState(initial.capture_max_s)
  const [shotDays, setShotDays] = useState(initial.screenshot_retention_days)
  const [days, setDays] = useState(initial.retention_days)
  const [minVersion, setMinVersion] = useState(initial.agent_min_version ?? "")
  const [hashes, setHashes] = useState(initial.agent_hashes.join("\n"))
  const [latest, setLatest] = useState(initial.agent_latest ?? { version: "", url: "", sha256: "" })
  const save = useMutation({
    mutationFn: () =>
      setAgentConfig({
        agent_config: {
          ...checks,
          ...(files.trim() ? { files: files.split("\n").map((f) => f.trim()).filter(Boolean) } : {}),
        },
        capture_min_s: capMin,
        capture_max_s: capMax,
        screenshot_retention_days: shotDays,
        retention_days: days,
        agent_min_version: minVersion.trim(),
        agent_hashes: hashes.split("\n").map((h) => h.trim().toLowerCase()).filter(Boolean),
        agent_latest: latest.version.trim() ? { version: latest.version.trim(), url: latest.url.trim(), sha256: latest.sha256.trim().toLowerCase() } : null,
      } as never),
    onSuccess: () => void qc.invalidateQueries({ queryKey: agentConfigOptions().queryKey }),
  })
  const num = (v: string) => Math.max(0, Number.parseInt(v || "0", 10))
  return (
    <div className="flex flex-col gap-4">
      <PanelSection title="Qué revisa el agente">
        <p className="text-xs text-muted-foreground">Llega a los agentes en el próximo latido, sin sacar otra versión.</p>
        {(
          [
            ["handles", "Programas con acceso a la memoria del juego"],
            ["overlays", "Overlays encima del juego"],
            ["drivers", "Drivers"],
            ["game_files", "Archivos del juego"],
          ] as const
        ).map(([k, l]) => (
          <label key={k} className="inline-flex items-center gap-2 text-sm">
            <Switch checked={checks[k]} onCheckedChange={(v) => setChecks((c) => ({ ...c, [k]: v }))} /> {l}
          </label>
        ))}
        <span className="text-xs text-muted-foreground">Archivos del juego a revisar, uno por línea, relativos a la carpeta de ClientMod:</span>
        <Textarea rows={5} value={files} onChange={(e) => setFiles(e.target.value)} className="font-mono text-xs" />
      </PanelSection>
      <PanelSection title="Capturas">
        <label className="flex items-center justify-between gap-2 text-sm">
          Cada cuántos segundos (mínimo y máximo, al azar en el medio)
          <span className="flex gap-1">
            <Input className="w-20" type="number" min={30} value={capMin} onChange={(e) => setCapMin(num(e.target.value))} />
            <Input className="w-20" type="number" min={30} value={capMax} onChange={(e) => setCapMax(num(e.target.value))} />
          </span>
        </label>
        <label className="flex items-center justify-between gap-2 text-sm">
          Se borran a los (días)
          <Input className="w-20" type="number" min={1} max={365} value={shotDays} onChange={(e) => setShotDays(num(e.target.value))} />
        </label>
        <label className="flex items-center justify-between gap-2 text-sm">
          El resto de la evidencia, a los (días)
          <Input className="w-20" type="number" min={1} max={365} value={days} onChange={(e) => setDays(num(e.target.value))} />
        </label>
        <p className="text-xs text-muted-foreground">Una sesión conservada por un caso abierto no vence.</p>
      </PanelSection>
      <PanelSection title="Versiones del agente">
        <label className="flex items-center justify-between gap-2 text-sm">
          Versión mínima (debajo, el servidor expulsa con AC-4)
          <Input className="w-28" placeholder="0.5.0" value={minVersion} onChange={(e) => setMinVersion(e.target.value)} />
        </label>
        <span className="text-xs text-muted-foreground">Última versión: el agente se actualiza solo fuera de una partida. Solo desde cmleague.lat.</span>
        <div className="grid grid-cols-[6rem_1fr] gap-2">
          <Input placeholder="0.5.1" value={latest.version} onChange={(e) => setLatest({ ...latest, version: e.target.value })} />
          <Input placeholder="https://cmleague.lat/…/CMLeagueAC.exe" value={latest.url} onChange={(e) => setLatest({ ...latest, url: e.target.value })} />
        </div>
        <Input placeholder="SHA-256 del .exe" value={latest.sha256} onChange={(e) => setLatest({ ...latest, sha256: e.target.value })} />
        <span className="text-xs text-muted-foreground">
          Hashes permitidos del .exe, uno por línea. Vacío: no se controla. Con alguno, un agente con otro hash queda marcado y el servidor lo expulsa (AC-4).
        </span>
        <Textarea rows={3} value={hashes} onChange={(e) => setHashes(e.target.value)} className="font-mono text-xs" />
      </PanelSection>
      <div className="flex items-center gap-3">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          Guardar
        </Button>
        {save.isSuccess && <span className="text-xs text-muted-foreground">Guardado. Llega en el próximo latido.</span>}
      </div>
      {save.isError && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(save.error)}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

// ---------- máquina de una sesión (replanteo 158) ----------

export function MachinePanel({ sessionId }: { sessionId: string }) {
  const qc = useQueryClient()
  const machine = useQuery(machineOptions(sessionId))
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const refresh = () => void qc.invalidateQueries({ queryKey: machineOptions(sessionId).queryKey })
  const ban = useMutation({ mutationFn: () => banMachine(sessionId, reason), onSuccess: () => { setReason(""); refresh() } })
  const lift = useMutation({ mutationFn: liftMachineBan, onSuccess: refresh })
  const except = useMutation({ mutationFn: (userId: string) => addMachineException(sessionId, userId, note), onSuccess: refresh })

  if (machine.isError) return <QueryError error={machine.error} onRetry={() => void machine.refetch()} />
  if (machine.isPending) return <Skeleton className="h-24 w-full" />
  const m = machine.data
  if (!m.machine_id) return <EmptyState>El agente de esta sesión no informó la máquina.</EmptyState>
  const active = m.bans.find((b) => !b.lifted_at)
  return (
    <div className="flex flex-col gap-2 text-xs">
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        <Dot tone={m.banned ? "danger" : "muted"} />
        {m.banned ? "Máquina baneada" : "Máquina sin baneo"}
      </span>
      <span className="text-muted-foreground">Cuentas que usaron esta máquina:</span>
      <ul className="flex flex-col gap-1">
        {m.accounts.map((a) => (
          <li key={a.user_id} className="flex items-center justify-between gap-2 rounded border p-2">
            <span>
              <b>{a.nick ?? "Sin ficha"}</b> {a.steam_id ? `· ${a.steam_id}` : ""} · {fmtDate(a.last_seen_at)}
              {a.evasion ? " · baneada por evasión" : ""}
            </span>
            {m.banned && !m.exceptions.some((e) => e.user_id === a.user_id) && (
              <Button size="sm" variant="ghost" disabled={except.isPending} onClick={() => except.mutate(a.user_id)}>
                PC compartida
              </Button>
            )}
          </li>
        ))}
      </ul>
      {m.banned && <Input value={note} maxLength={200} placeholder="Nota de la excepción (opcional)" onChange={(e) => setNote(e.target.value)} />}
      {m.exceptions.length > 0 && (
        <span className="text-muted-foreground">Excepciones: {m.exceptions.map((e) => e.nick ?? e.user_id.slice(0, 8)).join(", ")}</span>
      )}
      {m.attempts.length > 0 && (
        <span className="text-muted-foreground">
          {m.attempts.length} {m.attempts.length === 1 ? "intento" : "intentos"} de usar el agente estando baneada (el último el{" "}
          {fmtDate(m.attempts[0]!.created_at)}).
        </span>
      )}
      {active ? (
        <Button size="sm" variant="outline" disabled={lift.isPending} onClick={() => lift.mutate(active.id)}>
          Levantar el ban de la máquina
        </Button>
      ) : (
        <div className="flex gap-2">
          <Input value={reason} maxLength={200} placeholder="Motivo" onChange={(e) => setReason(e.target.value)} />
          <Button size="sm" variant="destructive" disabled={reason.trim().length < 3 || ban.isPending} onClick={() => ban.mutate()}>
            Banear la máquina
          </Button>
        </div>
      )}
      {(ban.isError || lift.isError || except.isError) && (
        <span className="text-destructive">{errorMessage(ban.error ?? lift.error ?? except.error)}</span>
      )}
    </div>
  )
}
