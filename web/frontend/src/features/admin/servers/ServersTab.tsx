import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { RotateCwIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog, SecretDialog } from "../dialogs"
import { HudSection, hudChip } from "./HudSection"
import {
  ago,
  compareVersions,
  endOfDayIso,
  latestVersion,
  licenseLabel,
} from "../format"
import {
  Chip,
  Dot,
  EmptyState,
  FilterChips,
  PanelSection,
  PickHint,
  QueryError,
  SplitLayout,
  warnText,
} from "../ui"
import {
  serversOptions,
  useCreateServer,
  useDeleteServer,
  useRotateServerToken,
  useUpdateServer,
  type AdminServer,
  type ServerCreate,
  type ServerToken,
} from "./queries"

export const MODES = {
  mix: "Mix",
  competitive: "Competitivo",
  public: "Público",
  deathmatch: "Deathmatch",
  retakes: "Retakes",
  practice: "Práctica",
} as const
type Mode = keyof typeof MODES

type Filter = "all" | "online" | "warn" | "revoked"

/** Activo con algo que mirar: sin señal, licencia por vencer o vencida, o plugin viejo. */
export function serverWarnings(s: AdminServer, latest: string | null) {
  if (!s.active) return []
  const out: string[] = []
  if (!s.online)
    out.push(
      `No valida su licencia desde ${ago(s.last_seen_at)} (lo hace al cargar cada mapa y cada 30 minutos).`
    )
  if (s.license_state === "expiring")
    out.push(
      "La licencia vence en pocos días: renuévala para que siga jugando mixes."
    )
  if (s.license_state === "expired")
    out.push("Licencia vencida: no puede jugar mixes ni subir resultados.")
  if (
    latest &&
    s.plugin_version &&
    compareVersions(s.plugin_version, latest) < 0
  )
    out.push(`Tiene el plugin ${s.plugin_version}; la última es ${latest}.`)
  return out
}

type Selection = { kind: "new" } | { kind: "edit"; id: string } | null

