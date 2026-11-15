import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import { CheckIcon, TrophyIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { EmptyState } from "@/components/brand/EmptyState"
import { QueryState } from "@/components/brand/QueryState"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import {
  pinKeys,
  saveShowcase,
  showcaseOptions,
  type PlayerShowcase,
  type ShowcaseItem,
} from "@/features/pins/api"
import {
  awardItem,
  itemId,
  itemName,
  PinGraphic,
  PinTile,
  pinItem,
} from "@/features/pins/PinTile"

// ---------- Vitrina (replanteo 123): pines de torneo y premios individuales ----------

/** Destacados del Resumen: como mucho 6. */
const MAX_FEATURED = 6

const allItems = (s: PlayerShowcase): ShowcaseItem[] =>
  [...s.pins.map(pinItem), ...s.awards.map(awardItem)].sort((a, b) =>
    (b.kind === "pin" ? b.pin.awarded_at : b.award.awarded_at).localeCompare(
      a.kind === "pin" ? a.pin.awarded_at : a.award.awarded_at
    )
  )

const yearOf = (i: ShowcaseItem) =>
  i.kind === "pin" ? i.pin.year : i.award.year

/** La tarjeta del Resumen: los destacados y el enlace a la pestaña. */
export function ShowcaseCard({
  nick,
  onAll,
}: {
  nick: string
  onAll: () => void
}) {
  const q = useQuery(showcaseOptions(nick))
  return (
    <Card variant="outline" className="flex flex-col gap-3 p-4">
      <div className="flex items-center text-sm font-semibold">
        Vitrina
        {q.data && q.data.pins.length + q.data.awards.length > 0 && (
          <button
            type="button"
            onClick={onAll}
            className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Ver toda la vitrina
          </button>
        )}
      </div>
      <QueryState q={q}>
        {(s) =>
          s.featured.length === 0 ? (
            <span className="text-[13px] text-muted-foreground">
              {s.pins.length + s.awards.length === 0
                ? "Todavía sin pines ni trofeos de torneo."
                : "No eligió destacados."}
            </span>
          ) : (
            <ul className="grid grid-cols-3 gap-x-2 gap-y-4 max-sm:grid-cols-2">
              {s.featured.map((i) => (
                <li key={`${i.kind}-${itemId(i)}`} className="min-w-0">
                  <PinTile item={i} size={84} />
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </Card>
  )
}

/** La pestaña Vitrina: todos los pines y premios, por año. */
export function Showcase({ nick, owner }: { nick: string; owner: boolean }) {
  const q = useQuery(showcaseOptions(nick))
  const [choosing, setChoosing] = useState(false)
  return (
    <QueryState q={q}>
      {(s) => {
        const items = allItems(s)
        if (items.length === 0)
          return (
            <Card variant="outline" className="pb-6">
              <EmptyState
                icon={TrophyIcon}
                title="Todavía sin pines ni trofeos"
                className="pt-10"
              >
                Los pines se ganan terminando bien un torneo: campeón,
                finalista, semifinalista y más, según lo que reparta cada
                torneo. Los premios (MVP, top fragger…) los da el torneo a los
                mejores jugadores.
              </EmptyState>
            </Card>
          )
        const years = [...new Set(items.map(yearOf))].sort((a, b) => b - a)
        return (
          <div className="flex flex-col gap-4">
            {owner && (
              <Card
                variant="outline"
                className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="flex-1 text-muted-foreground">
                  {s.mode === "manual"
                    ? `Elegiste ${s.featured.length} destacados para el Resumen.`
                    : "Los destacados del Resumen se eligen solos: los mejores puestos y los más recientes."}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setChoosing(true)}
                >
                  Elegir destacados
                </Button>
              </Card>
            )}
            {years.map((y) => (
              <Card
                key={y}
                variant="outline"
                className="flex flex-col gap-4 p-4"
              >
                <span className="text-sm font-semibold">{y}</span>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-3 gap-y-5">
                  {items
                    .filter((i) => yearOf(i) === y)
                    .map((i) => (
                      <li key={`${i.kind}-${itemId(i)}`} className="min-w-0">
                        <PinTile item={i} size={104} />
                      </li>
                    ))}
                </ul>
              </Card>
            ))}
            {owner && choosing && (
              <ChooseDialog
                nick={nick}
                showcase={s}
                items={items}
                onClose={() => setChoosing(false)}
              />
            )}
          </div>
        )
      }}
    </QueryState>
  )
}

function ChooseDialog({
  nick,
  showcase,
  items,
  onClose,
}: {
  nick: string
  showcase: PlayerShowcase
  items: ShowcaseItem[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [manual, setManual] = useState(showcase.mode === "manual")
  const [picked, setPicked] = useState<{ kind: "pin" | "award"; id: string }[]>(
    showcase.mode === "manual"
      ? showcase.featured.map((i) => ({ kind: i.kind, id: itemId(i) }))
      : []
  )
  const save = useMutation({
    mutationFn: () =>
      saveShowcase({
        mode: manual ? "manual" : "auto",
        items: manual ? picked : [],
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pinKeys.showcase(nick) })
      toast.success("Vitrina guardada.")
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const toggle = (i: ShowcaseItem) => {
    const id = itemId(i)
    setPicked((p) =>
      p.some((x) => x.id === id)
        ? p.filter((x) => x.id !== id)
        : p.length >= MAX_FEATURED
          ? p
          : [...p, { kind: i.kind, id }]
    )
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Destacados de tu vitrina</DialogTitle>
          <DialogDescription>
            Los que se ven en el Resumen de tu perfil, hasta {MAX_FEATURED}, en
            el orden en que los marques.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={manual} onCheckedChange={setManual} />
          {manual
            ? `Los elijo yo (${picked.length} de ${MAX_FEATURED})`
            : "Automático: los mejores puestos y los más recientes"}
        </label>
        {manual && (
          <ul className="grid max-h-[55vh] grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2 overflow-y-auto">
            {items.map((i) => {
              const pos = picked.findIndex((x) => x.id === itemId(i))
              return (
                <li key={`${i.kind}-${itemId(i)}`}>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    aria-pressed={pos >= 0}
                    disabled={pos < 0 && picked.length >= MAX_FEATURED}
                    className={cn(
                      "relative flex w-full flex-col items-center gap-1 rounded-lg border p-2 text-center outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40",
                      pos >= 0 && "border-primary bg-primary/5"
                    )}
                  >
                    {pos >= 0 && (
                      <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-primary font-mono text-[11px] font-semibold text-primary-foreground">
                        {pos + 1}
                      </span>
                    )}
                    <PinGraphic item={i} size={72} />
                    <span className="text-xs font-semibold">{itemName(i)}</span>
                    <span className="w-full truncate text-[11px] text-muted-foreground">
                      {i.kind === "pin" ? i.pin.event.name : i.award.event.name}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <CheckIcon />
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
