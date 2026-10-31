import { cn } from "cn"
import { useId, useState, type ReactNode } from "react"

import { errorMessage } from "@/api/errors"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Reason = { label: string; help?: string; required: boolean }

/** Sin distinguir mayúsculas ni espacios en los bordes, como la API. */
export const matchesPhrase = (text: string, phrase: string) =>
  text.trim().toLowerCase() === phrase

/**
 * Confirmación de una acción sobre el AlertDialog de shadcn. Con `typed` pide escribir esa frase
 * (doble confirmación); con `reason`, un motivo (obligatorio u opcional) que se pasa a
 * `onConfirm`. El que la abre maneja la mutación: `pending` y `error` vienen de ahí.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  danger = false,
  typed,
  reason,
  pending,
  error,
  onConfirm,
  children,
  incomplete = false,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel: string
  danger?: boolean
  /** Frase que hay que escribir para confirmar. */
  typed?: string
  reason?: Reason
  pending: boolean
  error: unknown
  onConfirm: (reason: string) => void
  children?: ReactNode
  /** Falta algo del contenido propio (`children`), como elegir una ficha. */
  incomplete?: boolean
  className?: string
}) {
  const id = useId()
  const [text, setText] = useState("")
  const [why, setWhy] = useState("")
  const ready =
    !incomplete &&
    (!typed || matchesPhrase(text, typed)) &&
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
    <AlertDialog open={open} onOpenChange={change}>
      <AlertDialogContent
        className={cn(
          "text-sm data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-[480px]",
          className
        )}
      >
        <AlertDialogHeader className="place-items-start gap-2 text-left">
          <AlertDialogTitle className="leading-none">{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2 leading-relaxed text-wrap md:text-wrap">
                {description}
              </div>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
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
              Escribe <b className="font-semibold">{typed}</b> para confirmar
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
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          {/* Botón común: la acción de Radix cerraría el diálogo antes de que termine la mutación. */}
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
