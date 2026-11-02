import { useQuery } from "@tanstack/react-query"

import { gameClipsOptions } from "@/features/series/api/queries"
import { Highlights } from "@/features/matchmaking/room/Highlights"
import { MvpAndLeaders } from "@/features/matchmaking/room/RoomStats"
import { fetchMvpImage } from "@/features/matchmaking/source"
import type { MmClip } from "@/features/matchmaking/types"
import type { Room } from "../lib/room"

// El detalle de un mix terminado con lo de la sala del matchmaking: MVP y destacados arriba de las
// tablas y "Lo más destacado" (los clips automáticos) debajo.

const mvpImageOptions = {
  queryKey: ["mm", "mvp-image"] as const,
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchMvpImage(signal),
  staleTime: 5 * 60_000,
}

/** "de_dust2" → "Dust2", como el pool del veto de la sala. */
const mapLabel = (map: string) => {
  const name = map.replace(/^[a-z]+_/, "")
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function mixHighlights(matchId: string, room: Room, map: string | null) {
  return {
    top: <MixMvp room={room} />,
    bottom: <MixClips matchId={matchId} map={map} />,
  }
}

function MixMvp({ room }: { room: Room }) {
  // Sin la imagen (o si la API no la tiene todavía), la tarjeta queda lisa.
  const image = useQuery(mvpImageOptions).data ?? null
  const stats = [...room.side1.players, ...room.side2.players]
  if (!stats.length) return null
  return (
    <MvpAndLeaders
      stats={stats}
      image={image}
      playerOf={(key) => {
        const p = stats.find((s) => s.key === key)
        return p ? { nick: p.nick, photo_url: null } : undefined
      }}
    />
  )
}

function MixClips({ matchId, map }: { matchId: string; map: string | null }) {
  const clips = useQuery(gameClipsOptions(matchId)).data?.items
  if (!clips?.length) return null
  const items: MmClip[] = clips.map((c) => ({
    id: c.id,
    type: c.type,
    round: c.round,
    player_id: c.player?.id ?? null,
    nick: c.player?.alias ?? c.game_nick,
    kills: c.kills,
    video: c.video,
  }))
  return (
    <Highlights
      clips={items}
      players={[]}
      mapName={map ? mapLabel(map) : null}
      poster={null}
    />
  )
}
