import { cn } from "cn"
import { BanIcon, ExternalLinkIcon, FlagIcon, UserPlusIcon } from "lucide-react"
import { useState } from "react"
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { REASON_TEXT } from "./labels"
import { useMmMutation } from "./queries"
import { useMmSource } from "./source"
import type { ReportReason } from "./types"

const REASONS = Object.keys(REASON_TEXT) as ReportReason[]

/**
 * Un nombre de jugador que abre un menú: ver el perfil, agregar de amigo, bloquear y denunciar
 * (prototipo, bitácora 2026-11-08-pcw-demo). En una sala, la denuncia es la de la sala; afuera, la del chat.
 * Sin `playerId` (o si soy yo) solo queda ver el perfil.
 */
export function PlayerName({
  nick,
  playerId,
  isMe = false,
  friend = false,
  lobbyId,
  className,
  children,
}: {
  nick: string
  playerId?: string | null
  isMe?: boolean
  /** Ya es amigo: sin "Agregar de amigo". */
  friend?: boolean
  /** La sala abierta: la denuncia va como reporte de la sala. */
  lobbyId?: string | null
  className?: string
  children?: React.ReactNode
}) {
  const source = useMmSource()
  const [reporting, setReporting] = useState(false)
  const add = useMmMutation((id: string) => source.addFriend(id))
  const block = useMmMutation((id: string) => source.block(id))
  const other = !isMe && !!playerId
  const onError = (e: unknown) => toast.error(errorMessage(e))

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Jugador ${nick}: perfil, amigo, bloquear o denunciar`}
            className={cn(
              "cursor-pointer rounded-sm text-left underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              className
            )}
          >
            {children ?? nick}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuLabel className="truncate">{nick}</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            {/* En otra pestaña: salir de Jugar mientras se busca podría sacarte de la cola. */}
            <a
              href={`/player/${encodeURIComponent(nick)}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLinkIcon aria-hidden />
              Ver perfil
            </a>
          </DropdownMenuItem>
          {other && (
            <>
              {!friend && (
                <DropdownMenuItem
                  onSelect={() =>
                    add.mutate(playerId!, {
                      onSuccess: () =>
                        toast.success(`Solicitud enviada a ${nick}`),
                      onError,
                    })
                  }
                >
                  <UserPlusIcon aria-hidden />
                  Agregar de amigo
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  block.mutate(playerId!, {
                    onSuccess: () =>
                      toast.success(`Bloqueaste a ${nick}`, {
                        description: "No te va a tocar en tu equipo.",
                      }),
                    onError,
                  })
                }
              >
                <BanIcon aria-hidden />
                Bloquear
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setReporting(true)}
              >
                <FlagIcon aria-hidden />
                Denunciar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {reporting && playerId && (
        <ReportPlayerDialog
          nick={nick}
          playerId={playerId}
          lobbyId={lobbyId ?? null}
          onClose={() => setReporting(false)}
        />
      )}
    </>
  )
}

function ReportPlayerDialog({
  nick,
  playerId,
  lobbyId,
  onClose,
}: {
  nick: string
  playerId: string
  lobbyId: string | null
  onClose: () => void
}) {
  const source = useMmSource()
  const [reason, setReason] = useState<ReportReason>(REASONS[0]!)
  const [note, setNote] = useState("")
  const report = useMmMutation(() => {
    if (lobbyId) return source.report(lobbyId, playerId, reason, note)
    if (!source.reportPlayer)
      throw new Error("Por ahora solo se denuncia desde la sala")
    return source.reportPlayer(playerId, reason, note)
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Denunciar a {nick}</DialogTitle>
          <DialogDescription>
            Lo revisa un moderador. Una denuncia falsa también se sanciona.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          aria-label="Motivo"
          value={reason}
          onValueChange={(v) => setReason(v as ReportReason)}
          className="gap-2"
        >
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <RadioGroupItem value={r} />
              {REASON_TEXT[r]}
            </label>
          ))}
        </RadioGroup>
        <Textarea
          aria-label="Nota (opcional)"
          placeholder="Qué pasó (opcional)"
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={report.isPending}
            onClick={() =>
              report.mutate(undefined, {
                onSuccess: () => {
                  onClose()
                  toast.success(`Denunciaste a ${nick}`)
                },
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
          >
            Enviar denuncia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
