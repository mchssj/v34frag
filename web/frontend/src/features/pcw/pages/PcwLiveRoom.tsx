import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Skeleton } from "@/components/ui/skeleton"
import { apiMmSource } from "@/features/matchmaking/apiSource"
import type { MmSource } from "@/features/matchmaking/source"
import type { MmState } from "@/features/matchmaking/types"
import { matchDetailOptions } from "@/features/shell/api/queries"
import { shellKeys } from "@/features/shell/api/keys"
import {
  bookingKeys,
  bookingOptions,
  useSetReady,
} from "@/features/series/api/booking"
import { pcwKeys } from "../api/queries"
import { seriesToMatch } from "../lib/adapt"
import type { PcwSide } from "../types"
import { PcwRoom } from "./PcwRoom"

// La sala de una PCW de verdad (bitácora 2026-11-08-pcw-real): la sala de Kyan (PcwRoom, la del matchmaking) con la
// serie de la base: GET /matches/{id} (veto, mapas jugados) y su reserva (GET /matches/{id}/booking, replanteo 56).

/** Sin socket para la serie: la sala se vuelve a pedir cada 5 s (como la página de la serie). */
const ROOM_MS = 5_000

export function PcwLiveRoom({
  matchId,
  sides,
  meId,
  mapImage,
  onBack,
  onRoom,
}: {
  matchId: string
  /** Los dos bandos con su roster y su ELO (de Mis PCW), en el orden de la partida. */
  sides: { 1: PcwSide; 2: PcwSide } | null
  meId: string
  mapImage: (name: string) => string | null
  onBack: () => void
  onRoom: (id: string | null) => void
}) {
  const qc = useQueryClient()
  const detail = useQuery({
    ...matchDetailOptions(matchId),
    refetchInterval: ROOM_MS,
  })
  const booking = useQuery({
    ...bookingOptions(matchId),
    refetchInterval: ROOM_MS,
  })
  const unready = useSetReady(matchId)
  // Después de vetar, se vuelve a pedir la serie y la lista.
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: shellKeys.match(matchId) })
    void qc.invalidateQueries({ queryKey: bookingKeys.booking(matchId) })
    void qc.invalidateQueries({ queryKey: pcwKeys.myMatches })
  }
  const [source] = useState(() => liveRoomSource(refresh))

  if (!detail.data || !booking.data)
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )

  const m = seriesToMatch(detail.data, booking.data, sides)
  const canVeto = booking.data.can_veto
  return (
    <PcwRoom
      m={m}
      onBack={onBack}
      series={{
        onRoom,
        onVeto: () => {},
        onUnready: () =>
          unready.mutate(false, {
            onSuccess: () => {
              void qc.invalidateQueries({ queryKey: pcwKeys.myMatches })
              toast("Ya no están listos", {
                description:
                  "Cuando los dos vuelvan a marcar Listos, sigue la serie.",
              })
            },
            onError: (e) => toast.error(errorMessage(e)),
          }),
        onFinishMap: () => {},
        onDismiss: () => {},
      }}
      meId={meId}
      mapImage={mapImage}
      source={source}
      // Veta quien puede ahora (el capitán de su lado, en su turno): la base lo dice en can_veto.
      isCaptain={(p) => p.id === meId && canVeto}
      refetchMs={ROOM_MS}
    />
  )
}

/**
 * Lo que la sala le pide a su fuente, con la API: el veto y el chat de la partida (los de siempre), y amigo y bloqueo
 * del matchmaking. La denuncia no va por la sala.
 */
function liveRoomSource(refresh: () => void): MmSource {
  const empty = {} as MmState
  const known: Partial<MmSource> = {
    async veto(matchId, map) {
      try {
        await apiMmSource.veto(matchId, map)
      } finally {
        refresh()
      }
      return empty
    },
    // El de equipo lo separa la base por lado (replanteo 102).
    chat: (matchId, signal) => apiMmSource.chat(matchId, signal),
    sendChat: (matchId, message, teamOnly) =>
      apiMmSource.sendChat(matchId, message, teamOnly),
    async report() {
      throw new Error(
        "Para denunciar a alguien de una PCW, escribile a un moderador por Discord."
      )
    },
    async commend() {
      return empty
    },
    addFriend: (id) => apiMmSource.addFriend(id),
    block: (id) => apiMmSource.block(id),
  }
  return new Proxy(known as MmSource, {
    get(target, prop) {
      if (prop in target) return target[prop as keyof MmSource]
      return () =>
        Promise.reject(new Error("No está disponible en la sala de una PCW"))
    },
  })
}
