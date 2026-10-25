import { cn } from "cn"
import { BanIcon, TvIcon } from "lucide-react"
import type { MouseEvent } from "react"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  cancelReasonLabel,
  demoStatus,
  tvAddress,
  tvUrl,
  type DemoTone,
  type Tv,
} from "./labels"

// Piezas chicas que comparten el listado y la sala del mix.

const TONE: Record<DemoTone, string> = {
  up: "text-win",
  pending: "text-sidebar-primary",
  off: "text-muted-foreground",
}

/** Punto y texto del estado de la demo (listado). */
export function DemoStatus({ status }: { status: string }) {
  const d = demoStatus(status)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
        TONE[d.tone]
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {d.label}
    </span>
  )
}

/** Chip "EN VIVO" (fondo destructive, Geist Mono 10px, con punto que late). */
export function LiveChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit items-center gap-[5px] rounded-[calc(var(--radius)-4px)] bg-destructive px-[7px] font-mono text-[10px] font-semibold tracking-[.6px] text-white",
        className
      )}
    >
      <span
        aria-hidden
        className="size-1.5 animate-live rounded-full bg-current"
      />
      EN VIVO
    </span>
  )
}

/** Chip "Cancelada · {motivo}" con el ícono ban. */
export function CancelChip({ reason }: { reason: string | null }) {
  const label = cancelReasonLabel(reason)
  return (
    <span
      title={label}
      className="inline-flex h-[22px] items-center gap-1 rounded-[calc(var(--radius)-4px)] border px-2 text-xs font-medium whitespace-nowrap text-muted-foreground"
    >
      <BanIcon aria-hidden className="size-3" />
      Cancelada · {label}
    </span>
  )
}

/**
 * Abre Steam conectado al SourceTV del servidor. Es un link (`steam://`), así funciona con el
 * teclado y con "copiar dirección"; no dispara el clic de la fila que lo contiene.
 */
export function WatchTvButton({
  tv,
  label = "Ver en TV",
  className,
}: {
  tv: Tv
  label?: string
  className?: string
}) {
  const stop = (e: MouseEvent) => e.stopPropagation()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={tvUrl(tv)}
          onClick={stop}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-7 gap-1.5 px-2.5 text-xs",
            className
          )}
        >
          <TvIcon aria-hidden className="size-[13px]" />
          {label}
        </a>
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-mono">connect {tvAddress(tv)}</span>
      </TooltipContent>
    </Tooltip>
  )
}

/** MVP del listado: insignia de nivel, nick y rating. */
export function MvpCell({
  nick,
  level,
  rating,
}: {
  nick: string
  level: number | null
  rating: number | null
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {level !== null && <LevelBadge level={level} size={20} />}
      {nick}
      {rating !== null && (
        <span className="font-mono text-xs font-medium text-muted-foreground tabular-nums">
          {rating.toFixed(2)}
        </span>
      )}
    </span>
  )
}
