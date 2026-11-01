import { cn } from "cn"
import type { ReactNode } from "react"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Tile de KPI: etiqueta chica y la cifra grande en mono. Sin valor (`undefined`) muestra el
 * skeleton; lo que va debajo de la cifra (barra, nota) entra como `children`.
 */
export function StatTile({
  label,
  value,
  className,
  valueClassName,
  children,
}: {
  label: ReactNode
  value: ReactNode
  className?: string
  valueClassName?: string
  children?: ReactNode
}) {
  return (
    <Card
      variant="outline"
      className={cn("flex flex-col gap-1 px-4 py-3.5", className)}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      {value === undefined ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <span
          className={cn(
            "font-mono text-[22px] font-semibold tracking-[-0.5px] tabular-nums",
            valueClassName
          )}
        >
          {value}
        </span>
      )}
      {children}
    </Card>
  )
}
