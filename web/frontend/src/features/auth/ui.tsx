import { cn } from "cn"
import { CircleAlertIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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

type FieldProps<T extends FieldValues> = {
  control: Control<T>
  name: Path<T>
  label: string
  type?: "text" | "email" | "password"
  autoComplete?: string
  placeholder?: string
  /** Muestra el error solo cuando el formulario ya intentó enviarse. */
  showError?: boolean
  children?: ReactNode
  inputProps?: Omit<ComponentProps<typeof Input>, "name" | "type">
}

export function AuthField<T extends FieldValues>({
  control,
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  showError = true,
  children,
  inputProps,
}: FieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const invalid = showError && fieldState.invalid
        const errorId = `${field.name}-error`
        return (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={field.name} className="text-[13px] font-medium">
              {label}
            </label>
            <Input
              {...field}
              {...inputProps}
              id={field.name}
              type={type}
              autoComplete={autoComplete}
              placeholder={placeholder}
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
              className={cn(
                "h-9 text-sm dark:bg-transparent",
                inputProps?.className
              )}
            />
            {children}
            {invalid && (
              <p id={errorId} className="text-xs text-destructive">
                {fieldState.error?.message}
              </p>
            )}
          </div>
        )
      }}
    />
  )
}

/** Error general del formulario, con acción opcional (por ejemplo "Reintentar"). */
export function ErrorAlert({
  message,
  action,
}: {
  message: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div
      role="alert"
      className="flex gap-2.5 rounded-lg border border-destructive/40 bg-destructive/8 px-3 py-2.5 text-[13px] text-destructive"
    >
      <CircleAlertIcon className="mt-px size-4 shrink-0" aria-hidden />
      <div className="flex flex-1 flex-col gap-1">
        <span>{message}</span>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="self-start text-xs font-semibold underline"
          >
            {action.label}
          </button>
        )}
      </div>
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
