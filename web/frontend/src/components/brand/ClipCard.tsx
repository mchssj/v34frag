import { cn } from "cn"
import { PlayIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

// Tarjeta de un clip para un Carousel (plan docs/bitacora/2026-11-04-carrusel-unico): la misma en la sala
// del matchmaking, el mix y la serie. La miniatura es la foto del mapa del catálogo; sin foto, el degradado.

const THUMB =
  "relative grid h-[118px] place-items-center overflow-hidden text-white"
const FALLBACK =
  "bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_35%,#111),#111_70%)]"

/** 23 → "0:23", 75 → "1:15". */
export function clipDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export function ClipCard({
  kind,
  who,
  detail,
  image,
  seconds,
  state = "ready",
  featured = false,
  selected,
  onSelect,
  label,
}: {
  /** ACE, 4K, 3K, 1v3… */
  kind: string
  who: string
  /** Mapa y ronda, y si se está grabando. */
  detail: string
  image?: string | null
  seconds?: number | null
  /** `recording`: todavía se graba; `none`: no va a tener video. */
  state?: "ready" | "recording" | "none"
  /** La jugada de la partida: la etiqueta va en naranja. */
  featured?: boolean
  /** Si se pasa, la tarjeta es un botón que se marca (`aria-pressed`). */
  selected?: boolean
  onSelect: () => void
  label: string
}) {
  return (
    <Card
      variant="outline"
      radius="tile"
      asChild
      className={cn(
        "w-[220px] overflow-hidden text-left transition-colors hover:border-primary/45 motion-reduce:transition-none",
        selected && "border-primary shadow-[inset_0_0_0_1px_var(--primary)]"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={label}
      >
        <span className={cn(THUMB, !image && FALLBACK)}>
          {image && (
            <>
              <img
                src={image}
                alt=""
                aria-hidden
                loading="lazy"
                className="absolute inset-0 size-full object-cover"
              />
              <span
                aria-hidden
                className="absolute inset-0 bg-linear-to-t from-black/65 via-black/25 to-black/10"
              />
            </>
          )}
          <Badge
            variant="solid"
            shape="tag"
            size="sm"
            className={cn(
              "absolute top-2 left-2 font-mono font-bold",
              !featured && "bg-black/60 text-white"
            )}
          >
            {kind}
          </Badge>
          {state !== "none" && (
            <span
              className={cn(
                "relative grid size-9 place-items-center rounded-full bg-white/20 backdrop-blur-sm transition-colors",
                selected && "bg-primary text-primary-foreground"
              )}
            >
              {state === "recording" ? (
                <Spinner className="size-4" />
              ) : (
                <PlayIcon aria-hidden className="ml-0.5 size-4" />
              )}
            </span>
          )}
          {seconds != null && (
            <span className="absolute right-2 bottom-2 rounded bg-black/55 px-1 font-mono text-[11px] tabular-nums">
              {clipDuration(seconds)}
            </span>
          )}
        </span>
        <span className="flex flex-col px-2.5 py-2 text-[13px]">
          <span className="truncate font-medium">{who}</span>
          <span className="truncate text-xs text-muted-foreground">
            {detail}
          </span>
        </span>
      </button>
    </Card>
  )
}

/** Lugar de un clip que todavía no está: "Procesando clips…". */
export function ClipCardPending({ text, sub }: { text: string; sub: string }) {
  return (
    <Card variant="outline" radius="tile" className="w-[220px] overflow-hidden">
      <span
        className={cn(
          THUMB,
          "bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_10px,var(--card)_10px,var(--card)_20px)] text-[13px] text-muted-foreground"
        )}
      >
        <span className="flex flex-col items-center gap-2">
          <Spinner className="size-5" />
          {text}
        </span>
      </span>
      <span className="truncate px-2.5 py-2 text-xs text-muted-foreground">
        {sub}
      </span>
    </Card>
  )
}
