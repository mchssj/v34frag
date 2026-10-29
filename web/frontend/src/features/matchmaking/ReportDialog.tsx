import { FlagIcon } from "lucide-react"
import { useState } from "react"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { REASON_TEXT } from "./labels"
import { useMmMutation } from "./queries"
import { useMmSource } from "./source"
import type { MmPlayer, ReportReason } from "./types"

const REASONS = Object.keys(REASON_TEXT) as ReportReason[]

/** Reportar a un jugador de la sala (plan, decisión "Reportes"). Uno por jugador y sala. */
export function ReportDialog({
  lobbyId,
  player,
  done,
}: {
  lobbyId: string
  player: MmPlayer
  done: boolean
}) {
  const source = useMmSource()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>("afk")
  const [note, setNote] = useState("")
  const report = useMmMutation(() =>
    source.report(lobbyId, player.player_id, reason, note)
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={done}
          aria-label={
            done
              ? `Ya reportaste a ${player.nick}`
              : `Reportar a ${player.nick}`
          }
          title={done ? "Ya lo reportaste" : "Reportar"}
        >
          <FlagIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Reportar a {player.nick}</DialogTitle>
          <DialogDescription>
            Lo revisa un admin. Un reporte falso también se sanciona.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          aria-label="Motivo"
          value={reason}
          onValueChange={(v) => setReason(v as ReportReason)}
          className="gap-2"
        >
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <RadioGroupItem value={r} />
              {REASON_TEXT[r]}
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
          <Button
            variant="destructive"
            disabled={report.isPending}
            onClick={() =>
              report.mutate(undefined, {
                onSuccess: () => {
                  setOpen(false)
                  toast.success(`Reportaste a ${player.nick}`)
                },
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
          >
            Enviar reporte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
