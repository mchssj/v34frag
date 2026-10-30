import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { STATUS_LABEL, statusOf } from "@/features/teams/model"
import { teamMembersOptions, type RosterEntry } from "@/features/teams/queries"
import { Initial } from "@/features/teams/ui"
import { modeText, type MyTeamRef } from "./model"
import {
  useRegisterTeam,
  useUnregisterTeam,
  type EventDetail,
  type Registration,
} from "./queries"

const ORDER = { player: 0, sub: 1, coach: 2 }

/** Por qué un jugador no se puede inscribir (null si puede). */
function blockedReason(m: RosterEntry) {
  if (statusOf(m) === "coach") return "El coach no se inscribe"
  if (!m.has_steam) return "Sin SteamID vinculado"
  return null
}

/**
 * Inscribir o cambiar los inscritos: el líder elige el equipo (si lidera varios) y los jugadores.
 * Parte de los Activos del equipo; los suplentes se suman a mano.
 */
export function RegisterDialog({
  event,
  teams,
  registration,
  onClose,
}: {
  event: EventDetail
  teams: MyTeamRef[]
  registration?: Registration
  onClose: () => void
}) {
  const [teamId, setTeamId] = useState(teams[0]?.id)
  const team = teams.find((t) => t.id === teamId)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[460px]">
        <div className="flex flex-col gap-1.5">
          <DialogTitle className="text-base font-semibold">
            {registration
              ? "Cambiar inscritos"
              : team && teams.length === 1
                ? `Inscribir a ${team.name}`
                : "Inscribir equipo"}
          </DialogTitle>
          <DialogDescription className="text-pretty">
            {modeText(event)}. Elige los inscritos de {event.name} entre los
            miembros del roster con SteamID; el coach no se inscribe.
          </DialogDescription>
        </div>
        {teams.length > 1 && (
          <div
            role="radiogroup"
            aria-label="Equipo"
            className="flex flex-wrap gap-2"
          >
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={t.id === teamId}
                onClick={() => setTeamId(t.id)}
                className={cn(
                  "h-8 rounded-lg border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  t.id === teamId
                    ? "border-primary bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
        {team && (
          <RosterPicker
            key={team.id}
            event={event}
            team={team}
            initial={registration?.players}
            onDone={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

type Slot = "active" | "sub"

function RosterPicker({
  event,
  team,
  initial,
  onDone,
}: {
  event: EventDetail
  team: MyTeamRef
  initial?: Registration["players"]
  onDone: () => void
}) {
  const members = useQuery(teamMembersOptions(team.id)).data
  const register = useRegisterTeam()
  // null: todavía sin tocar; se muestran los inscritos actuales o los Activos que pueden jugar.
  const [picked, setPicked] = useState<Record<string, Slot> | null>(null)

  const roster = (members ?? []).toSorted(
    (a, b) => ORDER[statusOf(a)] - ORDER[statusOf(b)]
  )
  const slots: Record<string, Slot> =
    picked ??
    (initial
      ? Object.fromEntries(initial.map((p) => [p.player_id, p.role]))
      : Object.fromEntries(
          roster
            .filter((m) => statusOf(m) === "player" && !blockedReason(m))
            .slice(0, event.players_per_team)
            .map((m) => [m.player_id, "active" as const])
        ))
  // En el orden del roster, no en el de los clics.
  const ids = (slot: Slot) =>
    roster.filter((m) => slots[m.player_id] === slot).map((m) => m.player_id)
  const active = ids("active")
  const subs = ids("sub")
  const valid =
    active.length === event.players_per_team && subs.length <= event.subs_max

  function toggle(id: string, slot: Slot) {
    const next = { ...slots }
    if (next[id] === slot) delete next[id]
    else next[id] = slot
    setPicked(next)
  }

  async function submit() {
    try {
      await register.mutateAsync({
        eventId: event.id,
        teamId: team.id,
        active,
        subs,
      })
      toast.success(
        initial
          ? "Inscritos actualizados"
          : `${team.name} quedó inscripto en ${event.name}`
      )
      onDone()
    } catch {
      // Se muestra en el diálogo.
    }
  }

  return (
    <>
      {!members ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : (
        <ul className="-mx-1 flex max-h-[min(50vh,420px)] flex-col overflow-y-auto">
          {roster.map((m) => {
            const reason = blockedReason(m)
            const slot = slots[m.player_id]
            return (
              <li
                key={m.player_id}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-1 py-2",
                  reason && "opacity-60"
                )}
              >
                <Initial
                  name={m.alias}
                  photo={m.photo_url}
                  className="size-7"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {m.alias}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {reason ?? STATUS_LABEL[statusOf(m)]}
                  </span>
                </span>
                {!reason && (
                  <span
                    role="group"
                    aria-label={`Inscribir a ${m.alias}`}
                    className="flex gap-1"
                  >
                    <SlotButton
                      pressed={slot === "active"}
                      disabled={
                        slot !== "active" &&
                        active.length >= event.players_per_team
                      }
                      onClick={() => toggle(m.player_id, "active")}
                    >
                      Activo
                    </SlotButton>
                    {event.subs_max > 0 && (
                      <SlotButton
                        pressed={slot === "sub"}
                        disabled={
                          slot !== "sub" && subs.length >= event.subs_max
                        }
                        onClick={() => toggle(m.player_id, "sub")}
                      >
                        Suplente
                      </SlotButton>
                    )}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {register.error != null && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(register.error)}
        </p>
      )}
      <DialogFooter className="items-center sm:justify-between">
        <span
          className={cn(
            "font-mono text-xs",
            valid ? "text-muted-foreground" : "text-destructive"
          )}
        >
          {active.length}/{event.players_per_team} activos
          {event.subs_max > 0 &&
            ` · ${subs.length}/${event.subs_max} suplentes`}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDone}>
            Cancelar
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!members || !valid || register.isPending}
          >
            {initial ? "Guardar inscritos" : "Inscribir"}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}

/** Botón de dos estados para elegir dónde va un jugador (activo o suplente). */
function SlotButton({
  pressed,
  disabled,
  onClick,
  children,
}: {
  pressed: boolean
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-7 rounded-md border px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

/** Confirmación para dar de baja al equipo. */
export function CancelRegistrationDialog({
  event,
  team,
  onClose,
}: {
  event: EventDetail
  team: MyTeamRef
  onClose: () => void
}) {
  const cancel = useUnregisterTeam()

  async function run() {
    try {
      await cancel.mutateAsync({ eventId: event.id, teamId: team.id })
      toast.success("Inscripción cancelada")
      onClose()
    } catch {
      // Se muestra en el diálogo.
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[420px]">
        <div className="flex flex-col gap-1.5">
          <DialogTitle className="text-base font-semibold">
            Cancelar la inscripción de {team.name}
          </DialogTitle>
          <DialogDescription className="text-pretty">
            {team.name} deja de estar inscripto en {event.name} y libera su
            cupo. Puedes volver a inscribirlo mientras sigan abiertas las
            inscripciones.
          </DialogDescription>
        </div>
        {cancel.error != null && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(cancel.error)}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={() => void run()}
            disabled={cancel.isPending}
          >
            Cancelar inscripción
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
