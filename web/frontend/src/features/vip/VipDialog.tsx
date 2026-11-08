import { ArrowUpRightIcon, HeartIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { COMMUNITY } from "@/config/site"

// "Cómo ser VIP" (Daniel, 2026-11-07): todavía no hay una forma definida, así que se escribe a un admin por Discord.
// La usan la página del Equipo y la tarjeta de visitas del perfil.

export function VipDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <span className="mb-1 grid size-11 place-items-center rounded-xl bg-yellow-500/15 text-yellow-600 dark:text-yellow-300">
            <HeartIcon aria-hidden className="size-5" />
          </span>
          <DialogTitle>Cómo ser VIP</DialogTitle>
          <DialogDescription>
            Comunícate con uno de nuestros administradores por Discord y te
            cuentan cómo sumarte.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cerrar</Button>
          </DialogClose>
          <a
            href={COMMUNITY.discordUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({
              className: "gap-1.5 bg-[#5865f2] text-white hover:bg-[#4752c4]",
            })}
          >
            Abrir Discord
            <ArrowUpRightIcon aria-hidden className="size-4" />
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
