import { cn } from "cn"
import { EyeIcon, PlayIcon } from "lucide-react"
import { useState } from "react"

import { ClipCard, clipDuration } from "@/components/brand/ClipCard"
import { clipKind } from "@/features/series/lib/series"
import type { RecapClip } from "./data"
import { fmt } from "./hints"

// Tus mejores jugadas de la temporada: la elegida grande (en la demo no hay video, se ve la portada) y las
// demás para elegir. En la historia van en filas compactas; en la vista completa, con la ClipCard de las salas.

const mapLabel = (m: string) => {
  const s = m.replace(/^(de|cs)_/, "").replace(/_(rc\d|ob|classic)$/, "")
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const dateLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" })

/** "Ace", "Clutch 1v4", "4K". */
export const clipName = (type: string) =>
  type.startsWith("clutch_") ? `Clutch 1v${type.slice(7)}` : type === "ace" ? "Ace" : type.toUpperCase()

const PLACE = ["Tu mejor jugada", "Tu segunda mejor", "Tu tercera mejor"]

function Player({ clip, place }: { clip: RecapClip; place: number }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div
      data-interactive
      className="relative isolate grid aspect-video w-full place-items-center overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--accent)_40%,#111),#0a0a0a_75%)] text-white"
    >
      <img
        src={`/radar/${clip.map}.svg`}
        alt=""
        aria-hidden
        onError={(e) => (e.currentTarget.style.display = "none")}
        className="absolute inset-0 -z-10 size-full scale-125 object-cover opacity-[0.12]"
      />
      <span className="absolute top-3 left-3 rounded-md bg-black/60 px-2 py-0.5 font-mono text-xs font-bold tracking-[1px] uppercase">
        {clipKind(clip.type)}
      </span>
      <span className="absolute top-3 right-3 rounded-md bg-black/60 px-2 py-0.5 font-mono text-xs tabular-nums">
        {clipDuration(clip.seconds)}
      </span>
      {playing ? (
        <span className="px-6 text-center text-sm text-white/80">
          Acá se reproduce el clip ({clipName(clip.type)} en {mapLabel(clip.map)}, ronda {clip.round}). En la demo no hay archivo.
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Ver ${clipName(clip.type)} en ${mapLabel(clip.map)}`}
          className="grid size-14 place-items-center rounded-full bg-white/90 text-black shadow-lg transition-transform hover:scale-105"
        >
          <PlayIcon className="size-6 translate-x-px fill-current" />
        </button>
      )}
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-linear-to-t from-black/80 to-transparent px-3 pt-8 pb-2.5 text-left">
        <span className="flex flex-col">
          <span className="text-[11px] font-semibold tracking-[1.5px] text-[var(--accent)] uppercase">{PLACE[place]}</span>
          <span className="text-base font-semibold">
            {clipName(clip.type)} · <span className="capitalize">{mapLabel(clip.map)}</span>
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-white/75">
          <EyeIcon className="size-3.5" /> {fmt(clip.views)}
        </span>
      </span>
    </div>
  )
}

/** Versión de la historia: el clip grande y las otras dos en filas. */
export function StoryClips({ clips }: { clips: RecapClip[] }) {
  const [sel, setSel] = useState(0)
  return (
    <div className="flex flex-col gap-2.5">
      <Player key={clips[sel].id} clip={clips[sel]} place={sel} />
      {clips.map((c, k) => (
        <button
          key={c.id}
          type="button"
          onClick={() => setSel(k)}
          aria-pressed={k === sel}
          className={cn(
            "flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition-colors hover:bg-white/[0.08]",
            k === sel && "border-[var(--accent)]/70 bg-white/[0.08]"
          )}
        >
          <span className="w-6 font-mono text-sm text-muted-foreground tabular-nums">{k + 1}</span>
          <span className="rounded-md bg-[var(--accent)]/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[var(--accent)] uppercase">
            {clipKind(c.type)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">
            <span className="capitalize">{mapLabel(c.map)}</span> · ronda {c.round}
          </span>
          <span className="text-xs text-muted-foreground">{dateLabel(c.date)}</span>
        </button>
      ))}
    </div>
  )
}

/** Versión de la vista completa: el clip grande y las tarjetas de las salas al costado. */
export function FullClips({ clips }: { clips: RecapClip[] }) {
  const [sel, setSel] = useState(0)
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
      <Player key={clips[sel].id} clip={clips[sel]} place={sel} />
      <ul className="flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {clips.map((c, k) => (
          <li key={c.id} className="shrink-0">
            <ClipCard
              kind={clipKind(c.type)}
              who={`${k + 1}. ${clipName(c.type)}`}
              detail={`${mapLabel(c.map)} · ronda ${c.round} · ${dateLabel(c.date)}`}
              seconds={c.seconds}
              featured={k === 0}
              selected={k === sel}
              onSelect={() => setSel(k)}
              label={`Ver ${clipName(c.type)} en ${mapLabel(c.map)}`}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
