import { FlagIcon } from "lucide-react"
import { useState } from "react"

import type { Schemas } from "@/api/client"
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

// Denunciar un comentario del perfil (replanteo 94, bitácora 2026-11-09-perfil-social-ajustes). Lo revisan moderadores
// y admins en Administración › Baneos › Comentarios.

export type CommentReportReason = Schemas["ProfileCommentReportBody"]["reason"]

export const COMMENT_REPORT_REASON: Record<CommentReportReason, string> = {
  toxic: "Insultos o lenguaje ofensivo",
  harassment: "Acoso o amenazas",
  spam: "Spam o publicidad",
  other: "Otro motivo",
}
const REASONS = Object.keys(COMMENT_REPORT_REASON) as CommentReportReason[]

export function CommentReportDialog({
  author,
  onReport,
}: {
  author: string
  /** Devuelve una promesa: el diálogo se cierra solo si la denuncia se guardó. */
  onReport: (reason: CommentReportReason, note: string) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<CommentReportReason>("toxic")
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const send = () => {
    setSending(true)
    onReport(reason, note.trim())
      .then(
        () => {
          setOpen(false)
          setNote("")
        },
        () => {}
      )
      .finally(() => setSending(false))
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Denunciar el comentario de ${author}`}
          title="Denunciar"
        >
          <FlagIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Denunciar el comentario de {author}</DialogTitle>
          <DialogDescription>
            Lo revisa un moderador. Si no cumple las reglas, lo borra.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          aria-label="Motivo"
          value={reason}
          onValueChange={(v) => setReason(v as CommentReportReason)}
          className="gap-2"
        >
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <RadioGroupItem value={r} />
              {COMMENT_REPORT_REASON[r]}
            </label>
          ))}
        </RadioGroup>
        <Textarea
          aria-label="Nota (opcional)"
          placeholder="Qué pasó (opcional)"
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={sending} onClick={send}>
            Enviar denuncia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
