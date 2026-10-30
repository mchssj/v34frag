import { useNavigate } from "@tanstack/react-router"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useDeleteMix, type EloChoice } from "./queries"

const CONFIRM = "estoy seguro"

const TOASTS = {
  keep: "Mix borrado. Se mantuvo el ELO.",
  revert: "Mix borrado. ELO revertido.",
  none: "Mix borrado.",
} as const

/**
 * "Borrar este mix" (admin). El admin elige si el ELO que dio el mix se mantiene o se revierte
 * (nunca se recalcula la historia) y confirma escribiendo "estoy seguro" (contrato, admin.md).
 * En un cancelado no hay ELO que elegir.
 */
export function DeleteMixDialog({
  matchId,
  movedElo,
}: {
  matchId: string
  /** El mix terminó y movió el ELO (en un cancelado no se muestra la elección). */
  movedElo: boolean
}) {
  const [open, setOpen] = useState(false)
  const [elo, setElo] = useState<EloChoice>("keep")
  const [typed, setTyped] = useState("")
  const del = useDeleteMix(matchId)
  const navigate = useNavigate()
  const id = useId()
  const ready = typed.trim().toLowerCase() === CONFIRM

  function onOpenChange(next: boolean) {
    if (del.isPending) return
    setOpen(next)
    if (!next) {
      setElo("keep")
      setTyped("")
      del.reset()
    }
  }

  function submit() {
    del.mutate(elo, {
      onSuccess: (res) => {
        toast.success(TOASTS[res.elo_mode])
        setOpen(false)
        void navigate({ to: "/matches", search: { kind: "mix" } })
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-[30px] px-3 text-[13px] text-destructive hover:text-destructive"
        >
          Borrar este mix
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-4 sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>¿Borrar este mix?</DialogTitle>
          <DialogDescription>
            Se borran el mix, sus stats, el chat y los clips. La demo queda
            guardada hasta que venza. No se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        {movedElo && (
          <RadioGroup
            value={elo}
            onValueChange={(v) => setElo(v as EloChoice)}
            aria-label="Qué pasa con el ELO"
            className="gap-2"
          >
            <EloOption
              id={`${id}-keep`}
              value="keep"
              title="Mantener el ELO"
              text="Los jugadores se quedan con lo que ganaron o perdieron."
            />
            <EloOption
              id={`${id}-revert`}
              value="revert"
              title="Revertir el ELO"
              text="A cada jugador se le resta lo que le dio este mix. Los mixes posteriores quedan como están."
            />
          </RadioGroup>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-confirm`} className="font-normal">
            Escribe <b className="font-semibold">{CONFIRM}</b> para confirmar
          </Label>
          <Input
            id={`${id}-confirm`}
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ready && !del.isPending) submit()
            }}
          />
        </div>

        {del.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(del.error)}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={del.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={submit}
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={!ready || del.isPending}
          >
            {del.isPending ? "Borrando…" : "Borrar mix"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EloOption({
  id,
  value,
  title,
  text,
}: {
  id: string
  value: EloChoice
  title: string
  text: string
}) {
  return (
    <Label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 font-normal has-data-[state=checked]:border-foreground has-data-[state=checked]:bg-accent"
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{text}</span>
      </span>
    </Label>
  )
}
