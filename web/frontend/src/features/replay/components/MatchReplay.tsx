import { queryOptions, useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { Segmented } from "@/components/brand/Segmented"
import { radarIndexOptions } from "../lib/radar"
import { parseTrack } from "../lib/track"
import { RoundReplay } from "./RoundReplay"
import { TrackHeatmap } from "./TrackHeatmap"

// El .trk lo sirve el Worker de demos (track_url del detalle). No cambia: se baja una vez.
export const trackOptions = (url: string) =>
  queryOptions({
    queryKey: ["replay", "track", url],
    queryFn: async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`track ${res.status}`)
      return parseTrack(await res.text())
    },
    staleTime: Infinity,
    retry: 1,
  })

/** Repetición 2D y mapa de calor de una partida, debajo de la sala. Sin .trk (partidas viejas) no muestra nada. */
export function MatchReplay({
  trackUrl,
}: {
  trackUrl: string | null | undefined
}) {
  const [view, setView] = useState<"replay" | "heat">("replay")
  const track = useQuery({
    ...trackOptions(trackUrl ?? ""),
    enabled: !!trackUrl,
  })
  const radars = useQuery({ ...radarIndexOptions, enabled: !!trackUrl })
  if (!trackUrl) return null
  const radar = track.data ? radars.data?.[track.data.map] : undefined

  return (
    <section aria-labelledby="replay-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="replay-title" className="text-lg font-semibold">
          {view === "replay" ? "Repetición 2D" : "Mapa de calor"}
        </h2>
        <Segmented
          label="Vista"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "replay", label: "Repetición 2D" },
            { value: "heat", label: "Mapa de calor" },
          ]}
        />
      </div>
      {track.isPending || radars.isPending ? (
        <div className="aspect-square max-h-[480px] animate-pulse rounded-xl border bg-card" />
      ) : track.isError ? (
        <p className="text-sm text-muted-foreground">
          No se pudo cargar la repetición de esta partida.
        </p>
      ) : !radar ? (
        <p className="text-sm text-muted-foreground">
          Todavía no tenemos el radar de {track.data.map}.
        </p>
      ) : view === "replay" ? (
        <RoundReplay track={track.data} radar={radar} />
      ) : (
        <TrackHeatmap track={track.data} radar={radar} />
      )}
    </section>
  )
}
