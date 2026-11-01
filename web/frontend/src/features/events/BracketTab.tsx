import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { TrophyIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react"
import {
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  buildBracket,
  sidesOf,
  type BracketColumn,
  type BracketSection,
} from "./model"
import {
  eventMatchesOptions,
  type EventDetail,
  type EventMatch,
} from "./queries"
import { EmptyBox, TagBox } from "./ui"

const ZOOM = { min: 0.5, max: 1.5, step: 0.1, fit: 0.85 }
const clampZoom = (z: number) =>
  Math.min(ZOOM.max, Math.max(ZOOM.min, Math.round(z * 10) / 10))

/** Llave: columnas por ronda, zoom de 50 a 150 %, arrastre y el camino del equipo bajo el cursor. */
export function BracketTab({ event }: { event: EventDetail }) {
  const matches = useQuery(eventMatchesOptions(event.id)).data
  const [zoom, setZoom] = useState(1)
  const [hover, setHover] = useState<string | null>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const pan = usePan(canvas)

  if (!matches) return <Skeleton className="h-[512px] rounded-hero" />
  const sections = buildBracket(matches, event.template)
  if (sections.length === 0) return <EmptyBox>{emptyText(event)}</EmptyBox>
  const ending = (s: BracketSection) => s.final || s.key === "0:third"
  const before = sections.filter((s) => !ending(s))
  const after = sections.filter(ending)

  return (
    <section className="overflow-hidden rounded-[calc(var(--radius)+4px)] border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
        <span className="text-[13px] text-pretty text-muted-foreground">
          Pasa el cursor sobre un equipo para seguir su camino. Arrastra para
          moverte.
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Alejar"
            disabled={zoom <= ZOOM.min}
            onClick={() => setZoom((z) => clampZoom(z - ZOOM.step))}
          >
            <ZoomOutIcon aria-hidden />
          </Button>
          <span
            aria-live="polite"
            className="w-12 text-center font-mono text-xs font-medium"
          >
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Acercar"
            disabled={zoom >= ZOOM.max}
            onClick={() => setZoom((z) => clampZoom(z + ZOOM.step))}
          >
            <ZoomInIcon aria-hidden />
          </Button>
          <Button
            variant="outline"
            className="text-xs"
            onClick={() => setZoom(ZOOM.fit)}
          >
            Ajustar
          </Button>
        </div>
      </div>
      <div
        ref={canvas}
        {...pan}
        data-testid="bracket-canvas"
        className="h-[460px] cursor-grab overflow-auto bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-[size:16px_16px] active:cursor-grabbing"
      >
        {/* `zoom` (no `transform`) para que el área de scroll siga el tamaño real. */}
        {/* Las etapas previas (grupos, upper y lower) apiladas; a la derecha, la final con el
            campeón y el 3.er puesto debajo. */}
        <div style={{ zoom }} className="flex w-max items-center gap-14 p-7">
          {[before, after].map(
            (list, i) =>
              list.length > 0 && (
                <div key={i} className="flex flex-col gap-10">
                  {list.map((s) => (
                    <Section
                      key={s.key}
                      section={s}
                      champion={
                        s.final ? (event.champion?.name ?? null) : undefined
                      }
                      hover={hover}
                      onHover={setHover}
                    />
                  ))}
                </div>
              )
          )}
        </div>
      </div>
    </section>
  )
}

function emptyText(event: EventDetail) {
  if (event.status === "registration")
    return "La llave se arma cuando se cierran las inscripciones."
  if (event.template === "swiss")
    return "Los playoffs se arman cuando termina el suizo."
  if (event.template === "groups" || event.template === "groups_double")
    return "Los playoffs se arman cuando termina la fase de grupos."
  return "Este torneo no tiene llave."
}

function Section({
  section,
  champion,
  hover,
  onHover,
}: {
  section: BracketSection
  /** undefined: la sección no termina en el campeón; null: todavía por definir. */
  champion: string | null | undefined
  hover: string | null
  onHover: (team: string | null) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {section.title && (
        <h3 className="text-[13px] font-semibold">{section.title}</h3>
      )}
      <div className="flex gap-14">
        {section.columns.map((c) => (
          <Column key={c.round} column={c} hover={hover} onHover={onHover} />
        ))}
        {champion !== undefined && (
          <div className="flex w-[180px] flex-col justify-center pt-[26px]">
            <div className="flex flex-col items-center gap-2 rounded-[calc(var(--radius)+4px)] border border-dashed bg-background p-5">
              <TrophyIcon className="size-7 text-primary" aria-hidden />
              <span className="text-xs text-muted-foreground">Campeón</span>
              <span className="text-center text-[15px] font-semibold">
                {champion ?? "Por definir"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Column({
  column,
  hover,
  onHover,
}: {
  column: BracketColumn
  hover: string | null
  onHover: (team: string | null) => void
}) {
  return (
    <div className="flex w-[232px] flex-col">
      <div className="flex justify-between gap-2 pb-2.5 text-xs font-medium text-muted-foreground">
        <span className="truncate">{column.title}</span>
        <span className="font-mono">BO{column.bo}</span>
      </div>
      <div className="flex flex-1 flex-col justify-around gap-4">
        {column.games.map((m) => (
          <Game key={m.id} match={m} hover={hover} onHover={onHover} />
        ))}
      </div>
    </div>
  )
}

function Game({
  match,
  hover,
  onHover,
}: {
  match: EventMatch
  hover: string | null
  onHover: (team: string | null) => void
}) {
  const sides = sidesOf(match)
  const onPath = !!hover && sides.some((s) => s.teamId === hover)
  const live = match.status === "live"
  return (
    <Link
      to="/match/$id"
      params={{ id: match.id }}
      draggable={false}
      aria-label={`${sides[0].name} contra ${sides[1].name}`}
      className={cn(
        "relative flex flex-col rounded-[calc(var(--radius)-2px)] border bg-background shadow-[0_1px_2px_rgb(0_0_0/.06)] transition-[border-color,opacity] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        onPath ? "border-primary" : live && "border-destructive",
        hover && !onPath && "opacity-45"
      )}
    >
      {sides.map((s, i) => (
        <span
          key={i}
          onMouseEnter={() => s.teamId && onHover(s.teamId)}
          onMouseLeave={() => onHover(null)}
          className={cn(
            "flex h-9 items-center gap-2 px-2.5 text-[13px]",
            // Sin overflow-hidden en la tarjeta (el chip VIVO sobresale): las filas llevan el radio.
            i === 0
              ? "rounded-t-[calc(var(--radius)-3px)] border-b"
              : "rounded-b-[calc(var(--radius)-3px)]",
            hover && s.teamId === hover && "bg-primary/14"
          )}
        >
          <TagBox
            team={s.teamId ? s : null}
            className="size-[22px] text-[8px]"
          />
          <span
            className={cn(
              "flex-1 truncate",
              s.won && "font-semibold",
              (!s.teamId || s.lost) && "text-muted-foreground"
            )}
          >
            {s.name}
          </span>
          <span
            className={cn(
              "font-mono text-[13px] font-semibold",
              s.lost && "text-muted-foreground"
            )}
          >
            {s.score ?? ""}
          </span>
        </span>
      ))}
      {live && (
        <span className="absolute -top-2 right-2 grid h-4 place-items-center rounded bg-destructive px-[5px] text-[9px] font-bold text-white">
          VIVO
        </span>
      )}
    </Link>
  )
}

/**
 * Arrastrar el lienzo con el mouse para moverse. Un arrastre de más de 3px anula el clic, así no
 * se abre la partida donde se soltó. En pantallas táctiles queda el scroll nativo.
 */
function usePan(ref: RefObject<HTMLDivElement | null>) {
  const start = useRef<{
    x: number
    y: number
    left: number
    top: number
  } | null>(null)
  const dragged = useRef(false)

  return {
    onPointerDown(e: PointerEvent<HTMLDivElement>) {
      if (e.pointerType !== "mouse" || e.button !== 0 || !ref.current) return
      start.current = {
        x: e.clientX,
        y: e.clientY,
        left: ref.current.scrollLeft,
        top: ref.current.scrollTop,
      }
      dragged.current = false
    },
    onPointerMove(e: PointerEvent<HTMLDivElement>) {
      const s = start.current
      if (!s || !ref.current) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (!dragged.current && Math.hypot(dx, dy) < 3) return
      if (!dragged.current) ref.current.setPointerCapture(e.pointerId)
      dragged.current = true
      ref.current.scrollLeft = s.left - dx
      ref.current.scrollTop = s.top - dy
    },
    onPointerUp() {
      start.current = null
    },
    onPointerCancel() {
      start.current = null
    },
    onClickCapture(e: MouseEvent) {
      if (!dragged.current) return
      e.preventDefault()
      e.stopPropagation()
      dragged.current = false
    },
  }
}
