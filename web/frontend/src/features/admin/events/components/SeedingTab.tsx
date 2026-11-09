import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import {
  ChartColumnIcon,
  GripVerticalIcon,
  ShuffleIcon,
  XIcon,
} from "lucide-react"
import { useState, type DragEvent, type KeyboardEvent } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { ErrorAlert } from "@/components/brand/ErrorAlert"
import { TeamCrest } from "@/components/brand/TeamCrest"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { eventRegistrationsOptions } from "@/features/events/api/queries"
import type { EventDetail, Registration } from "@/features/events/types"
import { EmptyState, QueryError } from "../../components/ui"
import { useSeeds } from "../api/queries"
import {
  fillSlots,
  placeTeam,
  seedLayout,
  type LayoutSection,
  type LayoutSlot,
  type Template,
} from "../lib/model"

/**
 * Siembra sobre la llave (bitácora 2026-11-09-siembra-sobre-la-llave): se ve el formato elegido y
 * cada equipo se arrastra (o se toca y se pone) en su lugar. Por ranking y Sortear los calcula la API.
 * Solo antes de generar el fixture.
 */
export function SeedingTab({ event }: { event: EventDetail }) {
  const regs = useQuery(eventRegistrationsOptions(event.id))
  if (regs.isError)
    return <QueryError error={regs.error} onRetry={() => void regs.refetch()} />
  if (!regs.data) return <Skeleton className="h-96 rounded-xl" />
  if (regs.data.length === 0)
    return <EmptyState>Todavía no hay equipos inscritos.</EmptyState>
  // La clave reinicia la llave local cuando cambia la siembra guardada.
  return (
    <Seeding
      key={regs.data.map((r) => r.team.id).join()}
      event={event}
      regs={regs.data}
    />
  )
}

type Slots = (string | null)[]

