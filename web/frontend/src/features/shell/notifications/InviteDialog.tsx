import { UserPlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Notification } from "./model"

/** Detalle de una invitación a un equipo, con Aceptar / Rechazar. */
export function InviteDialog({
  item,
  onClose,
  onResolve,
}: {
  item: Notification | null
  onClose: () => void
  onResolve: (resolution: "accepted" | "rejected") => void
}) {
  const invite = item?.invite
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="leading-design sm:max-w-[420px]">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <UserPlusIcon className="size-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-base leading-[normal] font-semibold">
              Invitación a {invite?.team}
            </DialogTitle>
            <DialogDescription>De {invite?.from}</DialogDescription>
          </div>
        </div>
        {invite?.message && (
          <p className="rounded-lg bg-muted px-3 py-2.5 text-sm">
            {invite.message}
          </p>
        )}
        {item?.resolution ? (
          <p className="text-sm text-muted-foreground">
            Ya la {item.resolution === "accepted" ? "aceptaste" : "rechazaste"}.
          </p>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => onResolve("rejected")}>
              Rechazar
            </Button>
            <Button onClick={() => onResolve("accepted")}>Aceptar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
