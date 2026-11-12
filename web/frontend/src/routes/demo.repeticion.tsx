import { useQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"

import { RoundReplay } from "@/features/replay/components/RoundReplay"
import { TrackHeatmap } from "@/features/replay/components/TrackHeatmap"
import { radarIndexOptions } from "@/features/replay/lib/radar"
import { parseTrack, type Track } from "@/features/replay/lib/track"

// Repetición 2D y mapa de calor sin API (bitácora 2026-11-12-repeticion-2d-y-mapa-de-calor). Solo en `pnpm dev`.
// Abre un .trk de la PC (el que deja el servidor en csstv_demos/) o, si existe, public/demo-replay/partida.trk.
export const Route = createFileRoute("/demo/repeticion")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoReplay,
})

function DemoReplay() {
  const [picked, setPicked] = useState<Track | null>(null)
  const sample = useQuery({
    queryKey: ["demo", "replay", "sample"],
    queryFn: async () => {
      const res = await fetch("/demo-replay/partida.trk")
      const text = res.ok ? await res.text() : ""
      // Vite devuelve el index.html para lo que no existe.
      return text.startsWith("V ") ? parseTrack(text) : null
    },
    staleTime: Infinity,
  })
  const radars = useQuery(radarIndexOptions)
  const track = picked ?? sample.data ?? null
  const radar = track ? radars.data?.[track.map] : undefined

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3 text-sm">
        <span className="font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        <label className="flex items-center gap-2">
          Abrir un .trk
          <input
            type="file"
            accept=".trk,text/plain"
            className="text-xs"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) setPicked(parseTrack(await f.text()))
            }}
          />
        </label>
        {track && (
          <span className="text-muted-foreground">
            {track.map} · {track.rounds.length} rondas
          </span>
        )}
      </div>
      {!track && (
        <p className="text-sm text-muted-foreground">
          Abrí el .trk de una partida (está al lado de la demo, en
          csstv_demos/).
        </p>
      )}
      {track && !radar && radars.isSuccess && (
        <p className="text-sm text-muted-foreground">
          No hay radar para {track.map}. Hay que generarlo con
          server/radar/nav_a_svg.py.
        </p>
      )}
      {track && radar && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Repetición 2D</h2>
            <RoundReplay track={track} radar={radar} />
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Mapa de calor</h2>
            <TrackHeatmap track={track} radar={radar} />
          </section>
        </>
      )}
    </div>
  )
}
