import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { api, unwrap, type Schemas } from "@/api/client"
import { errorMessage } from "@/api/errors"
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
import { Medal } from "@/features/medals/Medal"
import { medalsOptions, playerKeys } from "../api/queries"

// Logros del Resumen (replanteo 123): como la Vitrina, se eligen solos (los de más veces conseguidos) o los marca el
// jugador desde la pestaña Logros.

/** Logros que entran en el Resumen: los que caben en el alto de "Jugadas clave". */
export const SUMMARY_MEDALS = 10

type Summary = Schemas["MedalSummary"]
type Key = { definition_id: string; title: string; rank: number | null }

const keyOf = (m: Key) => JSON.stringify([m.definition_id, m.title, m.rank])

export function featuredMedalsOptions(nick: string) {
  return {
    queryKey: [...playerKeys.medals(nick), "featured"] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      unwrap(
        api.GET("/api/v1/players/{id}/medals/featured", {
          params: { path: { id: nick } },
          signal,
        })
      ),
    staleTime: 5 * 60_000,
  }
}

/** Los logros del Resumen, en orden: los elegidos o, en automático, los de más veces y los más recientes. */
function pickShown(
  items: Summary[],
  featured: { mode: string; items: Key[] } | undefined
) {
  if (featured?.mode === "manual") {
    const byKey = new Map(items.map((m) => [keyOf(m), m]))
    return featured.items.flatMap((k) => {
      const m = byKey.get(keyOf(k))
      return m ? [m] : []
    })
  }
  return [...items]
    .sort(
      (a, b) =>
        b.count - a.count || (b.last_at ?? "").localeCompare(a.last_at ?? "")
    )
    .slice(0, SUMMARY_MEDALS)
}

/** La tarjeta del Resumen. */
export function MedalsCard({
  nick,
  onAll,
}: {
  nick: string
  onAll: () => void
}) {
  const medals = useQuery(medalsOptions(nick))
  const featured = useQuery(featuredMedalsOptions(nick)).data
  return (
    <Card variant="outline" className="flex flex-col gap-3 p-4">
      <div className="flex items-center text-sm font-semibold">
        Logros
        {(medals.data?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={onAll}
            className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Ver todos los logros
          </button>
        )}
      </div>
      <QueryState q={medals}>
        {(items) => {
          const shown = pickShown(items, featured)
          if (!shown.length)
            return (
              <span className="text-[13px] text-muted-foreground">
                {items.length
                  ? "No eligió logros para mostrar."
                  : "Todavía sin medallas."}
              </span>
            )
          return shown.map((m) => (
            <div key={keyOf(m)} className="flex items-center gap-3">
              <Medal look={m.design} size={36} title={m.design.title} />
              <span className="flex-1 text-sm font-medium">{m.title}</span>
              <span className="font-mono text-xs font-semibold text-muted-foreground">
                ×{m.count}
              </span>
            </div>
          ))
        }}
      </QueryState>
    </Card>
  )
}

/** En la pestaña Logros, solo para el dueño: cómo se eligen los del Resumen. */
export function MedalsChooser({ nick }: { nick: string }) {
  const medals = useQuery(medalsOptions(nick))
  const featured = useQuery(featuredMedalsOptions(nick))
  const [open, setOpen] = useState(false)
  if (!medals.data?.length || !featured.data) return null
  return (
    <Card
      variant="outline"
      className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
    >
      <span className="flex-1 text-muted-foreground">
        {featured.data.mode === "manual"
          ? `Elegiste ${featured.data.items.length} logros para el Resumen.`
          : "Los logros del Resumen se eligen solos: los que más veces conseguiste."}
      </span>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Elegir logros del Resumen
      </Button>
      {open && (
        <ChooseDialog
          nick={nick}
          items={medals.data}
          featured={featured.data}
          onClose={() => setOpen(false)}
        />
      )}
    </Card>
  )
}

function ChooseDialog({
  nick,
  items,
  featured,
  onClose,
}: {
  nick: string
  items: Summary[]
  featured: { mode: string; items: Key[] }
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [manual, setManual] = useState(featured.mode === "manual")
  const [picked, setPicked] = useState<Key[]>(
    featured.mode === "manual" ? featured.items : []
  )
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.PUT("/api/v1/me/medals/featured", {
          body: {
            mode: manual ? "manual" : "auto",
            items: manual ? picked : [],
          },
        })
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: playerKeys.medals(nick) })
      toast.success("Logros del Resumen guardados.")
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const toggle = (m: Summary) => {
    const k = keyOf(m)
    setPicked((p) =>
      p.some((x) => keyOf(x) === k)
        ? p.filter((x) => keyOf(x) !== k)
        : p.length >= SUMMARY_MEDALS
          ? p
          : [
              ...p,
              { definition_id: m.definition_id, title: m.title, rank: m.rank },
            ]
    )
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Logros del Resumen</DialogTitle>
          <DialogDescription>
            Los que se ven en el Resumen de tu perfil, hasta {SUMMARY_MEDALS},
            en el orden en que los marques.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={manual} onCheckedChange={setManual} />
          {manual
            ? `Los elijo yo (${picked.length} de ${SUMMARY_MEDALS})`
            : "Automático: los que más veces conseguiste"}
        </label>
        {manual && (
          <ul className="grid max-h-[55vh] grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2 overflow-y-auto">
            {items.map((m) => {
              const pos = picked.findIndex((x) => keyOf(x) === keyOf(m))
              return (
                <li key={keyOf(m)}>
                  <button
                    type="button"
                    onClick={() => toggle(m)}
                    aria-pressed={pos >= 0}
                    disabled={pos < 0 && picked.length >= SUMMARY_MEDALS}
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
                    <Medal look={m.design} size={48} title={m.design.title} />
                    <span className="line-clamp-2 text-xs font-semibold">
                      {m.title}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      ×{m.count}
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
