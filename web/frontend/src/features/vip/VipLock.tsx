import { cn } from "cn"
import { LockIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { VipDialog } from "./VipDialog"

/** Franja "esto es para VIP" con el botón que abre "Cómo ser VIP" (la misma de las visitas al perfil). */
export function VipLock({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-3 py-2.5",
        className
      )}
    >
      <LockIcon
        aria-hidden
        className="size-4 shrink-0 text-yellow-600 dark:text-yellow-300"
      />
      <span className="min-w-[180px] flex-1 text-[13px] leading-snug">
        {children}
      </span>
      <Button
        size="sm"
        className="bg-yellow-400 text-yellow-950 hover:bg-yellow-300"
        onClick={() => setOpen(true)}
      >
        Ser VIP
      </Button>
      <VipDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