const shuffle = <T,>(list: T[]): T[] => {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Lo que necesita cada lugar y cada equipo de la columna para arrastrar, tocar y soltar. */
type Ctl = {
  editable: boolean
  slots: Slots
  saved: string[]
  byId: Map<string, Registration>
  playersPerTeam: number
  drag: string | null
  over: number | "bank" | null
  picked: string | null
  setDrag: (id: string | null) => void
  setOver: (o: number | "bank" | null) => void
  setPicked: (id: string | null) => void
  place: (id: string, to: number) => void
  unplace: (id: string) => void
}

function Seeding({
  event,
  regs,
}: {
  event: EventDetail
  regs: Registration[]
}) {
  const saved = regs.map((r) => r.team.id)
  const [slots, setSlots] = useState<Slots>(saved)
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<number | "bank" | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<"ranking" | "draw" | null>(null)
  const seeds = useSeeds(event.id)
  const editable = event.status === "registration"
  const byId = new Map(regs.map((r) => [r.team.id, r]))
  const template = event.template as Template
  const config = event.config as Parameters<typeof seedLayout>[1]
  const layout = seedLayout(template, config, slots.length)

  const bank = saved.filter((id) => !slots.includes(id))
  const placed = slots.length - bank.length
  const missing = bank.length
  const dirty = slots.some((id, i) => id !== saved[i])
  const moved = slots.filter((id, i) => id && id !== saved[i]).length

  const update = (next: Slots) => {
    setSlots(next)
    setPicked(null)
    setDrag(null)
    setOver(null)
  }
  const unplace = (id: string) =>
    update(slots.map((s) => (s === id ? null : s)))

  const run = (arg: Parameters<typeof seeds.mutate>[0], ok: string) =>
    seeds.mutate(arg, {
      onSuccess: () => {
        setConfirm(null)
        // Si la API deja el mismo orden, la clave no cambia: se vuelve a la guardada a mano.
        if (arg.by !== "manual") update(saved)
        toast.success(ok)
      },
    })
  const regenerate = (by: "ranking" | "draw") =>
    dirty
      ? setConfirm(by)
      : run(
          { by },
          by === "ranking" ? "Siembra por ranking." : "Siembra sorteada."
        )

  const ctl: Ctl = {
    editable,
    slots,
    saved,
    byId,
    playersPerTeam: event.players_per_team,
    drag,
    over,
    picked,
    setDrag,
    setOver,
    setPicked,
    place: (id, to) => update(placeTeam(slots, id, to)),
    unplace,
  }

  const bankDragOver = (e: DragEvent) => {
    if (!drag || !slots.includes(drag)) return
    e.preventDefault()
    if (over !== "bank") setOver("bank")
  }

  return (
    <div className="flex flex-col gap-4">
      {!editable && (
        <p className="rounded-lg bg-muted px-3 py-2 text-[13px] text-muted-foreground">
          El fixture ya está generado: la siembra queda fija. Mientras no haya
          empezado ninguna partida, se puede volver a la siembra desde Resumen.
        </p>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={seeds.isPending}
            onClick={() => regenerate("ranking")}
          >
            <ChartColumnIcon aria-hidden />
            Por ranking
          </Button>
          <Button
            variant="outline"
            disabled={seeds.isPending}
            onClick={() => regenerate("draw")}
          >
            <ShuffleIcon aria-hidden />
            Sortear
          </Button>
          <span
            className="mx-1 hidden h-6 w-px bg-border sm:block"
            aria-hidden
          />
          <Button
            variant="outline"
            disabled={missing === 0}
            onClick={() => update(fillSlots(slots, bank))}
          >
            Completar huecos en orden
          </Button>
          <Button
            variant="outline"
            disabled={missing === 0}
            onClick={() => update(fillSlots(slots, shuffle(bank)))}
          >
            Completar huecos al azar
          </Button>
          <Button
            variant="ghost"
            disabled={placed === 0}
            onClick={() => update(slots.map(() => null))}
          >
            Vaciar
          </Button>
        </div>
      )}
      {seeds.isError && <ErrorAlert message={errorMessage(seeds.error)} />}

      {picked && (
        <p
          className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-[13px]"
          aria-live="polite"
        >
          Elegiste a <strong>{byId.get(picked)?.team.name}</strong>: toca un
          lugar de la llave para ponerlo ahí. Tócalo de nuevo (o Escape) para
          soltarlo.
        </p>
      )}

      <div className="flex flex-wrap items-start gap-5">
        {editable && (
          <aside
            aria-label="Equipos sin ubicar"
            onDragOver={bankDragOver}
            onDragLeave={() => over === "bank" && setOver(null)}
            onDrop={(e) => {
              e.preventDefault()
              if (drag && slots.includes(drag)) unplace(drag)
            }}
            className={cn(
              "flex w-full flex-col gap-2 rounded-xl border bg-card p-3 transition-colors md:w-72 md:shrink-0",
              over === "bank" && "border-primary bg-primary/5"
            )}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-[13px] font-semibold">Sin ubicar</h3>
              <span className="font-mono text-xs text-muted-foreground">
                {missing} de {slots.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Arrastra cada equipo a su lugar en la llave, o tócalo y después
              toca el lugar.
            </p>
            {bank.map((id) => (
              <TeamChip key={id} id={id} ctl={ctl} variant="bank" />
            ))}
            {bank.length === 0 && (
              <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                Todos los equipos están en la llave. Suelta aquí uno para
                sacarlo.
              </p>
            )}
            <div className="mt-1 flex flex-col gap-1.5 border-t pt-2 text-[11.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                Puesto a mano: no es su lugar en la siembra guardada.
              </span>
              <span>
                Soltar sobre un lugar ocupado intercambia los equipos.
              </span>
            </div>
          </aside>
        )}

        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          {layout.map((sec) => (
            <Section key={sec.title} sec={sec} ctl={ctl} />
          ))}
        </div>
      </div>

      {editable && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <span>
              <span className="font-mono font-semibold">{placed}</span>
              <span className="text-muted-foreground">
                {" "}
                de {slots.length} ubicados
              </span>
            </span>
            <span className="text-muted-foreground">
              {moved === 0
                ? "Igual a la guardada"
                : `${moved} ${moved === 1 ? "puesto" : "puestos"} a mano`}
            </span>
            {missing > 0 ? (
              <span className="text-amber-700 dark:text-amber-400">
                {missing === 1
                  ? "Falta 1 equipo por ubicar"
                  : `Faltan ${missing} equipos por ubicar`}
              </span>
            ) : (
              dirty && (
                <span className="text-emerald-700 dark:text-emerald-400">
                  Lista para guardar
                </span>
              )
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={!dirty}
              onClick={() => update(saved)}
            >
              Deshacer cambios
            </Button>
            <Button
              disabled={!dirty || missing > 0 || seeds.isPending}
              onClick={() =>
                run(
                  { by: "manual", teams: slots as string[] },
                  "Siembra guardada."
                )
              }
            >
              Guardar siembra
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm === "draw"
            ? "¿Sortear la siembra?"
            : "¿Generar la siembra por ranking?"
        }
        description="Reemplaza la siembra entera y se pierden los cambios a mano sin guardar."
        confirmLabel={confirm === "draw" ? "Sortear" : "Generar"}
        pending={seeds.isPending}
        error={seeds.error}
        onConfirm={() =>
          confirm &&
          run(
            { by: confirm },
            confirm === "draw" ? "Siembra sorteada." : "Siembra por ranking."
          )
        }
      />
    </div>
  )
}

function Section({ sec, ctl }: { sec: LayoutSection; ctl: Ctl }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[15px] font-semibold">{sec.title}</h3>
        <p className="max-w-xl text-xs text-muted-foreground">{sec.hint}</p>
      </div>
      <div className="overflow-x-auto pb-1">
        <div
          className={cn(
            "grid auto-cols-[minmax(220px,1fr)] grid-flow-col",
            sec.bracket ? "gap-8" : "gap-4"
          )}
        >
          {sec.cols.map((col, ci) => (
            <div key={ci} className="flex min-w-0 flex-col gap-2">
              <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {col.title}
              </div>
              <div
                className={cn(
                  "flex flex-1 flex-col gap-3",
                  sec.bracket && "justify-around"
                )}
              >
                {col.boxes.map((box, bi) => (
                  <div
                    key={bi}
                    className={cn(
                      "relative flex flex-col gap-1 rounded-lg border bg-muted/40 p-2",
                      sec.bracket &&
                        ci < sec.cols.length - 1 &&
                        "after:absolute after:top-1/2 after:-right-8 after:w-8 after:border-t"
                    )}
                  >
                    {(box.label || box.side) && (
                      <div className="flex justify-between px-0.5 text-[11px] text-muted-foreground">
                        <span>{box.label}</span>
                        <span className="font-mono">{box.side}</span>
                      </div>
                    )}
                    <div
                      className={cn(
                        "grid gap-1",
                        box.slots.length > 6 && "sm:grid-cols-2"
                      )}
                    >
                      {box.slots.map((s, si) => (
                        <SlotView key={si} slot={s} ctl={ctl} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SlotView({ slot, ctl }: { slot: LayoutSlot; ctl: Ctl }) {
  if (slot.kind === "ph")
    return (
      <div className="flex min-h-9 items-center rounded-md border bg-background/40 px-2.5 text-xs text-muted-foreground">
        {slot.text}
      </div>
    )
  if (slot.kind === "bye")
    return (
      <div className="flex min-h-9 items-center rounded-md border border-dashed px-2.5 text-xs text-muted-foreground">
        Libre: pasa solo
      </div>
    )
  const i = slot.seed - 1
  const id = ctl.slots[i] ?? null
  const armed = ctl.editable && (ctl.drag !== null || ctl.picked !== null)
  const isOver = ctl.over === i
  return (
    <div
      onDragOver={(e) => {
        if (!ctl.editable || !ctl.drag) return
        e.preventDefault()
        if (ctl.over !== i) ctl.setOver(i)
      }}
      onDragLeave={() => isOver && ctl.setOver(null)}
      onDrop={(e) => {
        e.preventDefault()
        const d = ctl.drag ?? e.dataTransfer.getData("text/plain")
        if (d && ctl.byId.has(d)) ctl.place(d, i)
      }}
      className={cn(
        "relative grid min-h-11 grid-cols-[30px_minmax(0,1fr)] items-stretch rounded-md border transition-colors",
        id ? "bg-background" : "border-dashed",
        armed && !id && "border-primary/50 bg-primary/5",
        isOver && "border-solid border-primary bg-primary/10",
        id && ctl.picked === id && "ring-2 ring-primary/50"
      )}
    >
      <span className="flex items-center justify-center border-r font-mono text-[11px] text-muted-foreground">
        #{slot.seed}
      </span>
      {id ? (
        <TeamChip id={id} ctl={ctl} variant="slot" index={i} />
      ) : ctl.editable ? (
        <button
          type="button"
          className="px-2.5 text-left text-xs text-muted-foreground outline-none focus-visible:bg-muted disabled:cursor-default"
          disabled={!ctl.picked}
          onClick={() => ctl.picked && ctl.place(ctl.picked, i)}
        >
          {ctl.picked
            ? `Poner aquí a ${ctl.byId.get(ctl.picked)?.team.name}`
            : ctl.drag
              ? "Suelta aquí"
              : "Lugar libre"}
        </button>
      ) : (
        <span className="flex items-center px-2.5 text-xs text-muted-foreground">
          Libre
        </span>
      )}
    </div>
  )
}

/** Un equipo, en la columna de los sin ubicar o en un lugar de la llave. */
function TeamChip({
  id,
  ctl,
  variant,
  index,
}: {
  id: string
  ctl: Ctl
  variant: "bank" | "slot"
  index?: number
}) {
  const r = ctl.byId.get(id)!
  const active = r.players.filter((p) => p.role === "active").length
  const subs = r.players.length - active
  const savedSeed = ctl.saved.indexOf(id) + 1
  const manual = variant === "slot" && ctl.saved[index!] !== id
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && ctl.picked) {
      e.preventDefault()
      ctl.setPicked(null)
    }
  }
  const onClick = () => {
    if (!ctl.editable) return
    if (variant === "slot" && ctl.picked && ctl.picked !== id)
      ctl.place(ctl.picked, index!)
    else ctl.setPicked(ctl.picked === id ? null : id)
  }
  const players =
    active < ctl.playersPerTeam ? (
      <Badge variant="danger">
        {active}/{ctl.playersPerTeam}
      </Badge>
    ) : (
      <span className="font-mono text-[11px] text-muted-foreground">
        {active}/{ctl.playersPerTeam}
        {subs > 0 && ` +${subs}`}
      </span>
    )
  return (
    <>
      <button
        type="button"
        draggable={ctl.editable}
        disabled={!ctl.editable}
        aria-pressed={ctl.editable ? ctl.picked === id : undefined}
        aria-label={
          variant === "bank"
            ? `${r.team.name}, siembra guardada ${savedSeed}. Arrastra o toca para ubicarlo.`
            : `Siembra ${index! + 1}: ${r.team.name}`
        }
        onKeyDown={onKey}
        onClick={onClick}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", id)
          e.dataTransfer.effectAllowed = "move"
          ctl.setDrag(id)
          ctl.setPicked(null)
        }}
        onDragEnd={() => {
          ctl.setDrag(null)
          ctl.setOver(null)
        }}
        className={cn(
          "grid min-w-0 items-center gap-2 text-left outline-none disabled:cursor-default",
          ctl.editable && "cursor-grab focus-visible:bg-muted",
          ctl.drag === id && "opacity-40",
          variant === "bank"
            ? cn(
                "min-h-11 grid-cols-[24px_minmax(0,1fr)_auto_16px] rounded-lg border bg-background px-2 py-1.5 hover:border-foreground/30",
                ctl.picked === id && "border-primary ring-2 ring-primary/40"
              )
            : "grid-cols-[24px_minmax(0,1fr)_auto] py-1 pr-9 pl-2"
        )}
      >
        <TeamCrest team={r.team} size="xs" />
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{r.team.name}</span>
          {manual && (
            <span
              className="size-1.5 shrink-0 rounded-full bg-primary"
              title="Puesto a mano"
            />
          )}
        </span>
        {players}
        {variant === "bank" && (
          <GripVerticalIcon
            className="size-4 text-muted-foreground"
            aria-hidden
          />
        )}
      </button>
      {variant === "slot" && ctl.editable && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          aria-label={`Sacar a ${r.team.name} de la llave`}
          onClick={() => ctl.unplace(id)}
        >
          <XIcon aria-hidden />
        </Button>
      )}
    </>
  )
}
