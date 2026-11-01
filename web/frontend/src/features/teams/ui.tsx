import { cn } from "cn"
import { useState, type ReactNode } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { crestText, type RosterStatus } from "./model"

/** Colores del chip de estado en el roster: Activo verde, Suplente gris, Coach naranja. */
export const STATUS_CHIP: Record<RosterStatus, string> = {
  player: "bg-win/15 text-win",
  sub: "bg-muted text-muted-foreground",
  coach: "bg-primary/15 text-primary",
}

/**
 * Escudo del equipo: el logo si tiene; si no (o si no carga), la sigla o las iniciales sobre
 * `foreground`.
 */
export function TeamCrest({
  team,
  size = "md",
  className,
}: {
  team: { name: string; tag: string | null; logo_url?: string | null }
  size?: "xs" | "row" | "sm" | "md" | "lg" | "xl"
  className?: string
}) {
  // La URL que falló: si el equipo cambia de logo, la nueva se vuelve a intentar.
  const [failed, setFailed] = useState<string | null>(null)
  const logo = team.logo_url && team.logo_url !== failed ? team.logo_url : null
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden font-mono font-bold",
        logo ? "border bg-card" : "bg-foreground text-background",
        {
          xs: "size-6 rounded-[5px] text-[9px]",
          row: "size-8 rounded-md text-[10px]",
          sm: "size-11 rounded-md text-xs",
          md: "size-14 rounded-lg text-sm",
          // En teléfono el escudo achica para que entre el nombre.
          lg: "size-16 rounded-[14px] text-xl tracking-[-0.5px] shadow-[0_4px_0_var(--primary)] sm:size-[104px] sm:rounded-[18px] sm:text-3xl sm:tracking-[-1px] sm:shadow-[0_5px_0_var(--primary)]",
          xl: "size-[120px] rounded-[20px] text-4xl tracking-[-1px] shadow-[0_5px_0_var(--primary)]",
        }[size],
        className
      )}
    >
      {logo ? (
        <img
          src={logo}
          alt=""
          onError={() => setFailed(logo)}
          className="size-full object-cover"
        />
      ) : (
        crestText(team)
      )}
    </span>
  )
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
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-hero border bg-card",
        className
      )}
    >
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

/**
 * Control que el backend todavía no permite: se ve como en el diseño, deshabilitado y con
 * "Próximamente". Un elemento deshabilitado no recibe el puntero: el tooltip va en un contenedor
 * enfocable.
 */
export function Soon({
  children,
  label = "Próximamente",
  className,
}: {
  children: ReactNode
  label?: string
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            className
          )}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Foto del jugador o, si no tiene o no carga, la inicial del alias en un círculo. */
export function Initial({
  name,
  photo,
  className,
  fallbackClassName,
}: {
  name: string
  photo?: string | null
  className?: string
  fallbackClassName?: string
}) {
  return (
    <Avatar aria-hidden className={cn("shrink-0", className)}>
      {photo && <AvatarImage src={photo} alt="" />}
      <AvatarFallback
        className={cn(
          "bg-secondary font-semibold text-secondary-foreground",
          fallbackClassName
        )}
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </AvatarFallback>
    </Avatar>
  )
}
