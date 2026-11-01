import { cn } from "cn"
import { CheckIcon } from "lucide-react"

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
import type { MmLobby } from "./types"
import { useNow } from "./useNow"

const ACCEPT_SECONDS = 20

/** Confirmación de partida (estado `accepting`): cuenta regresiva y quién ya aceptó. */
export function AcceptDialog({
  lobby,
  onAccept,
  onDecline,
  pending,
}: {
  lobby: MmLobby
  onAccept: () => void
  onDecline: () => void
  pending: boolean
}) {
  const now = useNow(true, 250)
  const left = secondsLeft(lobby.accept_deadline, now)
  const accepted = lobby.players.filter((p) => p.accepted).length
  const meAccepted = lobby.players.some((p) => p.is_me && p.accepted)

  return (
    // Se cierra solo cuando cambia el estado; no con Escape ni clic afuera.
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        className="sm:max-w-[440px]"
      >
        <DialogHeader>
          <DialogTitle>Partida encontrada</DialogTitle>
          <DialogDescription>
            {lobby.map ?? "Mapa al azar"} · 5v5 ·{" "}
            {meAccepted
              ? "esperando al resto"
              : "aceptá antes de que termine el tiempo"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          <span
            role="timer"
            aria-label={`${left} segundos para aceptar`}
            className={cn(
              "font-mono text-5xl font-bold tabular-nums",
              left <= 5 && "text-destructive"
            )}
          >
            {left}
          </span>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            aria-hidden
          >
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${(left / ACCEPT_SECONDS) * 100}%` }}
            />
          </div>
          <ul
            aria-label={`${accepted} de ${lobby.players.length} aceptaron`}
            className="flex gap-1.5"
          >
            {lobby.players.map((p) => (
              <li
                key={p.player_id}
                title={p.is_me ? "Vos" : p.nick}
                className={cn(
                  "grid size-6 place-items-center rounded-md border",
                  p.accepted
                    ? "border-win bg-win/15 text-win"
                    : "text-muted-foreground"
                )}
              >
                {p.accepted && <CheckIcon className="size-3.5" aria-hidden />}
              </li>
            ))}
          </ul>
          <span className="text-xs text-muted-foreground">
            {accepted} de {lobby.players.length} aceptaron
          </span>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onDecline}
            disabled={pending || meAccepted}
          >
            Rechazar
          </Button>
          <Button
            size="md"
            onClick={onAccept}
            disabled={pending || meAccepted}
            autoFocus
          >
            {meAccepted ? "Aceptada" : "Aceptar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
