import type { ReactNode } from "react"

/** Vista todavía sin implementar: título y aviso. Cada una se reemplaza con su handoff. */
export function Placeholder({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-[-0.5px] wrap-anywhere">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">Próximamente.</p>
      {children}
    </section>
  )
}
