import { cn } from "cn"
import type { ReactNode } from "react"

import { TeamCrest } from "@/features/teams/components/ui"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Empty } from "@/components/ui/empty"
import { STATUS_CHIP, STATUS_LABEL, type EventStatus } from "../lib/model"

export function StatusChip({
  status,
  className,
}: {
  status: EventStatus
  className?: string
}) {
  return (
    <Badge
      variant={STATUS_CHIP[status]}
      shape="soft"
      size="md"
      className={cn(status === "cancelled" && "bg-background", className)}
    >
      {STATUS_LABEL[status]}
    </Badge>
  )
}

/** Banner del torneo (4:1); sin imagen, el patrón rayado del diseño. */
export function EventBanner({
  url,
  className,
  children,
}: {
  url?: string | null
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-[repeating-linear-gradient(135deg,var(--muted)_0_10px,transparent_10px_20px)]",
        className
      )}
    >
      {url && (
        <img
          src={url}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {children}
    </div>
  )
}

/** Escudo chico del equipo (inscritos y llave); sin equipo todavía, un cuadro punteado. */
export function TagBox({
  team,
  className,
}: {
  team: { name: string; tag: string | null; logo_url?: string | null } | null
  className?: string
}) {
  if (team) return <TeamCrest team={team} size="xs" className={className} />
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-[5px] border border-dashed font-mono text-[9px] text-muted-foreground",
        className
      )}
    >
      —
    </span>
  )
}

/** Tarjeta con título de las pestañas (padding 20px). */
export function SectionCard({
  title,
  aside,
  children,
  className,
}: {
  title: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card
      variant="outline"
      asChild
      className={cn("flex min-w-0 flex-col gap-3 p-5", className)}
    >
      <section>
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {aside}
        </header>
        {children}
      </section>
    </Card>
  )
}

/** Recuadro punteado para lo que todavía no existe (llave sin fixture, sin grupos…). */
export function EmptyBox({ children }: { children: ReactNode }) {
  return (
    <Empty className="block flex-none rounded-[calc(var(--radius)+4px)] border border-dashed px-6 py-12 text-sm text-pretty text-muted-foreground">
      {children}
    </Empty>
  )
}
