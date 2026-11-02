import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import {
  InfoIcon,
  LoaderIcon,
  MegaphoneIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { CountryFlag } from "@/components/brand/CountryFlag"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { askNotificationPermission } from "./alert"
import { EloMeter } from "./EloMeter"
import { fmtClock, isCountry } from "./labels"
import { useMmAction, useMmMutation } from "./queries"
import { useMmSource } from "./source"
import type { InvitePref, MmState } from "./types"
import { useNow } from "./useNow"

// Panel al costado de "Tu equipo": tu ELO, modo, región, invitaciones y buscar partida.

export const ANY_REGION = "any"

export function PlayBar({
  state,
  mode,
  onMode,
  region,
  onRegion,
}: {
  state: MmState
  mode: string
  onMode: (mode: string) => void
  region: string
  onRegion: (region: string) => void
}) {
  const source = useMmSource()
  const join = useMmMutation(() =>
    source.join(mode, region === ANY_REGION ? null : region)
  )
  const leave = useMmAction(source, "leave")
  const setPref = useMmMutation((p: InvitePref) => source.setInvitePref(p))
  const queued = !!state.queue
  const now = useNow(queued)
  const groupSize = state.party?.members.length ?? 1
  const leader = state.party?.members.find((m) => m.is_leader)
  const follower = groupSize > 1 && !leader?.is_me
  const pending = state.invites.length
  const modeInfo = state.modes.find((m) => m.mode === mode)
  const noServer = state.servers.free === 0

  return (
    <div className="flex flex-col gap-4">
      <EloMeter elo={state.me.elo} level={state.me.level} />
      <Column title="Modo">
        <Segmented
          label="Modo de juego"
          value={mode}
          options={state.modes.map((m) => ({
            value: m.mode,
            label: m.mode,
            // El grupo tiene que entrar en un equipo del modo.
            disabled: queued || groupSize > m.players_per_team,
          }))}
          onChange={onMode}
        />
        {modeInfo && !modeInfo.affects_elo && (
          <span className="w-full text-right text-xs text-muted-foreground">
            {mode} no da ELO: sirve para practicar
          </span>
        )}
      </Column>
      <Column title="Últimas">
        <ul aria-label="Últimos resultados" className="flex gap-1">
          {state.me.recent.map((r, i) => (
            <li
              key={i}
              title={r === "W" ? "Ganada" : "Perdida"}
              className={cn(
                "grid size-5 place-items-center rounded font-mono text-[10px] font-bold",
                r === "W"
                  ? "bg-win/15 text-win"
                  : "bg-destructive/15 text-destructive"
              )}
            >
              {r === "W" ? "G" : "P"}
            </li>
          ))}
        </ul>
      </Column>

      <Column title="Servidor">
        <Select value={region} onValueChange={onRegion} disabled={queued}>
          <SelectTrigger aria-label="Región del servidor" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_REGION}>Cualquiera</SelectItem>
            {state.regions.map((r) => (
              <SelectItem key={r} value={r}>
                {isCountry(r) && <CountryFlag country={r} />}
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Column>

      <Column title="Invitaciones">
        <Segmented
          label="Quién te puede invitar"
          value={state.invites_pref}
          options={[
            { value: "private", label: "Privado" },
            { value: "public", label: "Público" },
          ]}
          onChange={(v) => setPref.mutate(v as InvitePref)}
        />
        <span className="w-full text-right text-xs text-muted-foreground">
          {state.invites_pref === "private"
            ? "Nadie te puede invitar"
            : pending
              ? `${pending} ${pending === 1 ? "invitación" : "invitaciones"}`
              : "No hay invitaciones"}
        </span>
      </Column>

      <div className="flex flex-col gap-2 border-t pt-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <QueueInfo
            activity={state.queue_activity}
            searching={state.queue_size}
          />
          {state.active_players} jugadores activos
        </span>
        <span
          className={cn(
            "text-xs",
            noServer ? "text-primary" : "text-muted-foreground"
          )}
        >
          Servidores: {state.servers.free} de {state.servers.total} libres
        </span>
        {queued ? (
          <div className="flex w-full flex-col items-center gap-2">
            <span className="flex items-center gap-2 font-semibold">
              <LoaderIcon className="size-4 animate-spin" aria-hidden />
              Buscando{" "}
              <span role="timer" className="font-mono tabular-nums">
                {fmtClock(now - Date.parse(state.queue!.joined_at))}
              </span>
            </span>
            <span className="text-center text-xs text-muted-foreground">
              {noServer
                ? "Todos los servidores están ocupados: la partida se arma cuando se libere uno"
                : `Rival de ±${state.queue!.elo_window ?? "∞"} ELO${
                    state.queue!.eta_s
                      ? ` · espera estimada ${fmtClock(state.queue!.eta_s * 1000)}`
                      : ""
                  }`}
            </span>
            <Button
              variant="outline"
              className="w-full"
              disabled={leave.isPending}
              onClick={() => leave.mutate()}
            >
              Cancelar
            </Button>
            <QueuePing now={now} />
          </div>
        ) : (
          <Button
            size="xl"
            className="w-full"
            disabled={
              follower ||
              !state.open ||
              !!state.penalty ||
              (state.anticheat.required && state.anticheat.status !== "ok") ||
              !!state.ban ||
              !!state.block_reason ||
              join.isPending
            }
            onClick={() => {
              askNotificationPermission()
              join.mutate(undefined, {
                onError: (e) => toast.error(errorMessage(e)),
              })
            }}
          >
            {state.open ? "Buscar partida" : "Cola cerrada"}
          </Button>
        )}
        {follower && (
          <span className="text-center text-xs text-muted-foreground">
            {leader?.nick} es el líder y busca por el grupo.
          </span>
        )}
        <AnticheatLine anticheat={state.anticheat} />
        {state.block_reason && (
          <span className="text-center text-xs text-destructive">
            {state.block_reason}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * "Avisar en Discord" (replanteo 57): publica en #avisos que hay gente en la cola, mencionando al rol @player. Uno cada
 * 15 minutos para todo el servidor; los moderadores y admins, siempre.
 */
function QueuePing({ now }: { now: number }) {
  const source = useMmSource()
  const qc = useQueryClient()
  const key = ["mm", "queue-ping"] as const
  const status = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => source.queuePingStatus(signal),
    refetchInterval: 30_000,
  })
  const ping = useMutation({
    mutationFn: () => source.queuePing(),
    onSuccess: (s) => {
      qc.setQueryData(key, s)
      toast.success("Listo: avisamos en Discord que hay gente buscando.")
    },
    onError: (e) => {
      toast.error(errorMessage(e))
      void qc.invalidateQueries({ queryKey: key })
    },
  })
  const s = status.data
  if (!s) return null
  const wait = !s.staff && s.next_at ? Date.parse(s.next_at) - now : 0
  return (
    <div className="flex w-full flex-col items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        disabled={ping.isPending || wait > 0 || (!s.staff && !s.queued)}
        onClick={() => ping.mutate()}
      >
        <MegaphoneIcon aria-hidden />
        Avisar en Discord
      </Button>
      <span className="text-center text-xs text-muted-foreground">
        {wait > 0
          ? `Ya se avisó hace poco: el próximo aviso, en ${fmtClock(wait)}`
          : "Le avisa al rol @player que hay gente buscando"}
      </span>
    </div>
  )
}

/** Círculo con la i: al pasar el ratón, cuánta gente hay buscando; con un clic, quiénes son. */
function QueueInfo({
  activity,
  searching,
}: {
  activity: MmState["queue_activity"]
  searching: number
}) {
  const [detail, setDetail] = useState(false)
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Ver quiénes están buscando partida"
            onClick={() => setDetail(true)}
            className="rounded-full hover:text-foreground"
          >
            <InfoIcon aria-hidden className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-none p-3">
          <div className="w-56">
            <p className="mb-2 text-xs font-semibold">
              {searching} buscando partida
            </p>
            <ul className="flex flex-col gap-1 text-xs">
              {activity.modes.map((m) => (
                <li key={m.mode} className="flex justify-between gap-2">
                  <span>
                    <span className="font-mono font-semibold">{m.mode}</span>{" "}
                    {m.searching} buscando
                  </span>
                  <span className="opacity-70">
                    {m.missing === 1 ? "falta 1" : `faltan ${m.missing}`}
                  </span>
                </li>
              ))}
            </ul>
            <ul className="mt-2 flex flex-col gap-0.5 border-t border-current/15 pt-2 text-xs">
              {activity.levels.map((l) => (
                <li key={l.label} className="flex justify-between gap-2">
                  {l.label}
                  <span className="font-mono tabular-nums">{l.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
      <Dialog open={detail} onOpenChange={setDetail}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{searching} buscando partida</DialogTitle>
          </DialogHeader>
          {activity.players.length ? (
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto text-sm">
              {activity.players.map((p) => (
                <li key={p.player_id} className="flex items-center gap-2">
                  <LevelBadge level={p.level} size={20} />
                  <span className="min-w-0 flex-1 truncate">{p.nick}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {p.mode}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nadie está buscando partida.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function AnticheatLine({ anticheat }: { anticheat: MmState["anticheat"] }) {
  if (!anticheat.required)
    return (
      <span className="text-xs text-muted-foreground">
        Anticheat no obligatorio
      </span>
    )
  const ok = anticheat.status === "ok"
  const Icon = ok ? ShieldCheckIcon : ShieldAlertIcon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        ok ? "text-win" : "text-destructive"
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {ok ? "Anticheat activo" : "Anticheat inactivo"}
    </span>
  )
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      {children}
    </div>
  )
}

/** Botones de una sola opción (radio), como el selector de modo del diseño. */
function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string; disabled?: boolean }[]
  onChange: (value: string) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-lg bg-muted p-[3px]"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={o.disabled && o.value !== value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40",
            o.value === value && "bg-card text-foreground shadow-xs"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
