import { CopyIcon, TriangleAlertIcon } from "lucide-react"
import { useId, useState, type ReactNode } from "react"

import { errorMessage } from "@/api/errors"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CONFIRM_TEXT, isConfirmText } from "./format"

type Reason = { label: string; help?: string; required: boolean }

/**
 * Confirmación de una acción. Con `typed` pide escribir "estoy seguro" (doble confirmación del
 * contrato); con `reason`, un motivo (obligatorio u opcional) que se pasa a `onConfirm`.
 * El que la abre maneja la mutación: `pending` y `error` vienen de ahí.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  danger = false,
  typed = false,
  reason,
  pending,
  error,
  onConfirm,
  children,
  incomplete = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel: string
  danger?: boolean
  typed?: boolean
  reason?: Reason
  pending: boolean
  error: unknown
  onConfirm: (reason: string) => void
  children?: ReactNode
  /** Falta algo del contenido propio (`children`), como elegir una ficha. */
  incomplete?: boolean
}) {
  const id = useId()
  const [text, setText] = useState("")
  const [why, setWhy] = useState("")
  const ready =
    !incomplete &&
    (!typed || isConfirmText(text)) &&
    (!reason?.required || why.trim().length > 0)

  function change(next: boolean) {
    if (pending) return
    if (!next) {
      setText("")
      setWhy("")
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="gap-4 sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription asChild>
              <div className="flex flex-col gap-2 leading-relaxed">
                {description}
              </div>
            </DialogDescription>
          )}
        </DialogHeader>
        {children}
        {reason && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-reason`}>{reason.label}</Label>
            <Textarea
              id={`${id}-reason`}
              value={why}
              maxLength={200}
              rows={3}
              onChange={(e) => setWhy(e.target.value)}
            />
            {reason.help && (
              <span className="text-xs text-muted-foreground">
                {reason.help}
              </span>
            )}
          </div>
        )}
        {typed && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-confirm`} className="font-normal">
              Escribe <b className="font-semibold">{CONFIRM_TEXT}</b> para
              confirmar
            </Label>
            <Input
              id={`${id}-confirm`}
              autoComplete="off"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}
        {!!error && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(error)}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => change(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(why.trim())}
            disabled={!ready || pending}
            className={
              danger
                ? "bg-destructive text-white hover:bg-destructive/90"
                : undefined
            }
          >
            {pending ? "Un momento…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
