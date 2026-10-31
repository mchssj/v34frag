import { cn } from "cn"
import { type ReactNode } from "react"

import type { BadgeVariant } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

import { type RosterStatus } from "../lib/model"

/** Colores del chip de estado en el roster: Activo verde, Suplente gris, Coach naranja. */
export const STATUS_CHIP: Record<RosterStatus, BadgeVariant> = {
  player: "win",
  sub: "muted",
  coach: "primary",
}

/** Cuadrícula de fondo que se desvanece hacia los bordes ("Sin equipo", "Crear equipo"). */
export function GridBackdrop() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)] bg-[size:44px_44px] opacity-70"
    />
  )
}

/** Tarjeta de sección de la vista de equipo (radio + 6px). */
export function Panel({
  title,
  aside,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Card
      variant="outline"
      radius="hero"
      asChild
      className={cn("flex min-w-0 flex-col overflow-hidden", className)}
    >
      <section>
        {title && (
          <header className="flex items-center justify-between gap-3 border-b px-[18px] py-3.5">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {aside && (
              <span className="text-xs text-muted-foreground">{aside}</span>
            )}
          </header>
        )}
        <div className={cn("flex min-w-0 flex-1 flex-col", bodyClassName)}>
          {children}
        </div>
      </section>
    </Card>
  )
}

/** Etiqueta en mono y mayúsculas ("MIS EQUIPOS", "JUGADOR ESTRELLA"). */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "font-mono text-[11px] font-semibold tracking-[1px] uppercase",
        className
      )}
    >
      {children}
    </span>
  )
}
