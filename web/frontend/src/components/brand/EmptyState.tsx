import { cn } from "cn"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

/** Estado vacío de una sección: ícono en un cuadro, título, explicación y una acción opcional. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-2.5 px-5 py-8 text-center",
        className
      )}
    >
      <span className="grid size-[52px] place-items-center rounded-[14px] bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-6" />
      </span>
      <p className="text-[15px] font-semibold">{title}</p>
      {children && (
        <p className="max-w-[42ch] text-[13px] text-pretty text-muted-foreground">
          {children}
        </p>
      )}
      {action}
    </div>
  )
}
