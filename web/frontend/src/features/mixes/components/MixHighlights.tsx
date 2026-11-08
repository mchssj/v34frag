import { useQueries, useQuery } from "@tanstack/react-query"

import { mapsOptions } from "@/features/maps/api/queries"
import { mapImage } from "@/features/maps/lib/catalog"
import { gameClipsOptions } from "@/features/series/api/queries"
import { Highlights } from "@/features/matchmaking/room/Highlights"
import { MvpAndLeaders } from "@/features/matchmaking/room/RoomStats"
import { leadersOf, mvpOf } from "@/features/matchmaking/room/roomData"
import { playerOptions } from "@/features/player/api/queries"
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
  // El detalle de la partida no trae fotos: se piden los perfiles solo del MVP y de los destacados
  // (cinco como mucho, con caché). Los invitados sin ficha quedan con las iniciales.
  const mvp = mvpOf(stats)
  const shown = [mvp, ...leadersOf(stats).map((l) => l.player)].filter(
    (p): p is NonNullable<typeof p> => !!p?.alias
  )
  const aliases = [...new Set(shown.map((p) => p.alias!))]
  const photos = useQueries({
    queries: aliases.map((a) => ({ ...playerOptions(a), retry: false })),
    combine: (rs) =>
      new Map(
        rs.flatMap((r, i) =>
          r.data
            ? [
                [
                  aliases[i],
                  r.data.photo_url ?? r.data.details?.avatar_url ?? null,
                ] as const,
              ]
            : []
        )
      ),
  })
  if (!stats.length) return null
  return (
    <MvpAndLeaders
      stats={stats}
      image={image}
      playerOf={(key) => {
        const p = stats.find((s) => s.key === key)
        return p
          ? {
              nick: p.nick,
              photo_url: p.alias ? (photos.get(p.alias) ?? null) : null,
            }
          : undefined
      }}
    />
  )
}

function MixClips({ matchId, map }: { matchId: string; map: string | null }) {
  const clips = useQuery(gameClipsOptions(matchId)).data?.items
  // La foto del mapa del catálogo, para el video y las tarjetas (sin ella, el degradado).
  const maps = useQuery(mapsOptions).data
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
      poster={mapImage(maps, map)}
    />
  )
}
