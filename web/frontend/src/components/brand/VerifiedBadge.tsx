import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"
import { useRef, useState } from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Insignia de jugador verificado (replanteo 90, bitácora docs/bitacora/2026-11-09-jugadores-verificados): un sello con
// un check al lado del nick, como el de FACEIT. Gris (verificado) o dorada (verificado destacado); la pone un admin.
// Al pasar el mouse (o al tocarla en el teléfono) muestra qué se verificó y un link a la ayuda.

export type VerifiedKind = "gray" | "gold"

export const VERIFIED_LABEL: Record<VerifiedKind, string> = {
  gray: "Cuenta verificada",
  gold: "Cuenta verificada destacada",
}
/** El motivo cuando el admin no escribió uno. */
export const VERIFIED_DEFAULT_NOTE: Record<VerifiedKind, string> = {
  gray: "Verificación de identidad",
  gold: "Jugador destacado de la comunidad",
}

const TONE: Record<VerifiedKind, string> = {
  gray: "fill-zinc-300 dark:fill-zinc-200",
  gold: "fill-amber-400 drop-shadow-[0_0_4px_rgb(251_191_36/0.45)]",
}

/** El sello solo, sin la ficha: para listas y textos. */
export function VerifiedSeal({
  kind,
  className,
}: {
  kind: VerifiedKind
  className?: string
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-5", className)}>
      <path
        className={TONE[kind]}
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
      />
      <path
        d="m8.5 12 2.5 2.5 4.5-4.5"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-zinc-900"
      />
    </svg>
  )
}

/** El sello con su ficha. `note` es el motivo que escribió el admin (si no hay, uno por defecto). */
export function VerifiedBadge({
  kind,
  note,
  className,
  sealClassName,
}: {
  kind: VerifiedKind
  note?: string | null
  className?: string
  sealClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const closing = useRef<number | undefined>(undefined)
  // Se abre al pasar el mouse y se queda abierta mientras está encima del sello o de la ficha (para el link).
  const enter = () => {
    window.clearTimeout(closing.current)
    setOpen(true)
  }
  const leave = () => {
    closing.current = window.setTimeout(() => setOpen(false), 150)
  }
  const label = VERIFIED_LABEL[kind]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        onMouseEnter={enter}
        onMouseLeave={leave}
        className={cn(
          "inline-grid shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <VerifiedSeal kind={kind} className={sealClassName} />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        onMouseEnter={enter}
        onMouseLeave={leave}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="flex w-72 flex-col gap-0 p-0"
      >
        <p className="flex items-center gap-2 px-4 py-3 text-sm font-semibold">
          <VerifiedSeal kind={kind} className="size-[18px]" />
          {label}
        </p>
        <p className="flex items-center gap-2 border-t px-4 py-3 text-[13px]">
          <CheckIcon aria-hidden className="size-4 shrink-0" />
          {note || VERIFIED_DEFAULT_NOTE[kind]}
        </p>
        <p className="px-4 pb-3 text-xs text-muted-foreground">
          <Link
            to="/help/$seccion/$tarea"
            params={{ seccion: "jugador", tarea: "cuentas-verificadas" }}
            className="font-semibold text-primary hover:underline"
          >
            Saber más
          </Link>{" "}
          sobre la verificación de cuentas
        </p>
      </PopoverContent>
    </Popover>
  )
}

/**
 * El sello al lado de un nombre en una lista (ranking, buscador, amigos, la sala; replanteo 94). Sin insignia no muestra
 * nada. Lleva el texto para lectores de pantalla, porque el sello solo es un dibujo.
 */
export function ListSeal({
  kind,
  className,
}: {
  kind: VerifiedKind | null | undefined
  className?: string
}) {
  if (!kind) return null
  return (
    <span className="inline-flex shrink-0 items-center">
      <VerifiedSeal kind={kind} className={cn("size-4", className)} />
      <span className="sr-only">
        {kind === "gold" ? "(verificado destacado)" : "(verificado)"}
      </span>
    </span>
  )
}
