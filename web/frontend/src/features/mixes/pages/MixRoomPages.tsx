import { useQuery } from "@tanstack/react-query"
import { Link, Navigate } from "@tanstack/react-router"
import type { ReactNode } from "react"

import { errorMessage, isApiError, isRetryable } from "@/api/errors"
import { canDeleteMix } from "@/auth/permissions"
import { useMe } from "@/auth/queries"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { mapsOptions } from "@/features/maps/api/queries"
import { mapImage } from "@/features/maps/lib/catalog"
import { myProfileOptions } from "@/features/profile/api/queries"
import { matchDetailOptions } from "@/features/shell/api/queries"
import { SeriesRoom } from "@/features/series/pages/SeriesRoom"
import { DeleteMixDialog } from "../components/DeleteMixDialog"
import { mixHighlights } from "../components/MixHighlights"
import { MixRoom } from "../components/MixRoom"
import { liveMixOptions } from "../api/queries"
import { roomFromLive, roomFromMatch } from "../lib/room"
import type { StatsTab } from "../lib/stats"

type TabProps = { tab?: StatsTab; onTab?: (tab: StatsTab) => void }

// Las dos salas del mix: la de una partida terminada o cancelada (/match/$id) y la en vivo
// (/mixes/live/$uid). Cargan los datos y arman el modelo común de room.ts.

function useMyPlayerId() {
  return useQuery(myProfileOptions).data?.player?.id ?? null
}

/** /match/$id: la sala si es un mix; la página de la serie si es de torneo o PCW. */
export function MixMatchRoom({
  id,
  tab,
  onTab,
  map,
  onMap,
}: { id: string } & TabProps & {
    map?: string
    onMap?: (gameId: string | undefined) => void
  }) {
  const match = useQuery(matchDetailOptions(id))
  const me = useMyPlayerId()
  const maps = useQuery(mapsOptions).data
  const role = useMe().data?.role

  if (match.isPending) return <RoomSkeleton />
  if (match.isError)
    return (
      <RoomMessage
        title={
          isApiError(match.error, "NOT_FOUND")
            ? "No encontramos esta partida"
            : "No se pudo cargar la partida"
        }
        text={errorMessage(match.error)}
        retry={
          isRetryable(match.error) ? () => void match.refetch() : undefined
        }
      />
    )

  const m = match.data
  // La serie del matchmaking (un contenedor de veto y chat): se muestra el mapa jugado.
  if ((m.kind as string) === "mm") {
    const game = (m as { games?: { id: string }[] }).games?.[0]
    if (game)
      return <Navigate to="/match/$id" params={{ id: game.id }} replace />
  }
  if (m.kind !== "mix")
    return (
      <SeriesRoom
        match={m}
        me={me}
        tab={tab}
        onTab={onTab}
        map={map}
        onMap={onMap}
      />
    )

  const room = roomFromMatch(m, me)
  // La API no borra un mix vinculado con !match a un torneo o PCW.
  const canDelete = !!role && canDeleteMix(role) && !m.parent_match_id
  return (
    <MixRoom
      room={room}
      mapImage={mapImage(maps, m.map)}
      highlights={
        room.status === "finished"
          ? mixHighlights(m.id, room, m.map)
          : undefined
      }
      tab={tab}
      onTab={onTab}
      adminAction={
        canDelete ? (
          <DeleteMixDialog
            matchId={m.id}
            movedElo={room.status === "finished"}
          />
        ) : undefined
      }
    />
  )
}

/** /mixes/live/$uid: se refresca cada 20 s; un 404 quiere decir que el mix terminó. */
export function MixLiveRoom({ uid, tab, onTab }: { uid: string } & TabProps) {
  const live = useQuery(liveMixOptions(uid))
  const me = useMyPlayerId()
  const maps = useQuery(mapsOptions).data

  if (live.isPending) return <RoomSkeleton />
  if (live.isError) {
    if (isApiError(live.error, "NOT_FOUND"))
      return (
        <RoomMessage
          title="Este mix terminó."
          text="Su resultado ya está en el listado de mixes."
        />
      )
    return (
      <RoomMessage
        title="No se pudo cargar el mix"
        text={errorMessage(live.error)}
        retry={isRetryable(live.error) ? () => void live.refetch() : undefined}
      />
    )
  }
  return (
    <MixRoom
      room={roomFromLive(live.data, me)}
      mapImage={mapImage(maps, live.data.map)}
      tab={tab}
      onTab={onTab}
    />
  )
}

function RoomSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <Skeleton className="h-[30px] w-48" />
      <Skeleton className="h-[180px] w-full rounded-xl" />
      <Skeleton className="h-[260px] w-full rounded-xl" />
      <Skeleton className="h-[260px] w-full rounded-xl" />
    </div>
  )
}

function RoomMessage({
  title,
  text,
  retry,
}: {
  title: string
  text: ReactNode
  retry?: () => void
}) {
  return (
    <section className="flex flex-col items-start gap-3">
      <h1 className="text-2xl font-semibold tracking-[-0.4px]">{title}</h1>
      <p className="text-sm text-muted-foreground">{text}</p>
      <div className="flex gap-2">
        {retry && (
          <Button variant="outline" onClick={retry}>
            Reintentar
          </Button>
        )}
        <Button asChild>
          <Link to="/matches" search={{ kind: "mix" }}>
            Ver mixes
          </Link>
        </Button>
      </div>
    </section>
  )
}
