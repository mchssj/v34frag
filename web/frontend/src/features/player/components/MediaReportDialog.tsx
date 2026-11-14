import { FlagIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { Schemas } from "@/api/client"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { useReportMedia } from "@/features/shop/api"

// Denunciar una imagen del perfil (bitácora 2026-11-13-avatar-y-fondo-propios): el avatar o el fondo que subió el
// jugador, o su portada. Lo revisan moderadores y admins en Administración › Baneos › Imágenes; si no respeta las reglas,
// la sacan sin devolver lo pagado.

type Body = Schemas["MediaReportBody"]
export type MediaKind = Body["kind"]
export type MediaReason = Body["reason"]

export const MEDIA_KIND: Record<MediaKind, string> = {
  avatar: "Su avatar",
  background: "Su fondo de miniperfil",
  cover: "Su portada",
}
export const MEDIA_REASON: Record<MediaReason, string> = {
  copyright: "Es de otra persona (derechos de autor)",
  nsfw: "Contenido sexual o explícito",
  offensive: "Contenido ofensivo",
  other: "Otro motivo",
}
const REASONS = Object.keys(MEDIA_REASON) as MediaReason[]

/** El botón y la ventana. `kinds`: las imágenes que tiene hoy el perfil (sin ninguna, no se muestra). */
export function MediaReportDialog({
  player,
  nick,
  kinds,
}: {
  player: string
  nick: string
  kinds: MediaKind[]
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<MediaKind | null>(null)
  const [reason, setReason] = useState<MediaReason>("copyright")
  const [note, setNote] = useState("")
  const report = useReportMedia()
  if (!kinds.length) return null
  const chosen = kind && kinds.includes(kind) ? kind : kinds[0]!
  const send = () =>
    report.mutate(
      {
        player,
        body: {
          kind: chosen,
          reason,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success("Gracias. Lo revisa un moderador.")
          setOpen(false)
          setNote("")
        },
        onError: (e) => toast.error(errorMessage(e)),
      }
    )
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-[13px] text-muted-foreground"
        >
          <FlagIcon aria-hidden className="size-3.5" />
          Denunciar imagen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Denunciar una imagen de {nick}</DialogTitle>
          <DialogDescription>
            Lo revisa un moderador. Si no respeta las reglas, la saca del
            perfil.
          </DialogDescription>
        </DialogHeader>
        {kinds.length > 1 && (
          <RadioGroup
            aria-label="Qué imagen"
            value={chosen}
            onValueChange={(v) => setKind(v as MediaKind)}
            className="gap-2"
          >
            {kinds.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <RadioGroupItem value={k} />
                {MEDIA_KIND[k]}
              </label>
            ))}
          </RadioGroup>
        )}
        <RadioGroup
          aria-label="Motivo"
          value={reason}
          onValueChange={(v) => setReason(v as MediaReason)}
          className="gap-2 border-t pt-3"
        >
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <RadioGroupItem value={r} />
              {MEDIA_REASON[r]}
            </label>
          ))}
        </RadioGroup>
        <Textarea
          aria-label="Nota (opcional)"
          placeholder={
            reason === "copyright"
              ? "De quién es, si lo sabes (opcional)"
              : "Qué pasa (opcional)"
          }
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={report.isPending}
            onClick={send}
          >
            Enviar denuncia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
