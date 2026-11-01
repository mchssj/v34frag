import { cn } from "cn"
import { type ReactNode } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
