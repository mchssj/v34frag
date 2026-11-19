import { cn } from "cn"
import { useState } from "react"

import { ClipCard } from "@/components/brand/ClipCard"
import { clipKind } from "@/features/series/lib/series"
import { dateLabel, mapLabel, type RecapClip } from "./types"

// Las mejores jugadas de la temporada: la elegida grande, con su video (el .mp4 de R2 o el reproductor de Drive),
// y las demás para elegir. En la historia van en filas compactas; en la vista completa, con la ClipCard de las salas.

/** "Ace", "Clutch 1v4", "4K". */
export const clipName = (type: string) =>
  type.startsWith("clutch_")
    ? `Clutch 1v${type.slice(7)}`
    : type === "ace"
      ? "Ace"
      : type.toUpperCase()

const where = (c: RecapClip) => (c.match.map ? mapLabel(c.match.map) : "mix")
const when = (c: RecapClip) =>
  c.match.played_at ? dateLabel(c.match.played_at, "short") : ""

const PLACE = ["La mejor jugada", "La segunda mejor", "La tercera mejor"]

function Player({ item, place }: { item: RecapClip; place: number }) {
  const v = item.clip.video
  const label = `${clipName(item.clip.type)} en ${where(item)}`
  return (
    <div data-interactive className="flex flex-col gap-1.5">
      {v.url ? (
        <video
          key={item.clip.id}
          src={v.url}
          controls
          className="aspect-video w-full rounded-xl bg-black"
        />
      ) : v.embed_url ? (
        <iframe
          key={item.clip.id}
          src={v.embed_url}
          title={label}
          allow="autoplay; fullscreen"
          className="aspect-video w-full rounded-xl border-0 bg-black"
        />
      ) : (
        <div className="grid aspect-video w-full place-items-center rounded-xl border border-white/10 bg-black px-6 text-center text-sm text-white/70">
          {v.status === "pending"
            ? "El video se está preparando"
            : "Video no disponible"}
        </div>
      )}
      <span className="flex items-baseline justify-between gap-2 text-left">
        <span className="text-[11px] font-semibold tracking-[1.5px] text-[var(--accent)] uppercase">
          {PLACE[place]}
        </span>
        <span className="text-sm font-semibold">
          {clipName(item.clip.type)} ·{" "}
          <span className="capitalize">{where(item)}</span>
        </span>
      </span>
    </div>
  )
}

/** Versión de la historia: el clip grande y los otros en filas. */
export function StoryClips({ clips }: { clips: RecapClip[] }) {
  const [sel, setSel] = useState(0)
  return (
    <div className="flex flex-col gap-2.5">
      <Player key={clips[sel].clip.id} item={clips[sel]} place={sel} />
      {clips.length > 1 &&
        clips.map((c, k) => (
          <button
            key={c.clip.id}
            type="button"
            onClick={() => setSel(k)}
            aria-pressed={k === sel}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition-colors hover:bg-white/[0.08]",
              k === sel && "border-[var(--accent)]/70 bg-white/[0.08]"
            )}
          >
            <span className="w-6 font-mono text-sm text-muted-foreground tabular-nums">
              {k + 1}
            </span>
            <span className="rounded-md bg-[var(--accent)]/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[var(--accent)] uppercase">
              {clipKind(c.clip.type)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">
              <span className="capitalize">{where(c)}</span> · ronda{" "}
              {c.clip.round}
            </span>
            <span className="text-xs text-muted-foreground">{when(c)}</span>
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
      <Player key={clips[sel].clip.id} item={clips[sel]} place={sel} />
      <ul className="flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {clips.map((c, k) => (
          <li key={c.clip.id} className="shrink-0">
            <ClipCard
              kind={clipKind(c.clip.type)}
              who={`${k + 1}. ${clipName(c.clip.type)}`}
              detail={`${where(c)} · ronda ${c.clip.round}${when(c) ? ` · ${when(c)}` : ""}`}
              seconds={c.clip.video.seconds ?? 0}
              featured={k === 0}
              selected={k === sel}
              onSelect={() => setSel(k)}
              label={`Ver ${clipName(c.clip.type)} en ${where(c)}`}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
