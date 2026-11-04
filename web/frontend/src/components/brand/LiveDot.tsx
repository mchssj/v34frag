import { cn } from "cn"

/** Punto que late para "en vivo" y "esperando". Respeta prefers-reduced-motion. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 animate-live rounded-full bg-destructive",
        className
      )}
    />
  )
}
