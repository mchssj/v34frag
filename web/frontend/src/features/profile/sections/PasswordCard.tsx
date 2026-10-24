import { cn } from "cn"
import { EyeIcon, EyeOffIcon, InfoIcon, KeyRoundIcon } from "lucide-react"
import { useState, type FormEvent, type ReactNode } from "react"
import { toast } from "sonner"

import { errorMessage, isApiError } from "@/api/errors"
import { useMe } from "@/auth/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorAlert } from "@/features/auth/ui"
import { passwordChangedText, passwordFeedback, type Tone } from "../password"
import { useChangePassword } from "../queries"
import { CardTitle, SectionCard } from "../ui"

const TEXT: Record<Tone, string> = {
  muted: "text-muted-foreground",
  win: "text-win",
  destructive: "text-destructive",
}
const BORDER: Record<Tone, string> = {
  muted: "",
  win: "border-win focus-visible:border-win",
  destructive: "border-destructive focus-visible:border-destructive",
}

const EMPTY = { current: "", next: "", confirm: "" }

/**
 * Contraseña (Mi perfil → Cuenta). El backend cierra las otras sesiones siempre y todavía no tiene
 * "olvidé mi contraseña": por eso no están la casilla ni el link (ver la bitácora).
 */
export function PasswordCard() {
  const change = useChangePassword()
  const changed = passwordChangedText(useMe().data?.password_changed_at)
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState(EMPTY)
  const [show, setShow] = useState(false)
  const [tried, setTried] = useState(false)
  const [serverError, setServerError] = useState<"wrong" | "same" | null>(null)

  const f = passwordFeedback({ ...values, tried, serverError })

  function edit(name: keyof typeof EMPTY, value: string) {
    setValues((v) => ({ ...v, [name]: value }))
    // El rechazo del backend se borra al tocar el campo que lo causó.
    if (serverError === "wrong" && name === "current") setServerError(null)
    if (serverError === "same" && name !== "confirm") setServerError(null)
  }

  function close() {
    setOpen(false)
    setValues(EMPTY)
    setShow(false)
    setTried(false)
    setServerError(null)
    change.reset()
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!f.canSave) {
      setTried(true)
      return
    }
    try {
      await change.mutateAsync({
        current_password: values.current,
        new_password: values.next,
      })
      close()
      toast.success("Contraseña actualizada · cerramos las otras sesiones")
    } catch (err) {
      if (isApiError(err, "WRONG_PASSWORD")) setServerError("wrong")
      else if (isApiError(err, "SAME_PASSWORD")) setServerError("same")
      // El resto se muestra con ErrorAlert.
    }
  }

  const fieldError =
    isApiError(change.error, "WRONG_PASSWORD") ||
    isApiError(change.error, "SAME_PASSWORD")

  return (
    <SectionCard>
      <div className="flex flex-wrap items-center gap-3.5 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted">
          <KeyRoundIcon className="size-[18px]" aria-hidden />
        </span>
        <CardTitle
          className="min-w-[180px] flex-1"
          title="Contraseña"
          description={changed ?? undefined}
        />
        {!open && (
          <Button
            variant="outline"
            className="text-[13px]"
            onClick={() => setOpen(true)}
          >
            Cambiar contraseña
          </Button>
        )}
      </div>
      {open && (
        <form onSubmit={(e) => void save(e)} noValidate>
          <div className="flex max-w-[420px] flex-col gap-4 border-t p-5">
            <Field
              id="password-current"
              label="Contraseña actual"
              value={values.current}
              onChange={(v) => edit("current", v)}
              placeholder="••••••••"
              autoComplete="current-password"
              show={show}
              onToggle={() => setShow((s) => !s)}
              border={f.current.error ? "destructive" : "muted"}
            >
              {f.current.error && (
                <Hint id="password-current-hint" tone="destructive">
                  {f.current.error}
                </Hint>
              )}
            </Field>
            <Field
              id="password-next"
              label="Contraseña nueva"
              value={values.next}
              onChange={(v) => edit("next", v)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              show={show}
              onToggle={() => setShow((s) => !s)}
              border={f.next.invalid ? "destructive" : "muted"}
            >
              <span className="mt-0.5 flex gap-1" aria-hidden>
                {[1, 2, 3, 4].map((k) => (
                  <span
                    key={k}
                    className={cn(
                      "h-[3px] flex-1 rounded-[2px]",
                      k > f.score
                        ? "bg-muted"
                        : f.score >= 3
                          ? "bg-win"
                          : "bg-sidebar-primary"
                    )}
                  />
                ))}
              </span>
              <Hint id="password-next-hint" tone={f.next.tone}>
                {f.next.message}
              </Hint>
            </Field>
            <Field
              id="password-confirm"
              label="Repite la contraseña nueva"
              value={values.confirm}
              onChange={(v) => edit("confirm", v)}
              placeholder="••••••••"
              autoComplete="new-password"
              show={show}
              onToggle={() => setShow((s) => !s)}
              border={f.confirm.border}
            >
              {f.confirm.message && (
                <Hint id="password-confirm-hint" tone={f.confirm.tone}>
                  {f.confirm.message}
                </Hint>
              )}
            </Field>
            <p className="flex items-start gap-2.5 text-[13px]">
              <InfoIcon
                className="mt-px size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">
                  Se va a cerrar la sesión en tus otros dispositivos.
                </span>
                <span className="text-xs text-muted-foreground">
                  Este dispositivo sigue con la sesión iniciada.
                </span>
              </span>
            </p>
            {change.error != null && !fieldError && (
              <ErrorAlert message={errorMessage(change.error)} />
            )}
          </div>
          <div className="flex justify-end gap-2 border-t bg-muted/50 px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              className="text-[13px] text-muted-foreground"
              onClick={close}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              // Atenuado hasta que todo es válido, pero se puede tocar para ver los errores.
              aria-disabled={!f.canSave || undefined}
              disabled={change.isPending}
              className={cn("text-[13px]", !f.canSave && "opacity-55")}
            >
              {change.isPending ? "Guardando…" : "Guardar contraseña"}
            </Button>
          </div>
        </form>
      )}
    </SectionCard>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  show,
  onToggle,
  border,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoComplete: string
  show: boolean
  onToggle: () => void
  border: Tone
  children?: ReactNode
}) {
  const Eye = show ? EyeOffIcon : EyeIcon
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      <span className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={border === "destructive" || undefined}
          aria-describedby={children ? `${id}-hint` : undefined}
          className={cn("h-[34px] pr-10 dark:bg-transparent", BORDER[border])}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={show}
          className="absolute top-[3px] right-[3px] grid size-7 place-items-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Eye className="size-4" aria-hidden />
        </button>
      </span>
      {children}
    </div>
  )
}

function Hint({
  id,
  tone,
  children,
}: {
  id: string
  tone: Tone
  children: ReactNode
}) {
  return (
    <span id={id} className={cn("text-xs", TEXT[tone])}>
      {children}
    </span>
  )
}
