import { cn } from "cn"
import type { ReactNode } from "react"

import { errorMessage } from "@/api/errors"
import type { RowData } from "@tanstack/react-table"
import { RetryButton, type QueryLike } from "@/components/brand/QueryState"
import { DataTable, type RowSelection } from "@/components/data-table/DataTable"
import { DataTablePagination } from "@/components/data-table/DataTablePagination"
import type { DataTableInstance } from "@/components/data-table/useServerTable"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge, type BadgeVariant } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { Tone } from "../lib/format"

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
  // Tabs de shadcn con el subrayado de Administración (primary, abajo). El contenido lo pone cada
  // página según `value`.
  return (
    <Tabs value={value} onValueChange={(k) => onChange(k as K)}>
      <TabsList
        variant="line"
        aria-label={label}
        className="h-auto w-full justify-start gap-1 overflow-x-auto overflow-y-hidden rounded-none border-b p-0 group-data-horizontal/tabs:h-auto"
      >
        {tabs.map((t) => (
          <TabsTrigger
            key={t.key}
            value={t.key}
            className="h-11 flex-none gap-2 rounded-none border-0 border-b-2 border-transparent px-3.5 font-normal text-muted-foreground after:hidden hover:text-foreground data-active:border-primary data-active:font-semibold data-active:text-foreground dark:data-active:border-primary dark:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-primary"
          >
            {t.label}
            {!!t.badge && (
              <span className="inline-grid h-5 min-w-5 place-items-center rounded-full bg-muted px-1.5 font-mono text-[11px] text-foreground">
                {t.badge}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

const TONES: Record<Tone, BadgeVariant> = {
  neutral: "neutral",
  warn: "warn",
  danger: "danger",
  primary: "primary",
  win: "winSoft",
  strong: "strong",
  vip: "vip",
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
    <Badge variant={TONES[tone]} shape="pill" size="md" className={className}>
      {children}
    </Badge>
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
    <Empty className="block flex-none rounded-xl border border-dashed p-6 text-sm text-wrap text-muted-foreground">
      {children}
    </Empty>
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
      <RetryButton error={error} onRetry={onRetry} />
    </div>
  )
}

/** Contenedor de tabla con borde y scroll horizontal. */
export function TableBox({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">{children}</div>
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

/**
 * Tabla paginada de Administración sobre DataTable: skeleton en bloque, error con "Reintentar",
 * vacío punteado y la tabla en su caja con "Página n de m" al pie.
 */
export function AdminTable<T extends RowData>({
  table,
  query,
  empty,
  className,
  loadingClassName = "h-80",
  rowClassName,
  selection,
}: {
  table: DataTableInstance<T>
  query: Pick<QueryLike<unknown>, "isPending" | "isError" | "error" | "refetch">
  empty: ReactNode
  className?: string
  /** Alto del skeleton mientras carga. */
  loadingClassName?: string
  rowClassName?: (row: T) => string | undefined
  selection?: RowSelection<T>
}) {
  return (
    <DataTable
      table={table}
      query={query}
      className={className}
      stateAs="block"
      loading={<Skeleton className={cn("rounded-xl", loadingClassName)} />}
      error={
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      }
      empty={<EmptyState>{empty}</EmptyState>}
      rowClassName={rowClassName}
      selection={selection}
      frame={(t) => (
        <TableBox>
          {t}
          <DataTablePagination table={table} mode="compact" />
        </TableBox>
      )}
    />
  )
}
