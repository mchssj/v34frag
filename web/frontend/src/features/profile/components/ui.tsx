import { cn } from "cn"

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
