import { Link, type LinkProps } from "@tanstack/react-router"
import { cn } from "cn"
import { ChevronRightIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Card } from "@/components/ui/card"

/** Tarjeta de un bloque de "Para ti": título, subtítulo opcional y un link o algo a la derecha. */
export function Box({
  title,
  sub,
  aside,
  label,
  className,
  children,
}: {
  title: ReactNode
  sub?: string
  aside?: ReactNode
  /** Nombre accesible de la sección (si el título no es texto). */
  label?: string
  className?: string
  children: ReactNode
}) {
  return (
    <Card asChild variant="outline" className={cn("flex flex-col", className)}>
      <section
        aria-label={label ?? (typeof title === "string" ? title : undefined)}
      >
        <header className="flex items-center gap-2 px-4 pt-3.5 pb-2.5">
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              {title}
            </h2>
            {sub && (
              <span className="text-xs text-muted-foreground">{sub}</span>
            )}
          </div>
          {aside}
        </header>
        {children}
      </section>
    </Card>
  )
}

/** Link discreto del encabezado ("Ver todas", "Tabla"). */
export function BoxLink({
  children,
  ...link
}: LinkProps & { children: ReactNode }) {
  return (
    <Link
      {...link}
      className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
      <ChevronRightIcon aria-hidden className="size-3.5" />
    </Link>
  )
}
