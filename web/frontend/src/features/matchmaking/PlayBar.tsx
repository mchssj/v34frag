import { cn } from "cn"
import { InfoIcon, LoaderIcon } from "lucide-react"
import type { ReactNode } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { CountryFlag } from "@/components/brand/CountryFlag"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { askNotificationPermission } from "./alert"
import { fmtClock, isCountry } from "./labels"
import { useMmAction, useMmMutation } from "./queries"
import { useMmSource } from "./source"
import type { InvitePref, MmState } from "./types"
import { useNow } from "./useNow"

// Barra de abajo de "Mi grupo": modo, región, invitaciones y buscar partida.

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
    <div className="grid gap-6 border-t pt-6 sm:grid-cols-2 lg:grid-cols-4">
      <Column title="Modo de juego">
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
          <span className="text-xs text-muted-foreground">
            {mode} no da ELO: sirve para practicar
          </span>
        )}
        <ul aria-label="Últimos resultados" className="flex gap-1.5">
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
          <SelectTrigger aria-label="Región del servidor" className="w-44">
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
        <span className="text-xs text-muted-foreground">
          {state.invites_pref === "private"
            ? "Nadie te puede invitar"
            : pending
              ? `${pending} ${pending === 1 ? "invitación" : "invitaciones"}`
              : "No hay invitaciones"}
        </span>
      </Column>

      <div className="flex flex-col items-center gap-2 lg:items-end">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <InfoIcon aria-hidden className="size-3.5" />
          {state.active_players} jugadores activos
        </span>
        <span
          className={cn(
            "text-xs",
            noServer ? "text-sidebar-primary" : "text-muted-foreground"
          )}
        >
          Servidores: {state.servers.free} de {state.servers.total} libres
        </span>
        {queued ? (
          <div className="flex w-full max-w-60 flex-col items-center gap-2">
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
                : `Rival de ±${state.queue!.elo_window ?? "∞"} ELO`}
            </span>
            <Button
              variant="outline"
              className="w-full"
              disabled={leave.isPending}
              onClick={() => leave.mutate()}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            size="xl"
            className="w-full max-w-60 bg-win font-bold tracking-wide text-white uppercase hover:bg-win/85"
            disabled={
              follower ||
              !state.open ||
              !!state.penalty ||
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
        {state.block_reason && (
          <span className="text-center text-xs text-destructive">
            {state.block_reason}
          </span>
        )}
      </div>
    </div>
  )
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <span className="text-[11px] font-semibold tracking-[0.8px] text-muted-foreground uppercase">
        {title}
      </span>
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
      className="inline-flex rounded-lg border bg-muted/40 p-1"
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
            "rounded-md px-3.5 py-1 text-sm font-medium text-muted-foreground transition disabled:opacity-40",
            o.value === value && "bg-background text-foreground shadow-sm"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
