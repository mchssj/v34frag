import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState } from "react"

import type { Schemas } from "@/api/client"
import { Carousel } from "@/components/brand/Carousel"
import { ClipCard } from "@/components/brand/ClipCard"
import { mapImage } from "@/features/maps/lib/catalog"
import { mapsOptions } from "@/features/maps/api/queries"
import { clipKind } from "@/features/series/lib/series"
import { featuredClipsOptions } from "../../api/queries"
import { fmtLong } from "../../lib/labels"

// Ficha pública › Clips (replanteo 76): los destacados del jugador, los que eligió o, en automático, sus
// mejores. El primero va grande; todos, en un Carousel con la foto del mapa, como en la sala.

type Item = Schemas["FeaturedClip"]

const title = (it: Item) =>
  `${clipKind(it.clip.type)}${it.match.map ? ` en ${it.match.map}` : ""}`

export function Clips({
  playerId,
  alias,
}: {
  playerId: string
  alias: string
}) {
  const items = useQuery(featuredClipsOptions(playerId)).data ?? []
  const maps = useQuery(mapsOptions).data
  const [current, setCurrent] = useState<string | null>(null)
  const it = items.find((x) => x.clip.id === current) ?? items[0]
  if (!it)
    return (
      <p className="py-6 text-sm text-muted-foreground">
        {alias} todavía no tiene clips destacados.
      </p>
    )
  const index = items.indexOf(it)

  return (
    <section
      aria-label={`Clips destacados de ${alias}`}
      className="flex flex-col gap-5 pt-4"
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_300px] lg:items-center">
        <Video item={it} poster={mapImage(maps, it.match.map)} />
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold tracking-[2px] text-muted-foreground uppercase">
            Destacado {index + 1} de {items.length}
          </span>
          <h2 className="text-xl font-bold">{title(it)}</h2>
          <p className="text-sm text-muted-foreground">
            Ronda {it.clip.round}
            {it.clip.round_won ? " · ganó la ronda" : ""}
            {it.match.played_at ? ` · ${fmtLong(it.match.played_at)}` : ""}
          </p>
          <Link
            to="/match/$id"
            params={{ id: it.match.id }}
            className="w-fit text-sm font-semibold text-primary hover:underline"
          >
            Ver la partida
          </Link>
        </div>
      </div>
      {items.length > 1 && (
        <Carousel
          label={`Clips de ${alias}`}
          as="ul"
          title={
            <h3 className="text-[15px] font-semibold">Más clips de {alias}</h3>
          }
        >
          {items.map((x) => (
            <li key={x.clip.id}>
              <ClipCard
                kind={clipKind(x.clip.type)}
                who={x.match.map ?? alias}
                detail={[
                  `ronda ${x.clip.round}`,
                  x.match.played_at && fmtLong(x.match.played_at),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                image={mapImage(maps, x.match.map)}
                seconds={x.clip.video.seconds}
                selected={x.clip.id === it.clip.id}
                onSelect={() => setCurrent(x.clip.id)}
                label={`Ver ${title(x)}`}
              />
            </li>
          ))}
        </Carousel>
      )}
    </section>
  )
}

/** El .mp4 si está en R2; si no, el reproductor de Drive (los clips viejos). */
function Video({ item, poster }: { item: Item; poster: string | null }) {
  const v = item.clip.video
  if (v.url)
    return (
      <video
        key={item.clip.id}
        src={v.url}
        poster={poster ?? undefined}
        controls
        className="aspect-video w-full rounded-xl bg-black"
      />
    )
  if (v.embed_url)
    return (
      <iframe
        key={item.clip.id}
        src={v.embed_url}
        title={title(item)}
        allow="autoplay; fullscreen"
        className="aspect-video w-full rounded-xl border-0 bg-black"
      />
    )
  return (
    <div className="grid aspect-video w-full place-items-center rounded-xl bg-black text-sm text-white/70">
      Video no disponible
    </div>
  )
}
