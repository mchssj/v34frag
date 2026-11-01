import { cn } from "cn"
import { CheckIcon, InfoIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  LOOKING_FOR,
  lookingForText,
  MAX_ROSTER,
  type LookingFor,
} from "./model"
import { useSetLookingFor, type TeamDetail } from "./queries"

/** Etiquetas "Busca activo…" de la cabecera (solo lectura, también en la vista pública). */
export function LookingForTags({ team }: { team: TeamDetail }) {
  if (team.looking_for.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Qué busca el equipo">
      {team.looking_for.map((w) => (
        <li
          key={w}
          className="inline-flex h-6 items-center gap-1.5 rounded-full border bg-card/60 px-2.5 text-xs font-medium"
        >
          <span className="size-1.5 rounded-full bg-win" aria-hidden />
          {lookingForText(w)}
        </li>
      ))}
    </ul>
  )
}

/** Panel lateral del líder: qué busca el equipo. Se ve en Buscar equipo y en sus filtros. */
export function RecruitSheet({
  team,
  open,
  onOpenChange,
}: {
  team: TeamDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[420px]">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>Reclutar jugadores</SheetTitle>
          <SheetDescription>
            Elige qué busca el equipo. Aparece en Buscar equipo y en sus
            filtros.
          </SheetDescription>
        </SheetHeader>
        {/* Se monta al abrir: parte siempre de lo guardado. */}
        {open && <RecruitForm team={team} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function RecruitForm({
  team,
  onDone,
}: {
  team: TeamDetail
  onDone: () => void
}) {
  const [picked, setPicked] = useState<LookingFor[]>(team.looking_for)
  const save = useSetLookingFor()
  const full = team.members >= (team.max_members ?? MAX_ROSTER)

  const toggle = (w: LookingFor) =>
    setPicked((p) => (p.includes(w) ? p.filter((x) => x !== w) : [...p, w]))

  async function submit() {
    try {
      // En el orden de las opciones, no en el de los clics.
      await save.mutateAsync({
        teamId: team.id,
        lookingFor: LOOKING_FOR.map((o) => o.id).filter((w) =>
          picked.includes(w)
        ),
      })
      toast.success(
        picked.length
          ? "Listo: tu equipo aparece buscando"
          : "Tu equipo dejó de buscar"
      )
      onDone()
    } catch {
      // Se muestra en el panel.
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
        {LOOKING_FOR.map((o) => {
          const on = picked.includes(o.id)
          return (
            <button
              key={o.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(o.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                on ? "border-primary/45 bg-primary/8" : "hover:bg-muted/60"
              )}
            >
              <span
                className={cn(
                  "grid size-[18px] shrink-0 place-items-center rounded-[5px] border text-primary-foreground",
                  on && "border-primary bg-primary"
                )}
              >
                {on && <CheckIcon className="size-3" aria-hidden />}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{o.label}</span>
                <span className="text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </button>
          )
        })}
        <p className="mt-1 flex gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-pretty text-muted-foreground">
          <InfoIcon className="mt-px size-3.5 shrink-0" aria-hidden />
          {full
            ? "El roster está completo: mientras siga así, el equipo no aparece como que busca, aunque esté marcado."
            : `Con el roster completo (${team.max_members ?? MAX_ROSTER}) el equipo deja de aparecer como que busca, aunque esté marcado.`}
        </p>
        {save.error != null && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(save.error)}
          </p>
        )}
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t px-5 py-3">
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button disabled={save.isPending} onClick={() => void submit()}>
          Guardar
        </Button>
      </SheetFooter>
    </>
  )
}
