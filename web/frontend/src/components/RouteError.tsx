import { useRouter, type ErrorComponentProps } from "@tanstack/react-router"

import { errorMessage, isApiError } from "@/api/errors"
import { Button } from "@/components/ui/button"

/** Error al cargar una ruta (API caída, 500…). Reintentar vuelve a correr las guardas y loaders. */
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  const network = isApiError(error, "NETWORK")
  return (
    <main className="flex min-h-[60svh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-heading text-2xl font-semibold">
        {network ? "No se pudo conectar" : "Algo salió mal"}
      </h1>
      <p className="max-w-md text-muted-foreground">{errorMessage(error)}</p>
      <Button onClick={() => void router.invalidate()}>Reintentar</Button>
    </main>
  )
}
