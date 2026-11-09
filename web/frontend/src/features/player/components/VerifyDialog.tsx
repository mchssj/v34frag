import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { api, unwrap } from "@/api/client"
import { errorMessage } from "@/api/errors"
import { Segmented } from "@/components/brand/Segmented"
import {
  VERIFIED_DEFAULT_NOTE,
  VERIFIED_LABEL,
  VerifiedSeal,
  type VerifiedKind,
} from "@/components/brand/VerifiedBadge"
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
import type { PlayerDetail } from "../types"

// Insignia de verificado (replanteo 90): solo un admin la pone, la cambia o la saca, desde el perfil del jugador.

type Choice = "none" | VerifiedKind
const NOTE_MAX = 60

export function VerifyDialog({ player }: { player: PlayerDetail }) {
  const qc = useQueryClient()
  const current = player.verification
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Choice>(current?.kind ?? "none")
  const [note, setNote] = useState(current?.note ?? "")
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.PUT("/api/v1/admin/players/{id}/verification", {
          params: { path: { id: player.id } },
          body: {
            kind: kind === "none" ? null : kind,
            note: kind === "none" ? null : note.trim() || null,
          },
        })
      ),
    onSuccess: () => {
      toast.success(
        kind === "none" ? "Insignia sacada" : `${VERIFIED_LABEL[kind]}: listo`
      )
      setOpen(false)
      void qc.invalidateQueries({ queryKey: ["players"] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setKind(current?.kind ?? "none")
          setNote(current?.note ?? "")
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-8 gap-1.5 px-3 text-[13px]">
          <VerifiedSeal kind={current?.kind ?? "gray"} className="size-4" />
          {current ? "Insignia" : "Verificar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Insignia de verificado</DialogTitle>
          <DialogDescription>
            Se ve al lado del nick de {player.alias}, en su perfil y en sus
            comentarios. Solo la pone un admin.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Segmented<Choice>
            label="Insignia"
            size="lg"
            value={kind}
            onChange={setKind}
            options={[
              { value: "none", label: "Ninguna" },
              {
                value: "gray",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <VerifiedSeal kind="gray" className="size-4" /> Gris
                  </span>
                ),
              },
              {
                value: "gold",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <VerifiedSeal kind="gold" className="size-4" /> Dorada
                  </span>
                ),
              },
            ]}
          />
          {kind !== "none" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="verify-note">Qué se verificó (opcional)</Label>
              <Input
                id="verify-note"
                value={note}
                maxLength={NOTE_MAX}
                placeholder={VERIFIED_DEFAULT_NOTE[kind]}
                onChange={(e) => setNote(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                Se lee en la ficha de la insignia. Vacío: &quot;
                {VERIFIED_DEFAULT_NOTE[kind]}&quot;.
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
