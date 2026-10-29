import { cn } from "cn"
import type { ReactNode } from "react"

import { errorMessage, isRetryable } from "@/api/errors"
import { Button } from "@/components/ui/button"
import type { Tone } from "./format"

// Piezas comunes de las pantallas de Administración (diseño aprobado el 2026-10-28).

export function AdminHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle: string
  action?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-[680px] flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-[-0.5px] wrap-anywhere">
          {title}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      </div>
      {action}
    </header>
  )
}

export type TabDef<K extends string> = { key: K; label: string; badge?: number }

/** Subpestañas bajo el título. El estado vive en la URL (`?tab=`). */
export function AdminTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: TabDef<K>[]
  value: K
  onChange: (k: K) => void
  label: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 overflow-x-auto border-b"
    >
      {tabs.map((t) => {
        const on = t.key === value
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={cn(
              "inline-flex h-11 items-center gap-2 border-b-2 px-3.5 text-sm whitespace-nowrap transition-colors",
              on
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {!!t.badge && (
              <span className="inline-grid h-5 min-w-5 place-items-center rounded-full bg-muted px-1.5 font-mono text-[11px] text-foreground">
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export type ChipOption<V> = { value: V; label: string; count?: number }

/** Filtros en píldoras: el activo va en `foreground` sólido, como en Ranking. */
export function FilterChips<V extends string | undefined>({
  options,
  value,
  onChange,
  label,
}: {
  options: ChipOption<V>[]
  value: V
  onChange: (v: V) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
              on
                ? "border-foreground bg-foreground font-semibold text-background"
                : "hover:bg-muted"
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className="font-mono opacity-70">{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

const TONES: Record<Tone, string> = {
  neutral: "border text-muted-foreground",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  danger: "bg-destructive/15 text-destructive",
  primary: "bg-primary/15 text-primary",
  win: "bg-win/15 text-foreground",
  strong: "bg-foreground text-background",
  vip: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
}

export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] w-fit items-center rounded-full px-2 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

/** Texto de aviso (ámbar) fuera de una píldora. */
export const warnText = "text-amber-700 dark:text-amber-400"

export function Dot({ tone }: { tone: "win" | "warn" | "danger" | "muted" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        tone === "win" && "bg-win",
        tone === "warn" && "bg-amber-500",
        tone === "danger" && "bg-destructive",
        tone === "muted" && "bg-muted-foreground"
      )}
    />
  )
}

/** Tarjeta de resumen: lleva a su subpestaña. */
export function StatTile({
  label,
  value,
  sub,
  warn,
  onClick,
}: {
  label: string
  value: ReactNode
  sub: string
  warn: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-1.5 rounded-xl border bg-card px-4 py-3.5 text-left transition-colors hover:bg-muted"
    >
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Dot tone={warn ? "warn" : "win"} />
        {label}
      </span>
      <span className="font-mono text-2xl font-semibold tracking-[-0.5px]">
        {value}
      </span>
      <span
        className={cn(
          "text-xs leading-snug",
          warn ? warnText : "text-muted-foreground"
        )}
      >
        {sub}
      </span>
    </button>
  )
}

/** Lista a la izquierda y panel a la derecha; en el teléfono se apilan. */
export function SplitLayout({
  main,
  aside,
  asideLabel,
}: {
  main: ReactNode
  aside: ReactNode
  asideLabel: string
}) {
  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
        {main}
      </div>
      <aside
        aria-label={asideLabel}
        className="flex min-w-0 flex-[1_1_360px] flex-col gap-4 rounded-xl border bg-card p-4"
      >
        {aside}
      </aside>
    </div>
  )
}

export function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4",
        className
      )}
    >
      {children}
    </div>
  )
}

/** Bloque del panel de detalle, separado por una línea. */
export function PanelSection({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5 border-t pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

/** Placeholder del panel cuando no hay nada elegido. */
export function PickHint({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-2 px-2 py-6 text-center text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">{title}</span>
      <span className="leading-relaxed">{text}</span>
    </div>
  )
}

/** Error de una consulta, con "Reintentar" si tiene sentido. */
export function QueryError({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm"
    >
      <span className="flex-1 text-destructive">{errorMessage(error)}</span>
      {isRetryable(error) && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

/** Clases de la cabecera de las tablas de Administración. */
export const headCell =
  "h-auto py-2.5 text-xs font-medium text-muted-foreground"

/** Contenedor de tabla con borde y scroll horizontal. */
export function TableBox({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">{children}</div>
  )
}

/** Pie de una tabla paginada: "Página n de m" con Anterior y Siguiente. Solo si hay más de una. */
export function Pager({
  page,
  total,
  per,
  onPage,
}: {
  page: number
  total: number
  per: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / per))
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2 border-t px-4 py-2.5 text-[13px] text-muted-foreground">
      Página {page} de {pages}
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Anterior
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Siguiente
      </Button>
    </div>
  )
}

/** Barra fija de "cambios sin guardar" de los formularios de Administración. */
export function SaveBar({
  title,
  hint,
  error,
  pending,
  disabled,
  saveLabel = "Guardar",
  onDiscard,
  onSave,
}: {
  title: string
  hint: string
  /** El texto de `hint` es un error (no deja guardar o falló). */
  error?: boolean
  pending: boolean
  disabled?: boolean
  saveLabel?: string
  onDiscard: () => void
  onSave: () => void
}) {
  return (
    <div
      role="region"
      aria-label="Cambios sin guardar"
      className="fixed bottom-5 left-1/2 z-40 flex w-[min(760px,calc(100%-32px))] -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl border bg-card py-3 pr-3.5 pl-4 shadow-xl"
    >
      <span className="flex min-w-[240px] flex-1 flex-col gap-0.5">
        <span className="font-semibold">{title}</span>
        <span
          className={cn(
            "text-xs",
            error ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {hint}
        </span>
      </span>
      <Button variant="outline" disabled={pending} onClick={onDiscard}>
        Descartar
      </Button>
      <Button disabled={disabled || pending} onClick={onSave}>
        {saveLabel}
      </Button>
    </div>
  )
}
