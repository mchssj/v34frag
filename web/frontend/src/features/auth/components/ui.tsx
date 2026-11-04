import { cn } from "cn"
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import type { ComponentProps, ReactNode } from "react"

import { Button } from "@/components/ui/button"

// Piezas comunes de Login, Registro y Bienvenida, con las medidas del handoff.

export function AuthHeading({
  title,
  subtitle,
  center = false,
  size = "md",
}: {
  title: string
  subtitle?: ReactNode
  center?: boolean
  size?: "md" | "lg"
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", center && "text-center")}>
      <h1
        className={cn(
          "font-semibold",
          size === "lg"
            ? "text-[26px] tracking-[-0.6px]"
            : "text-2xl tracking-[-0.5px]"
        )}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm text-pretty text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}

export function StepProgress({
  total,
  current,
  label,
  onBack,
}: {
  total: number
  current: number
  label: string
  onBack?: () => void
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="flex gap-1"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label={label}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-[2px]",
              i < current ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="hover:text-foreground"
          >
            ← Atrás
          </button>
        )}
      </div>
    </div>
  )
}

/** Botón principal de un paso: se ve atenuado mientras el paso no es válido. */
export function StepButton({
  ready,
  className,
  ...props
}: ComponentProps<typeof Button> & { ready: boolean }) {
  return (
    <Button
      size="lg"
      aria-disabled={!ready || undefined}
      className={cn(
        "px-[18px] text-sm",
        !ready &&
          "bg-[color-mix(in_oklch,var(--primary)_45%,var(--muted))] hover:bg-[color-mix(in_oklch,var(--primary)_45%,var(--muted))]",
        className
      )}
      {...props}
    />
  )
}

/** Aviso arriba de un formulario de Login o Recuperación (mismo aspecto que el de la cuenta confirmada). */
export function AuthNotice({
  tone,
  children,
}: {
  tone: "ok" | "error"
  children: ReactNode
}) {
  const Icon = tone === "ok" ? CircleCheckIcon : CircleAlertIcon
  return (
    <p
      role={tone === "ok" ? "status" : "alert"}
      className={cn(
        "flex gap-2.5 rounded-lg border px-3 py-2.5 text-[13px]",
        tone === "ok"
          ? "border-win/40 bg-win/8 text-win"
          : "border-destructive/40 bg-destructive/8 text-destructive"
      )}
    >
      <Icon className="mt-px size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}
