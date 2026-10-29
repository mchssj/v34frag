import {
  CrownIcon,
  EllipsisIcon,
  LogOutIcon,
  UserMinusIcon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMmMutation } from "./queries"
import { useMmSource } from "./source"
import type { MmParty, MmState } from "./types"

// Manejo del grupo (plan, decisión "Grupo: salir, expulsar y líder"): salir, sacar a alguien y
// pasar el liderazgo, siempre con confirmación y nunca durante una partida.

type Confirm =
  { kind: "leave" } | { kind: "kick"; playerId: string; nick: string }

/** Lo que el que mira hizo a propósito: así no se le avisa "salió del grupo" por su propia acción. */
const own = { current: false }

/** Menú "⋯" de una tarjeta del grupo. */
export function PartyMenu({
  state,
  playerId,
  nick,
  isMe,
}: {
  state: MmState
  playerId: string
  nick: string
  isMe: boolean
}) {
  const source = useMmSource()
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const promote = useMmMutation((id: string) => source.promoteInParty(id))
  const party = state.party!
  const iLead = party.members.some((m) => m.is_me && m.is_leader)
  const inMatch = !!state.lobby
  if (!isMe && !iLead) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={isMe ? "Opciones del grupo" : `Opciones de ${nick}`}
            className="absolute top-2 left-2"
            disabled={inMatch}
            title={
              inMatch
                ? "No se puede cambiar el grupo durante una partida"
                : undefined
            }
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {isMe ? (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setConfirm({ kind: "leave" })}
            >
              <LogOutIcon aria-hidden />
              Salir del grupo
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem
                onSelect={() =>
                  promote.mutate(playerId, {
                    onSuccess: () =>
                      toast.success(`${nick} es el nuevo líder del grupo`),
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
              >
                <CrownIcon aria-hidden />
                Hacer líder
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirm({ kind: "kick", playerId, nick })}
              >
                <UserMinusIcon aria-hidden />
                Sacar del grupo
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirm && (
        <ConfirmDialog
          confirm={confirm}
          state={state}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  )
}

/** "Salir del grupo" debajo de las tarjetas, con la misma confirmación. */
export function LeavePartyButton({ state }: { state: MmState }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="self-center"
        disabled={!!state.lobby}
        onClick={() => setOpen(true)}
      >
        <LogOutIcon aria-hidden />
        Salir del grupo
      </Button>
      {open && (
        <ConfirmDialog
          confirm={{ kind: "leave" }}
          state={state}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function ConfirmDialog({
  confirm,
  state,
  onClose,
}: {
  confirm: Confirm
  state: MmState
  onClose: () => void
}) {
  const source = useMmSource()
  const leave = useMmMutation(() => source.leaveParty())
  const kick = useMmMutation((id: string) => source.kickFromParty(id))
  const party = state.party!
  const others = party.members.filter((m) => !m.is_me)
  const queued = !!state.queue
  const pending = leave.isPending || kick.isPending

  const title =
    confirm.kind === "leave"
      ? "¿Salir del grupo?"
      : `¿Sacar a ${confirm.nick} del grupo?`
  const body =
    confirm.kind === "leave"
      ? `Dejás de jugar con ${others.map((m) => m.nick).join(" y ") || "tu grupo"}.`
      : `${confirm.nick} deja de estar en tu grupo y le llega un aviso.`

  const run = () => {
    own.current = true
    const done = {
      onSuccess: () => {
        onClose()
        toast.success(
          confirm.kind === "leave"
            ? "Saliste del grupo"
            : `Sacaste a ${confirm.nick} del grupo`
        )
      },
      onError: (e: unknown) => {
        own.current = false
        toast.error(errorMessage(e))
      },
    }
    if (confirm.kind === "leave") leave.mutate(undefined, done)
    else kick.mutate(confirm.playerId, done)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {body}
            {queued && " El grupo sale de la cola."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={pending} onClick={run}>
            {confirm.kind === "leave" ? "Salir del grupo" : "Sacar del grupo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Avisa los cambios del grupo que no hizo el que mira: alguien salió, lo sacaron o le pasaron el
 * liderazgo. Compara el grupo anterior con el nuevo.
 */
export function usePartyNotices(party: MmParty | null) {
  const prev = useRef(party)
  useEffect(() => {
    const before = prev.current
    prev.current = party
    if (own.current) {
      own.current = false
      return
    }
    if (!before) return
    const now = new Set(party?.members.map((m) => m.player_id) ?? [])
    const iWasLeader = before.members.some((m) => m.is_me && m.is_leader)
    if (!party) {
      const other = before.members.find((m) => !m.is_me)
      toast(
        iWasLeader
          ? `${other?.nick ?? "Tu compañero"} salió del grupo`
          : "Ya no estás en el grupo: el líder te sacó o el grupo se deshizo"
      )
      return
    }
    for (const m of before.members)
      if (!m.is_me && !now.has(m.player_id)) toast(`${m.nick} salió del grupo`)
    const iLeadNow = party.members.some((m) => m.is_me && m.is_leader)
    if (iLeadNow && !iWasLeader) toast("Ahora sos el líder del grupo")
  }, [party])
}
