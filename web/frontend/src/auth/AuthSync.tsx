import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { useEffect } from "react"

import { authKeys } from "./queries"
import { tokenStore } from "./tokenStore"

/**
 * Mantiene Query y el router al día con la sesión. Si se cierra (logout, otra pestaña o
 * renovación fallida) borra los datos privados de la caché. Si el cambio no lo inició esta
 * pestaña, re-ejecuta las guardas (por ejemplo, saca al login a quien está en una ruta privada).
 */
export function AuthSync() {
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(
    () =>
      tokenStore.subscribe((state, prev) => {
        const had = prev.session !== null
        const has = state.session !== null
        if (had === has) return

        if (!has) {
          queryClient.removeQueries()
          queryClient.setQueryData(authKeys.me, null)
        } else if (!queryClient.getQueryData(authKeys.me)) {
          void queryClient.invalidateQueries({ queryKey: authKeys.me })
        }

        if (state.lastChange !== "local") void router.invalidate()
      }),
    [queryClient, router]
  )

  return null
}
