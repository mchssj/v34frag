import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import type { EventSummary } from "../types"

type Marked = Pick<EventSummary, "historic" | "testing" | "approval">

/** Etiquetas de un torneo: histórico, en testing, pendiente de aprobación o rechazado (replanteo 80). */
export function EventMarks({
  event,
  className,
}: {
  event: Marked
  className?: string
}) {
  const marks = [
    event.historic && {
      key: "historic",
      label: "Histórico",
      className: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    },
    event.testing && {
      key: "testing",
      label: "Testing",
      className: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    },
    event.approval === "pending" && {
      key: "pending",
      label: "Pendiente",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    },
    event.approval === "rejected" && {
      key: "rejected",
      label: "Rechazado",
      className: "bg-destructive/15 text-destructive",
    },
  ].filter((m): m is { key: string; label: string; className: string } => !!m)
  if (!marks.length) return null
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {marks.map((m) => (
        <Badge key={m.key} variant="muted" size="sm" className={m.className}>
          {m.label}
        </Badge>
      ))}
    </span>
  )
}
