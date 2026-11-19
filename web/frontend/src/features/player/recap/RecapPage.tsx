import { useQuery } from "@tanstack/react-query"
import { LoaderIcon, XIcon } from "lucide-react"
import { useMemo } from "react"

import { isApiError } from "@/api/errors"
import { QueryErrorMessage } from "@/components/brand/QueryState"
import { Button } from "@/components/ui/button"
import { seasonRecapOptions } from "../api/queries"
import { RecapViewer } from "./RecapViewer"
import { fromApi } from "./types"

/** La ruta del recap: pide los datos y abre el visor a pantalla completa. */
export function RecapPage({
  nick,
  season,
  onClose,
}: {
  nick: string
  season: number
  onClose: () => void
}) {
  const q = useQuery(seasonRecapOptions(nick, season))
  const recap = useMemo(() => (q.data ? fromApi(q.data) : null), [q.data])
  if (recap) return <RecapViewer recap={recap} onClose={onClose} />
  return (
    <div className="dark fixed inset-0 z-50 grid place-items-center bg-black/90 px-6 text-center text-foreground">
      {q.isPending ? (
        <LoaderIcon
          aria-label="Cargando el recap"
          className="size-8 animate-spin text-muted-foreground"
        />
      ) : (
        <div className="flex max-w-sm flex-col items-center gap-4">
          <QueryErrorMessage
            error={q.error}
            onRetry={q.refetch}
            message={
              isApiError(q.error, "NOT_FOUND")
                ? "No hay recap de esta temporada: o todavía no terminó (se publica al cerrarla) o este jugador no jugó ningún mix."
                : undefined
            }
          />
          <Button variant="outline" onClick={onClose}>
            <XIcon /> Volver al perfil
          </Button>
        </div>
      )}
    </div>
  )
}
