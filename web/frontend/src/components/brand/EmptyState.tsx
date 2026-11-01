import { cn } from "cn"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

/**
 * Estado vacío de una sección sobre el Empty de shadcn: ícono en un cuadro, título, explicación y
 * una acción opcional.
 */
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
    <Empty
      className={cn(
        "gap-2.5 rounded-none border-0 px-5 py-8 text-wrap",
        className
      )}
    >
      <EmptyMedia
        variant="icon"
        className="mb-0 size-[52px] rounded-[14px] text-muted-foreground"
      >
        <Icon aria-hidden className="size-6" />
      </EmptyMedia>
      <EmptyTitle className="text-[15px] font-semibold tracking-normal">
        {title}
      </EmptyTitle>
      {children && (
        <EmptyDescription className="max-w-[42ch] text-[13px] leading-normal text-pretty">
          {children}
        </EmptyDescription>
      )}
      {action}
    </Empty>
  )
}
