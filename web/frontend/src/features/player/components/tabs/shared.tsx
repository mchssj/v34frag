import { useNavigate } from "@tanstack/react-router"
import { type ReactNode } from "react"
import { errorMessage, isRetryable } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { PlayerMatch } from "../../types"

/** Skeleton o error con reintento; si no, el contenido. */
export function Loaded<T>({
  q,
  children,
}: {
  q: {
    isPending: boolean
    isError: boolean
    error: unknown
    data?: T
    refetch: () => unknown
  }
  children: (data: T) => ReactNode
}) {
  if (q.isPending) return <Skeleton className="h-32 rounded-xl" />
  if (q.isError)
    return (
      <Card variant="outline" className="px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">{errorMessage(q.error)}</p>
        {isRetryable(q.error) && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void q.refetch()}
          >
            Reintentar
          </Button>
        )}
      </Card>
    )
  return children(q.data as T)
}

export function Delta({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted-foreground">—</span>
  return (
    <span className={v >= 0 ? "text-win" : "text-destructive"}>
      {v > 0 ? `+${v}` : v}
    </span>
  )
}

export const RESULT_CHIP = {
  V: "bg-win/18 text-win",
  D: "bg-destructive/15 text-destructive",
  E: "bg-muted text-muted-foreground",
}

export function useOpenMatch() {
  const navigate = useNavigate()
  return (m: PlayerMatch) =>
    void navigate({ to: "/match/$id", params: { id: m.match_id } })
}
