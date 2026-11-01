import type { ReactNode } from "react"

import { errorMessage, isRetryable } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Lo que estos componentes leen de un `useQuery`. */
export type QueryLike<T> = {
  isPending: boolean
  isError: boolean
  error: unknown
  data?: T
  refetch: () => unknown
}

/** "Reintentar", solo si el error es de los que se arreglan reintentando. */
export function RetryButton({
  error,
  onRetry,
  className,
}: {
  error: unknown
  onRetry: () => unknown
  className?: string
}) {
  if (!isRetryable(error)) return null
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => void onRetry()}
    >
      Reintentar
    </Button>
  )
}

/** Mensaje del error con "Reintentar" debajo; el contenedor lo pone quien lo usa. */
export function QueryErrorMessage({
  error,
  onRetry,
  message,
}: {
  error: unknown
  onRetry: () => unknown
  /** Texto propio en lugar del mensaje del error (por ejemplo, para un 404). */
  message?: ReactNode
}) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {message ?? errorMessage(error)}
      </p>
      <RetryButton error={error} onRetry={onRetry} className="mt-3" />
    </>
  )
}

/** Skeleton mientras carga, el error con reintento en una tarjeta o, si no, el contenido. */
export function QueryState<T>({
  q,
  pending = <Skeleton className="h-32 rounded-xl" />,
  children,
}: {
  q: QueryLike<T>
  pending?: ReactNode
  children: (data: T) => ReactNode
}) {
  if (q.isPending) return pending
  if (q.isError)
    return (
      <Card variant="outline" className="px-4 py-8 text-center">
        <QueryErrorMessage error={q.error} onRetry={q.refetch} />
      </Card>
    )
  return children(q.data as T)
}
