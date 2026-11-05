import { LoaderIcon, PlayIcon, Share2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Carousel } from "@/components/brand/Carousel"
import { ClipCard } from "@/components/brand/ClipCard"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { clipKind } from "@/features/series/lib/series"
import type { MmClip, MmPlayer } from "../types"
import { clipTitle } from "./roomData"

// Lo más destacado de la partida: los clips (GET /matches/{id}/clips), ya ordenados por la base. El
// elegido va grande; todos, en un Carousel con la foto del mapa (plan docs/bitacora/2026-11-04-carrusel-unico).

export function Highlights({
  clips,
  players,
  mapName,
  poster,
}: {
  clips: MmClip[]
  /** Para la foto de quien hizo la jugada. */
  players: Pick<MmPlayer, "player_id" | "photo_url">[]
  mapName: string | null
  poster: string | null
}) {
  const [current, setCurrent] = useState(clips[0]!.id)
  const clip = clips.find((c) => c.id === current) ?? clips[0]!
  const player = players.find((p) => p.player_id === clip.player_id)
  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${location.href}#clip-${clip.id}`)
      toast.success("Link de la jugada copiado")
    } catch {
      toast.error("No se pudo copiar")
    }
  }

  return (
    <section
      aria-label="Lo más destacado de la partida"
      className="flex flex-col gap-4"
    >
      <h2 className="text-lg font-semibold">Lo más destacado de la partida</h2>
      <div className="grid gap-5 lg:grid-cols-[1fr_300px] lg:items-center">
        <Video clip={clip} poster={poster} />
        <div className="flex flex-col gap-3">
          {clip.id === clips[0]!.id && (
            <span className="text-xs font-bold tracking-[2px] text-primary uppercase">
              Jugada de la partida
            </span>
          )}
          <h3 className="text-xl font-bold">{clipTitle(clip, mapName)}</h3>
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Avatar className="size-6">
              {player?.photo_url && (
                <AvatarImage src={player.photo_url} alt="" />
              )}
              <AvatarFallback className="text-[10px]">
                {clip.nick.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {clip.nick} · ronda {clip.round}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => void share()}
          >
            <Share2Icon aria-hidden />
            Compartir
          </Button>
        </div>
      </div>
      <Carousel
        label="Más jugadas"
        as="ul"
        title={<h3 className="text-[15px] font-semibold">Más jugadas</h3>}
      >
        {clips.map((c, i) => {
          const recording =
            c.video.status === "pending" || c.video.status === "processing"
          const ready = c.video.status === "done"
          return (
            <li key={c.id}>
              <ClipCard
                kind={clipKind(c.type)}
                who={c.nick}
                detail={[
                  mapName,
                  `ronda ${c.round}`,
                  recording ? "grabando" : !ready ? "sin video" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                image={poster}
                seconds={c.video.seconds}
                state={recording ? "recording" : ready ? "ready" : "none"}
                featured={i === 0}
                selected={c.id === clip.id}
                onSelect={() => setCurrent(c.id)}
                label={`Ver ${clipTitle(c, mapName)} de ${c.nick}`}
              />
            </li>
          )
        })}
      </Carousel>
    </section>
  )
}

/** El video del clip: el .mp4 si está, si no el reproductor de Drive, y si no, su estado. */
function Video({ clip, poster }: { clip: MmClip; poster: string | null }) {
  const v = clip.video
  if (v.url)
    return (
      <video
        key={clip.id}
        src={v.url}
        poster={poster ?? undefined}
        controls
        className="aspect-video w-full rounded-xl bg-black"
      />
    )
  if (v.embed_url)
    return (
      <iframe
        key={clip.id}
        src={v.embed_url}
        title="Jugada"
        allow="autoplay; fullscreen"
        className="aspect-video w-full rounded-xl bg-black"
      />
    )
  const recording = v.status === "pending" || v.status === "processing"
  return (
    <div className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-xl bg-black text-white">
      {poster && (
        <img
          src={poster}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover opacity-60"
        />
      )}
      <span className="relative flex flex-col items-center gap-2 text-sm">
        {recording ? (
          <>
            <LoaderIcon aria-hidden className="size-8 animate-spin" />
            Grabando la jugada…
          </>
        ) : v.status === "done" ? (
          <>
            <PlayIcon aria-hidden className="size-12" />
            Video listo (en la demo no hay archivo)
          </>
        ) : (
          "Esta jugada no tiene video"
        )}
      </span>
    </div>
  )
}
