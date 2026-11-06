import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { UserPlus } from "lucide-react"

import { errorMessage, isApiError } from "@/api/errors"
import { QueryState } from "@/components/brand/QueryState"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { mmKeys } from "./queries"
import { useMmSource } from "./source"
import type { MmReplaceInfo } from "./types"

// Página del link de reemplazo que sale en Discord (plan docs/bitacora/2026-11-04-mm-reemplazos). La base decide si se
// puede tomar; acá solo se muestra la partida y el botón. El token va en la ruta, nunca en logs ni mensajes.

const GONE: Record<Exclude<MmReplaceInfo["status"], "open">, string> = {
  taken: "Ya lo tomó otro jugador.",
  connected: "Ya lo tomó otro jugador.",
  expired: "Este link venció o la partida ya terminó.",
  cancelled: "Este pedido se cerró y se publicó otro aviso en Discord.",
}

export function ReplacePage({ token }: { token: string }) {
  const source = useMmSource()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const info = useQuery({
    queryKey: ["mm", "replace", token] as const,
    queryFn: ({ signal }) => source.replaceInfo(token, signal),
    retry: false,
  })
  const take = useMutation({
    mutationFn: () => source.replaceTake(token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: mmKeys.all })
      void navigate({ to: "/play" })
    },
    // Si otro llegó primero, se vuelve a pedir la info para mostrar el estado nuevo.
    onError: (e) => {
      if (isApiError(e, "CONFLICT")) void info.refetch()
    },
  })

  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      <h1 className="text-xl font-semibold">Reemplazo en el matchmaking</h1>
      <QueryState q={info}>
        {(d) => (
          <Card
            variant="outline"
            radius="xl"
            className="flex flex-col gap-4 p-5"
          >
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                Un jugador abandonó un mix en juego y su equipo quedó con uno
                menos.
              </p>
              <p className="text-lg font-semibold">
                {d.mode}
                {d.map && ` · ${d.map}`}
                {d.score && ` · ${d.score.a}-${d.score.b}`}
              </p>
              {d.team_name && (
                <p className="text-sm">
                  Entrarías a <span className="font-medium">{d.team_name}</span>
                  .
                </p>
              )}
            </div>
            {d.mine ? (
              <Button onClick={() => void navigate({ to: "/play" })}>
                Ir a la sala
              </Button>
            ) : d.status !== "open" ? (
              <p className="text-sm text-muted-foreground">{GONE[d.status]}</p>
            ) : d.reason ? (
              <p className="text-sm text-destructive">
                No puedes entrar: {d.reason}.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  El primero que entre se lo queda. Después tienes unos minutos
                  para conectarte al servidor: si no entras, se te sanciona como
                  a quien no se conecta a su partida. Ganas o pierdes ELO como
                  cualquiera, según las rondas que juegues.
                </p>
                <Button disabled={take.isPending} onClick={() => take.mutate()}>
                  <UserPlus />
                  Entrar como reemplazo
                </Button>
                {take.isError && (
                  <p className="text-sm text-destructive">
                    {errorMessage(take.error)}
                  </p>
                )}
              </>
            )}
          </Card>
        )}
      </QueryState>
    </div>
  )
}
