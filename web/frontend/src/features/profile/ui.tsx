import { cn } from "cn"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

/** Tarjeta de una sección de Mi perfil (radio + 4px). */
export function SectionCard({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn("overflow-hidden rounded-xl border bg-card", className)}
    >
      {children}
    </section>
  )
}

export function CardTitle({
  title,
  description,
  className,
}: {
  title: string
  description?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {description && (
        <p className="text-[13px] text-pretty text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}

/** Pie con la acción de guardar de la tarjeta. */
export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end gap-2 border-t bg-muted/50 px-5 py-3">
      {children}
    </div>
  )
}

/** Opciones segmentadas (radiogroup): tema, efectos… */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string; icon: LucideIcon }[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn(
        "flex w-fit max-w-full flex-wrap gap-0.5 rounded-lg border bg-muted p-[3px]",
        disabled && "opacity-50"
      )}
    >
      {options.map(({ value: v, label: l, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={!disabled && value === v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className="flex h-[30px] items-center gap-[7px] rounded-[calc(var(--radius)-4px)] px-3 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-sm"
        >
          <Icon className="size-3.5" aria-hidden />
          {l}
        </button>
      ))}
    </div>
  )
}
