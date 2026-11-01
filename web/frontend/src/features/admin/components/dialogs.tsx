import { CopyIcon, TriangleAlertIcon } from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type SecretBlock = { label: string; text: string }

/** Token que se muestra una sola vez (la base guarda el hash): cuadros con "Copiar". */
export function SecretDialog({
  open,
  title,
  intro,
  blocks,
  doneLabel = "Ya lo guardé",
  onDone,
}: {
  open: boolean
  title: string
  intro: string
  blocks: SecretBlock[]
  doneLabel?: string
  onDone: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(b: SecretBlock) {
    try {
      await navigator.clipboard.writeText(b.text)
      setCopied(b.label)
    } catch {
      setCopied(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false} className="gap-4 sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{intro}</DialogDescription>
        </DialogHeader>
        <Alert variant="warning">
          <TriangleAlertIcon aria-hidden />
          <AlertDescription>
            Cópialo ahora: no se vuelve a mostrar. Si se pierde, se genera otro.
          </AlertDescription>
        </Alert>
        {blocks.map((b) => (
          <div key={b.label} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium">{b.label}</span>
              <Button variant="outline" size="sm" onClick={() => copy(b)}>
                <CopyIcon aria-hidden />
                {copied === b.label ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <pre className="rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
              {b.text}
            </pre>
          </div>
        ))}
        <DialogFooter>
          <Button onClick={onDone}>{doneLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
