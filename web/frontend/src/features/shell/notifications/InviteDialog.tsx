import { UserPlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Described, Notification } from "./model"

/** Detalle de una invitación a un equipo, con Aceptar / Rechazar. */
export function InviteDialog({
  item,
  d,
  resolution,
  onClose,
  onResolve,
}: {
  item: Notification | null
  d: Described | null
  /** Cómo terminó, si ya se respondió. */
  resolution: string | null
  onClose: () => void
  onResolve: (resolution: "accepted" | "rejected") => void
}) {
  const from = item?.actor?.alias
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="leading-design sm:max-w-[420px]">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <UserPlusIcon className="size-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-base leading-[normal] font-semibold">
              {d?.title}
            </DialogTitle>
            <DialogDescription>
              {from ? `De ${from}` : d?.body}
            </DialogDescription>
          </div>
        </div>
        {resolution ? (
          <p className="text-sm text-muted-foreground">{resolution}.</p>
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
