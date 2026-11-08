import { Link, useRouter } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"

import type { AppPath } from "@/features/shell/lib/nav"

type Fallback = {
  to: AppPath
  params?: Record<string, string>
  search?: Record<string, unknown>
}

/**
 * Flecha de volver: si se llegó navegando dentro de la web, vuelve al paso anterior del historial
 * ("Volver"); si se entró directo (un link compartido), va a `fallback` con su propio texto.
 */
export function BackButton({
  fallback,
  label,
  className,
  iconClassName = "size-4",
}: {
  fallback: Fallback
  /** Texto cuando no hay a dónde volver: el nombre de la sección de `fallback`. */
  label: string
  className?: string
  iconClassName?: string
}) {
  // Igual que useCanGoBack, pero sin exigir un router montado (las pruebas simulan Link).
  const router = useRouter({ warn: false }) as ReturnType<typeof useRouter> | null
  const index = router?.stores.location.get().state.__TSR_index ?? 0
  const canGoBack = index > 0
  return (
    <Link
      to={fallback.to}
      params={fallback.params as never}
      search={fallback.search as never}
      className={className}
      onClick={(e) => {
        if (
          !canGoBack ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.button !== 0
        )
          return
        e.preventDefault()
        router?.history.back()
      }}
    >
      <ArrowLeftIcon aria-hidden className={iconClassName} />
      {canGoBack ? "Volver" : label}
    </Link>
  )
}
