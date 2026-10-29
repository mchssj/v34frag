import { LevelBadge } from "@/components/brand/LevelBadge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { secondsLeft } from "./labels"
import { useMmMutation } from "./queries"
import { useMmSource } from "./source"
import type { MmInvite } from "./types"
import { useNow } from "./useNow"

const INVITE_SECONDS = 60

/**
 * Popup de invitación al grupo (plan, decisión "Al recibir una invitación"). Muestra la más vieja;
 * el sonido lo dispara PlayPage. Solo se cierra con Aceptar o Rechazar (o al vencer): un clic
 * afuera o Escape no rechazan sin querer.
 */
export function InviteDialog({ invite }: { invite: MmInvite }) {
  const source = useMmSource()
  const now = useNow(true, 250)
  const left = secondsLeft(invite.expires_at, now)
  const respond = useMmMutation((accept: boolean) =>
    source.respondInvite(invite.id, accept)
  )

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-[400px]"
      >
        <DialogHeader>
          <DialogTitle>Te invitaron a un grupo</DialogTitle>
          <DialogDescription>
            Si aceptás, salís de la cola y de tu grupo actual.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 rounded-xl border p-3">
          <LevelBadge level={invite.from.level} size={30} />
          <div className="flex flex-col">
            <span className="font-semibold">{invite.from.nick}</span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {invite.from.elo.toLocaleString("es-AR")} ELO
            </span>
          </div>
          <span
            role="timer"
            aria-label={`${left} segundos para responder`}
            className="ml-auto font-mono text-lg font-bold tabular-nums"
          >
            {left}s
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full bg-primary transition-[width] duration-200"
            style={{ width: `${(left / INVITE_SECONDS) * 100}%` }}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={respond.isPending}
            onClick={() => respond.mutate(false)}
          >
            Rechazar
          </Button>
          <Button
            autoFocus
            disabled={respond.isPending}
            onClick={() => respond.mutate(true)}
          >
            Aceptar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
