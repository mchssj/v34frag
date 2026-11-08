import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { UserPlus } from "lucide-react"

import heroImage from "@/assets/landing-bg.webp"
import { errorMessage, isApiError } from "@/api/errors"
import { QueryState } from "@/components/brand/QueryState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { fmtClock, secondsLeft } from "./labels"
import { mmKeys } from "./queries"
import { RoomHeader } from "./room/RoomHeader"
import { RoomOverview } from "./room/RoomOverview"
import { teamLabel } from "./room/roomData"
import { useMmSource } from "./source"
import type { MmLobby, MmReplaceInfo } from "./types"
import { useNow } from "./useNow"

// Página del link de reemplazo que sale en Discord (plan docs/bitacora/2026-11-04-mm-reemplazos). Desde el replanteo 78
// muestra la sala en vista previa (sin la IP ni la contraseña, que llegan al tomar el lugar). La base decide si se puede
// tomar; el token va en la ruta, nunca en logs ni mensajes.

const GONE: Record<Exclude<MmReplaceInfo["status"], "open">, string> = {
  taken: "Ya lo tomó otro jugador.",
  connected: "Ya lo tomó otro jugador.",
  expired: "Este link venció o la partida ya terminó.",
  cancelled: "Este pedido se cerró y se publicó otro aviso en Discord.",
}

const RULES = [
  "Después tienes unos minutos para conectarte. Si no entras, te llevas la sanción de no conectarte.",
  "Ganas o pierdes ELO como cualquiera, según las rondas que juegues.",
]

/** La sala del link sin lo que la base no manda en la vista previa. */
const asRoom = (room: MmLobby): MmLobby => ({
  ...room,
  server: null,
  reported: room.reported ?? [],
  commended: room.commended ?? null,
  elo_stake: room.elo_stake ?? null,
})

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
    <QueryState q={info}>
      {(d) =>
        d.room && d.status === "open" && !d.mine ? (
          <Preview
            info={d}
            room={asRoom(d.room)}
            take={() => take.mutate()}
            taking={take.isPending}
            error={take.isError ? errorMessage(take.error) : null}
          />
        ) : (
          <div className="flex w-full max-w-lg flex-col gap-4">
            <h1 className="text-xl font-semibold">
              Reemplazo en el matchmaking
            </h1>
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
                    Entrarías a{" "}
                    <span className="font-medium">{d.team_name}</span>.
                  </p>
                )}
              </div>
              {d.mine ? (
                <Button onClick={() => void navigate({ to: "/play" })}>
                  Ir a la sala
                </Button>
              ) : d.status !== "open" ? (
                <p className="text-sm text-muted-foreground">
                  {GONE[d.status]}
                </p>
              ) : d.reason ? (
                <p className="text-sm text-destructive">
                  No puedes entrar: {d.reason}.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    El primero que entre se lo queda. {RULES.join(" ")}
                  </p>
                  <Button
                    disabled={take.isPending}
                    onClick={() => take.mutate()}
                  >
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
          </div>
        )
      }
    </QueryState>
  )
}

/** La sala en vista previa: los equipos con el lugar libre y, en el centro, el botón para tomarlo. */
function Preview({
  info,
  room,
  take,
  taking,
  error,
}: {
  info: MmReplaceInfo
  room: MmLobby
  take: () => void
  taking: boolean
  error: string | null
}) {
  const map = room.veto?.pool.find((m) => m.name === room.map) ?? null
  return (
    <section
      aria-label="Reemplazo en el matchmaking"
      className="flex w-full flex-col gap-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[13px] text-muted-foreground">
          Sala de la partida
        </h1>
        <Badge variant="primary" size="sm" className="sm:ml-3">
          Se busca reemplazo · vista previa
        </Badge>
      </div>
      <RoomHeader
        lobby={room}
        backdrop={map?.image_url ?? heroImage}
        mapName={map?.label ?? null}
      />
      <RoomOverview
        lobby={room}
        map={map}
        mode="preview"
        takeCard={
          <TakeCard
            info={info}
            room={room}
            take={take}
            taking={taking}
            error={error}
          />
        }
      />
    </section>
  )
}

function TakeCard({
  info,
  room,
  take,
  taking,
  error,
}: {
  info: MmReplaceInfo
  room: MmLobby
  take: () => void
  taking: boolean
  error: string | null
}) {
  const now = useNow(true)
  const who = info.replaced_nick ?? "Un jugador"
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/50 bg-primary/6 p-4">
      <h2 className="text-sm font-semibold">Se busca un reemplazo</h2>
      <p className="text-sm text-muted-foreground">
        {who} abandonó y {teamLabel(room, info.team)} quedó con uno menos. El
        primero que toma el lugar entra.
      </p>
      <p
        role="timer"
        className="font-mono text-xs text-muted-foreground tabular-nums"
      >
        El link vence en {fmtClock(secondsLeft(info.expires_at, now) * 1000)}
      </p>
      {info.reason ? (
        <p className="text-sm text-destructive">
          No puedes entrar: {info.reason}.
        </p>
      ) : (
        <>
          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs text-muted-foreground">
            {RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <Button size="lg" disabled={taking} onClick={take}>
            <UserPlus />
            Entrar como reemplazo
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </>
      )}
    </div>
  )
}
