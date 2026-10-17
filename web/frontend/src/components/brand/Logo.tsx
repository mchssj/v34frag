import { cn } from "cn"

import { Wordmark } from "./Wordmark"

/** Marca CSSTV: cuadro "TV" + wordmark. El contenedor (link o botón) lo pone quien la usa. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid size-[30px] place-items-center rounded-lg bg-sidebar-primary text-[11px] font-extrabold text-sidebar-primary-foreground"
      >
        TV
      </span>
      <Wordmark className="text-[17px] leading-none tracking-[-0.6px]" />
    </span>
  )
}
