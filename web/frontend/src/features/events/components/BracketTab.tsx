import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { ZoomInIcon, ZoomOutIcon } from "lucide-react"
import {
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react"

import { Segmented } from "@/components/brand/Segmented"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  eventMatchesOptions,
  eventRegistrationsOptions,
  eventStandingsOptions,
} from "../api/queries"
import {
  defaultPhase,
  destinationsOf,
  emptyPhaseText,
  groupsOf,
  phasesOf,
  swissGrid,
  swissOptions,
  type Phase,
  type PhaseStatus,
} from "../lib/bracket"
import { advanceOf, buildBracket } from "../lib/model"
import type { EventDetail, Standing } from "../types"
import { BracketTree } from "./bracket/BracketTree"
import { BracketContext, type BracketCtx } from "./bracket/context"
import { GroupsDoublePhase } from "./bracket/GroupsDoublePhase"
import { GroupsPhase } from "./bracket/GroupsPhase"
import { SwissPhase } from "./bracket/SwissPhase"
import { EmptyBox } from "./ui"

const ZOOM = { min: 0.5, max: 1.5, step: 0.1, fit: 0.85 }
const clampZoom = (z: number) =>
  Math.min(ZOOM.max, Math.max(ZOOM.min, Math.round(z * 10) / 10))

const DOT: Record<PhaseStatus, string> = {
  done: "bg-win",
  live: "bg-destructive",
  pending: "bg-muted-foreground/50",
}
const DOT_LABEL: Record<PhaseStatus, string> = {
  done: "terminada",
  live: "en vivo",
  pending: "por jugar",
}

/**
 * Llave: un chip por fase (abre en la que se está jugando), zoom de 50 a 150 %, arrastre, el
 * camino del equipo bajo el cursor y el detalle resumido al hacer clic en una partida.
 */
export function BracketTab({
  event,
  phase: phaseKey,
  onPhase,
}: {
  event: EventDetail
  /** `?phase=` de la URL; si no existe, la fase en curso. */
  phase?: string
  onPhase: (key: string) => void
}) {
  const matches = useQuery(eventMatchesOptions(event.id)).data
  const registrations = useQuery(eventRegistrationsOptions(event.id)).data
  const standings = useQuery(eventStandingsOptions(event.id)).data
  const [zoom, setZoom] = useState(1)
  const [hover, setHover] = useState<string | null>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const pan = usePan(canvas)

  const phases = useMemo(
    () => (matches ? phasesOf(matches, event.template, event.config) : []),
    [matches, event.template, event.config]
  )
  const ctx = useMemo<BracketCtx>(
    () => ({
      all: matches ?? [],
      seeds: new Map(registrations?.map((r) => [r.team.id, r.seed])),
      marks: destinationsOf(matches ?? [], event.template, standings ?? []),
      hover,
      onHover: setHover,
    }),
    [matches, registrations, standings, event.template, hover]
  )

  if (!matches) return <Skeleton className="h-[512px] rounded-hero" />
  if (matches.length === 0)
    return (
      <EmptyBox>
        {event.status === "registration"
          ? "La llave se arma cuando se cierran las inscripciones."
          : "Este torneo todavía no tiene partidas."}
      </EmptyBox>
    )
  const current = phases.find((p) => p.key === phaseKey) ?? defaultPhase(phases)

  return (
    <BracketContext.Provider value={ctx}>
      <Card variant="outline" asChild className="overflow-hidden">
        <section>
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
            {phases.length > 1 && (
              <Segmented
                label="Fases del torneo"
                value={current.key}
                onChange={onPhase}
                options={phases.map((p) => ({
                  value: p.key,
                  ariaLabel: `${p.label}, ${DOT_LABEL[p.status]}`,
                  label: (
                    <>
                      <span
                        aria-hidden
                        className={cn("size-1.5 rounded-full", DOT[p.status])}
                      />
                      {p.label}
                    </>
                  ),
                }))}
              />
            )}
            <span className="text-[13px] text-pretty text-muted-foreground">
              Haz clic en una partida para ver el detalle. Pasa el cursor sobre
              un equipo para seguir su camino.
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
            className="max-h-[75svh] min-h-[260px] cursor-grab overflow-auto bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-[size:16px_16px] active:cursor-grabbing"
          >
            {/* `zoom` (no `transform`) para que el área de scroll siga el tamaño real. */}
            <div style={{ zoom }} className="w-max p-7">
              <PhaseView
                key={current.key}
                phase={current}
                event={event}
                standings={standings ?? []}
              />
            </div>
          </div>
        </section>
      </Card>
    </BracketContext.Provider>
  )
}

function PhaseView({
  phase,
  event,
  standings,
}: {
  phase: Phase
  event: EventDetail
  standings: Standing[]
}) {
  const { template, config } = event
  const view = useMemo(() => {
    switch (phase.kind) {
      case "tree":
      case "groups_double":
        return {
          kind: phase.kind,
          sections: buildBracket(phase.matches, template),
        }
      case "groups":
        return { kind: phase.kind, groups: groupsOf(phase.matches, standings) }
      case "swiss":
        return {
          kind: phase.kind,
          grid: swissGrid(phase.matches, swissOptions(config)),
        }
    }
  }, [phase, template, config, standings])

  if (phase.matches.length === 0)
    return (
      <p className="max-w-[420px] py-10 text-sm text-pretty text-muted-foreground">
        {emptyPhaseText(phase, template)}
      </p>
    )
  const advance = advanceOf(template, config)
  switch (view.kind) {
    case "tree":
      return (
        <BracketTree
          sections={view.sections}
          champion={
            view.sections.some((s) => s.final)
              ? (event.champion?.name ?? null)
              : undefined
          }
        />
      )
    case "groups_double":
      return (
        <GroupsDoublePhase
          sections={view.sections}
          standings={standings}
          advance={advance}
        />
      )
    case "groups":
      return (
        <GroupsPhase
          groups={view.groups}
          advance={advance}
          bo={phase.matches[0]?.best_of ?? null}
        />
      )
    case "swiss":
      return <SwissPhase grid={view.grid} />
  }
}

/**
 * Arrastrar el lienzo con el mouse para moverse. Un arrastre de más de 3px anula el clic, así no
 * se abre el detalle de la partida donde se soltó. En pantallas táctiles queda el scroll nativo.
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