export function ServersTab({
  creating,
  onCreatingDone,
}: {
  creating: boolean
  onCreatingDone: () => void
}) {
  const list = useQuery(serversOptions)
  const [filter, setFilter] = useState<Filter>("all")
  const [sel, setSel] = useState<Selection>(null)
  const [secret, setSecret] = useState<{
    title: string
    intro: string
    token: ServerToken
  } | null>(null)

  // "Nuevo servidor" de la cabecera abre el alta.
  const selection: Selection = creating ? { kind: "new" } : sel

  if (list.isError)
    return <QueryError error={list.error} onRetry={() => void list.refetch()} />

  const servers = list.data?.items ?? []
  const latest = latestVersion(servers.map((s) => s.plugin_version))
  const warn = (s: AdminServer) => serverWarnings(s, latest).length > 0
  const counts: Record<Filter, number> = {
    all: servers.length,
    online: servers.filter((s) => s.active && s.online).length,
    warn: servers.filter(warn).length,
    revoked: servers.filter((s) => !s.active).length,
  }
  const shown = servers.filter((s) =>
    filter === "online"
      ? s.active && s.online
      : filter === "warn"
        ? warn(s)
        : filter === "revoked"
          ? !s.active
          : true
  )
  const current =
    selection?.kind === "edit"
      ? (servers.find((s) => s.id === selection.id) ?? null)
      : null

  const close = () => {
    setSel(null)
    onCreatingDone()
  }

  return (
    <>
      <SplitLayout
        asideLabel="Detalle del servidor"
        main={
          <>
            <div className="flex flex-wrap items-center gap-2">
              <FilterChips
                label="Filtrar servidores"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "Todos", count: counts.all },
                  { value: "online", label: "En línea", count: counts.online },
                  { value: "warn", label: "Con avisos", count: counts.warn },
                  {
                    value: "revoked",
                    label: "Revocados",
                    count: counts.revoked,
                  },
                ]}
              />
              {latest && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Última versión del plugin:{" "}
                  <span className="font-mono text-foreground">{latest}</span>
                </span>
              )}
            </div>
            {list.isPending ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-[92px] rounded-xl" />
                ))}
              </div>
            ) : shown.length === 0 ? (
              <EmptyState>Ningún servidor con ese filtro.</EmptyState>
            ) : (
              <ul className="flex flex-col gap-2">
                {shown.map((s) => (
                  <li key={s.id}>
                    <ServerRow
                      server={s}
                      latest={latest}
                      selected={current?.id === s.id}
                      onSelect={() => {
                        onCreatingDone()
                        setSel({ kind: "edit", id: s.id })
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        }
        aside={
          selection?.kind === "new" ? (
            <ServerForm
              key="new"
              server={null}
              latest={latest}
              onClose={close}
              onCreated={(token, name) => {
                onCreatingDone()
                setSel({ kind: "edit", id: token.id })
                setSecret({
                  title: `Servidor creado: ${name}`,
                  intro:
                    "Pega estas líneas en cfg/sourcemod/csstv_reporter.cfg y cambia de mapa.",
                  token,
                })
              }}
              onToken={() => undefined}
            />
          ) : current ? (
            <ServerForm
              key={current.id}
              server={current}
              latest={latest}
              onClose={close}
              onCreated={() => undefined}
              onToken={(token) =>
                setSecret({
                  title: `Token nuevo de ${current.name}`,
                  intro:
                    "Reemplaza el token en cfg/sourcemod/csstv_reporter.cfg y cambia de mapa.",
                  token,
                })
              }
            />
          ) : (
            <PickHint
              title="Elige un servidor"
              text="Sus datos, la licencia, el token y la IP permitida aparecen acá."
            />
          )
        }
      />
      <SecretDialog
        open={secret !== null}
        title={secret?.title ?? ""}
        intro={secret?.intro ?? ""}
        blocks={
          secret
            ? [
                { label: "csstv_reporter.cfg", text: secret.token.cfg },
                {
                  label: "Servidor externo: build licenciado",
                  text: secret.token.build_command,
                },
              ]
            : []
        }
        onDone={() => setSecret(null)}
      />
    </>
  )
}

function ServerRow({
  server: s,
  latest,
  selected,
  onSelect,
}: {
  server: AdminServer
  latest: string | null
  selected: boolean
  onSelect: () => void
}) {
  const lic = licenseLabel(s.license_state, s.license_expires_at)
  const old =
    !!latest &&
    !!s.plugin_version &&
    compareVersions(s.plugin_version, latest) < 0
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full flex-wrap items-start gap-4 rounded-xl border bg-card px-4 py-3.5 text-left transition-colors hover:bg-muted",
        selected && "border-primary ring-3 ring-primary/20",
        !s.active && "opacity-70"
      )}
    >
      <span className="flex min-w-0 flex-[2_1_220px] flex-col gap-1">
        <span className="flex items-center gap-2 text-[15px] font-semibold">
          <Dot tone={!s.active ? "muted" : s.online ? "win" : "warn"} />
          {s.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {[s.mode ? MODES[s.mode] : null, s.region]
            .filter(Boolean)
            .join(" · ") || "Sin modo ni región"}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {s.connect_address ?? "Sin dirección"}
        </span>
      </span>
      <Cell label="Estado" className="flex-[1_1_150px]">
        <span className="font-medium">
          {!s.active
            ? "Sin acceso"
            : `${s.online ? "En línea" : "Sin señal"} · ${ago(s.last_seen_at)}`}
        </span>
      </Cell>
      <Cell label="Licencia" className="flex-[1_1_170px]">
        <Chip tone={lic.tone}>{lic.text}</Chip>
      </Cell>
      <Cell label="HUD" className="flex-[1_1_120px]">
        <Chip tone={hudChip(s.hud).tone}>{hudChip(s.hud).text}</Chip>
      </Cell>
      <Cell label="Plugin" className="flex-[1_1_110px]">
        <span
          className={cn(
            "font-mono",
            old && s.active && cn("font-medium", warnText)
          )}
        >
          {s.plugin_version ?? "—"}
          {old ? " · vieja" : ""}
        </span>
      </Cell>
      <Cell label="Partidas" className="flex-[1_1_100px] items-end text-right">
        <span className="font-mono font-semibold">
          {s.matches.toLocaleString("es")}
        </span>
        <span className="text-xs text-muted-foreground">
          {s.last_match_at ? `Última ${ago(s.last_match_at)}` : "Sin partidas"}
        </span>
      </Cell>
    </button>
  )
}

function Cell({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <span className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </span>
  )
}

type Draft = {
  name: string
  connect_address: string
  mode: Mode | ""
  region: string
  tv_port: string
  license_date: string
  panel_server_id: string
  allowed_ip: string
}

const toDraft = (s: AdminServer | null): Draft => ({
  name: s?.name ?? "",
  connect_address: s?.connect_address ?? "",
  mode: s?.mode ?? "mix",
  region: s?.region ?? "",
  tv_port: s?.tv_port != null ? String(s.tv_port) : "",
  license_date: s?.license_expires_at?.slice(0, 10) ?? "",
  panel_server_id: s?.panel_server_id ?? "",
  allowed_ip: s?.allowed_ip ?? "",
})

/** Del borrador al cuerpo de la API: vacío = null (borra). */
function toBody(d: Draft): ServerCreate {
  const text = (v: string) => v.trim() || null
  const port = d.tv_port.trim() ? Number(d.tv_port) : null
  return {
    name: d.name.trim(),
    connect_address: text(d.connect_address),
    mode: d.mode || null,
    region: text(d.region),
    tv_port: port,
    license_expires_at: d.license_date ? endOfDayIso(d.license_date) : null,
    panel_server_id: text(d.panel_server_id),
    allowed_ip: text(d.allowed_ip),
  }
}

function draftError(d: Draft): string | null {
  const n = d.name.trim().length
  if (n > 0 && (n < 2 || n > 40)) return "El nombre va de 2 a 40 caracteres."
  if (d.tv_port.trim()) {
    const p = Number(d.tv_port)
    if (!Number.isInteger(p) || p < 1 || p > 65535)
      return "El puerto de SourceTV va de 1 a 65535."
  }
  if (
    d.region.trim() &&
    (d.region.trim().length < 2 || d.region.trim().length > 30)
  )
    return "La región va de 2 a 30 caracteres."
  return null
}

type Confirm = "rotate" | "revoke" | "delete" | null

function ServerForm({
  server,
  latest,
  onClose,
  onCreated,
  onToken,
}: {
  server: AdminServer | null
  latest: string | null
  onClose: () => void
  onCreated: (token: ServerToken, name: string) => void
  onToken: (token: ServerToken) => void
}) {
  const id = useId()
  const [d, setD] = useState<Draft>(() => toDraft(server))
  const [confirm, setConfirm] = useState<Confirm>(null)
  const create = useCreateServer()
  const update = useUpdateServer()
  const rotate = useRotateServerToken()
  const del = useDeleteServer()
  const set = (k: keyof Draft) => (v: string) => setD((p) => ({ ...p, [k]: v }))

  const err = draftError(d)
  const dirty =
    server !== null && JSON.stringify(toDraft(server)) !== JSON.stringify(d)
  const warnings = server ? serverWarnings(server, latest) : []
  const saveError = create.error ?? update.error

  function save() {
    if (!server) {
      create.mutate(toBody(d), {
        onSuccess: (token) => onCreated(token, d.name.trim()),
      })
      return
    }
    update.mutate(
      { id: server.id, body: toBody(d) },
      { onSuccess: () => toast.success("Cambios guardados.") }
    )
  }

  const field = (
    key: keyof Draft,
    label: string,
    props: React.ComponentProps<typeof Input> = {}
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      <Input
        id={`${id}-${key}`}
        value={d[key]}
        onChange={(e) => set(key)(e.target.value)}
        {...props}
      />
    </div>
  )

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg font-bold wrap-anywhere">
            {server ? server.name : "Nuevo servidor"}
          </h2>
          <span className="text-xs text-muted-foreground">
            {server
              ? `${server.matches.toLocaleString("es")} partidas · ${
                  server.active
                    ? `${server.online ? "en línea" : "sin señal"} ${ago(server.last_seen_at)}`
                    : "revocado"
                }`
              : "Al crearlo se genera su token y la configuración para pegar."}
          </span>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Cerrar detalle"
          onClick={onClose}
        >
          <XIcon aria-hidden />
        </Button>
      </div>

      {warnings.length > 0 && (
        <Alert variant="warning">
          <TriangleAlertIcon aria-hidden />
          <AlertDescription>{warnings.join(" ")}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          {field("name", "Nombre", {
            maxLength: 40,
            placeholder: "CMLeague #4",
          })}
        </div>
        <div className="col-span-2">
          {field("connect_address", "Dirección para conectarse", {
            placeholder: "host:27015",
            className: "font-mono text-[13px]",
          })}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-mode`}>Modo</Label>
          <Select value={d.mode} onValueChange={(v) => set("mode")(v)}>
            <SelectTrigger id={`${id}-mode`} className="w-full">
              <SelectValue placeholder="Sin modo" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MODES) as Mode[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {MODES[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {field("region", "Región", {
          maxLength: 30,
          placeholder: "Sudamérica",
        })}
        {field("tv_port", "Puerto de SourceTV", {
          inputMode: "numeric",
          placeholder: "27020",
          className: "font-mono text-[13px]",
        })}
        {field("license_date", "Licencia vence", { type: "date" })}
        <div className="col-span-2">
          {field("panel_server_id", "ID del servidor en el panel", {
            placeholder: "Para bajar las demos",
            className: "font-mono text-[13px]",
          })}
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor={`${id}-allowed_ip`}>IP permitida</Label>
          <div className="flex gap-2">
            <Input
              id={`${id}-allowed_ip`}
              value={d.allowed_ip}
              onChange={(e) => set("allowed_ip")(e.target.value)}
              placeholder="Cualquiera"
              className="font-mono text-[13px]"
            />
            {server?.last_ip && d.allowed_ip !== server.last_ip && (
              <Button
                variant="outline"
                className="h-9"
                onClick={() => set("allowed_ip")(server.last_ip ?? "")}
              >
                Usar la última IP
              </Button>
            )}
          </div>
          {server?.last_ip && (
            <span className="text-xs text-muted-foreground">
              Última conexión válida desde{" "}
              <span className="font-mono">{server.last_ip}</span>
            </span>
          )}
        </div>
      </div>

      {(err || saveError) && (
        <p role="alert" className="text-sm text-destructive">
          {err ?? errorMessage(saveError)}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          size="md"
          onClick={save}
          disabled={
            !!err ||
            d.name.trim().length < 2 ||
            create.isPending ||
            update.isPending ||
            (server !== null && !dirty)
          }
        >
          {server ? "Guardar cambios" : "Crear y generar token"}
        </Button>
      </div>

      {server && (
        <PanelSection title="Acceso del servidor">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            El token se ve una sola vez, al crearlo. Si se perdió, genera otro:
            el anterior deja de funcionar al instante.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setConfirm("rotate")}>
              <RotateCwIcon aria-hidden />
              Generar token nuevo
            </Button>
            {server.active ? (
              <Button
                variant="outline"
                className="border-destructive/50 text-destructive hover:text-destructive"
                onClick={() => setConfirm("revoke")}
              >
                Revocar
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate(
                    { id: server.id, body: { active: true } },
                    {
                      onSuccess: () =>
                        toast.success(`${server.name} reactivado.`),
                    }
                  )
                }
              >
                Reactivar
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={server.matches > 0}
              onClick={() => setConfirm("delete")}
            >
              Borrar
            </Button>
          </div>
          {server.matches > 0 && (
            <span className="text-xs text-muted-foreground">
              No se puede borrar porque tiene partidas. Revocarlo lo deja sin
              acceso y conserva el historial.
            </span>
          )}
        </PanelSection>
      )}

      {server && <HudSection server={server} />}

      {server && (
        <>
          <ConfirmDialog
            open={confirm === "rotate"}
            onOpenChange={(o) => !o && setConfirm(null)}
            title={`¿Generar un token nuevo para ${server.name}?`}
            description="El token actual deja de funcionar al instante: el servidor no sube partidas hasta que cargues el nuevo en csstv_reporter.cfg."
            confirmLabel="Generar token"
            pending={rotate.isPending}
            error={rotate.error}
            onConfirm={() =>
              rotate.mutate(server.id, {
                onSuccess: (token) => {
                  setConfirm(null)
                  onToken(token)
                },
              })
            }
          />
          <ConfirmDialog
            open={confirm === "revoke"}
            onOpenChange={(o) => !o && setConfirm(null)}
            title={`¿Revocar ${server.name}?`}
            description="Deja de poder jugar mixes y subir partidas al instante. Su historial se conserva y puedes reactivarlo cuando quieras."
            confirmLabel="Revocar"
            danger
            pending={update.isPending}
            error={update.error}
            onConfirm={() =>
              update.mutate(
                { id: server.id, body: { active: false } },
                {
                  onSuccess: () => {
                    setConfirm(null)
                    toast.success(`${server.name} revocado.`)
                  },
                }
              )
            }
          />
          <ConfirmDialog
            open={confirm === "delete"}
            onOpenChange={(o) => !o && setConfirm(null)}
            title={`¿Borrar ${server.name}?`}
            description="No tiene partidas, así que se borra del todo."
            confirmLabel="Borrar"
            danger
            pending={del.isPending}
            error={del.error}
            onConfirm={() =>
              del.mutate(server.id, {
                onSuccess: () => {
                  setConfirm(null)
                  onClose()
                  toast.success("Servidor borrado.")
                },
              })
            }
          />
        </>
      )}
    </>
  )
}
