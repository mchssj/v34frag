import { cn } from "cn"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"

import { Button } from "@/components/ui/button"

// Fila de tarjetas que se desplaza de lado (plan docs/bitacora/2026-11-04-carrusel-unico): flechas arriba
// a la derecha solo si no entra todo, degradado del lado donde hay más y barra fina del tema.

type Edges = { overflow: boolean; atStart: boolean; atEnd: boolean }
const NONE: Edges = { overflow: false, atStart: true, atEnd: true }

export type CarouselState = Edges & {
  /** Para el `ref` de la fila (`CarouselTrack` lo pone solo). */
  setTrack: (el: HTMLElement | null) => void
  scroll: (dir: 1 | -1) => void
}

export function useCarousel(): CarouselState {
  const [track, setTrack] = useState<HTMLElement | null>(null)
  const [edges, setEdges] = useState<Edges>(NONE)

  const update = useCallback(() => {
    if (!track) return
    const max = track.scrollWidth - track.clientWidth
    // 2 px de tolerancia: el zoom del navegador deja scrollLeft con decimales.
    const next: Edges = {
      overflow: max > 2,
      atStart: track.scrollLeft <= 2,
      atEnd: track.scrollLeft >= max - 2,
    }
    setEdges((cur) =>
      cur.overflow === next.overflow &&
      cur.atStart === next.atStart &&
      cur.atEnd === next.atEnd
        ? cur
        : next
    )
  }, [track])

  useEffect(() => {
    if (!track) return
    // La primera medición, cuando ya se pintó la fila.
    const first = requestAnimationFrame(update)
    track.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    // Cambia el ancho de la fila o llegan tarjetas nuevas (clips que terminan de grabarse).
    const resize =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update)
    resize?.observe(track)
    const children = new MutationObserver(update)
    children.observe(track, { childList: true })
    return () => {
      cancelAnimationFrame(first)
      track.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      resize?.disconnect()
      children.disconnect()
    }
  }, [track, update])

  const scroll = useCallback(
    (dir: 1 | -1) =>
      // El suavizado lo pone la clase scroll-smooth, que se apaga con prefers-reduced-motion.
      track?.scrollBy({ left: dir * Math.max(200, track.clientWidth * 0.85) }),
    [track]
  )

  return { ...edges, setTrack, scroll }
}

/** Anterior y siguiente. No se muestran si todo entra a la vista. */
export function CarouselArrows({
  carousel,
  className,
}: {
  carousel: CarouselState
  className?: string
}) {
  if (!carousel.overflow) return null
  return (
    <span className={cn("flex gap-1.5", className)}>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Anteriores"
        disabled={carousel.atStart}
        onClick={() => carousel.scroll(-1)}
      >
        <ChevronLeftIcon aria-hidden />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Siguientes"
        disabled={carousel.atEnd}
        onClick={() => carousel.scroll(1)}
      >
        <ChevronRightIcon aria-hidden />
      </Button>
    </span>
  )
}

/**
 * La fila. Cada hijo directo queda alineado al borde al soltar. Los 3 px de aire dejan entero el borde
 * de la tarjeta elegida, que el desplazamiento recortaría.
 */
export function CarouselTrack({
  carousel,
  label,
  as: Tag = "div",
  className,
  children,
}: {
  carousel: CarouselState
  label: string
  as?: "div" | "ul" | "ol"
  className?: string
  children: ReactNode
}) {
  const { setTrack, overflow, atStart, atEnd, scroll } = carousel
  const more = !overflow
    ? undefined
    : atStart
      ? "end"
      : atEnd
        ? "start"
        : "both"
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault()
      scroll(e.key === "ArrowRight" ? 1 : -1)
    }
  }
  return (
    <Tag
      ref={setTrack}
      data-carousel-track=""
      data-more={more}
      aria-label={label}
      // Con foco se mueve con las flechas del teclado.
      tabIndex={overflow ? 0 : undefined}
      onKeyDown={onKeyDown}
      className={cn(
        "-m-[3px] flex snap-x snap-mandatory scrollbar-thin gap-2.5 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth rounded-lg p-[3px] pb-2.5 outline-none *:flex-none *:snap-start focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:scroll-auto",
        className
      )}
    >
      {children}
    </Tag>
  )
}

/** Título, flechas arriba a la derecha y la fila. */
export function Carousel({
  title,
  label,
  as,
  className,
  trackClassName,
  children,
}: {
  title?: ReactNode
  label: string
  as?: "div" | "ul" | "ol"
  className?: string
  trackClassName?: string
  children: ReactNode
}) {
  const carousel = useCarousel()
  return (
    <div className={cn("flex min-w-0 flex-col gap-2.5", className)}>
      {(title || carousel.overflow) && (
        <div className="flex min-h-8 items-center gap-2">
          {title}
          <CarouselArrows carousel={carousel} className="ml-auto" />
        </div>
      )}
      <CarouselTrack
        carousel={carousel}
        label={label}
        as={as}
        className={trackClassName}
      >
        {children}
      </CarouselTrack>
    </div>
  )
}
