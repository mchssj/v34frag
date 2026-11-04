import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "@tanstack/react-router"
import { MailCheckIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"

import { applyFieldErrors, errorMessage, isRetryable } from "@/api/errors"
import { useForgotPassword } from "@/auth/queries"
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/auth/schemas"
import { AuthField } from "@/components/brand/AuthField"
import { ErrorAlert } from "@/components/brand/ErrorAlert"
import { Button } from "@/components/ui/button"
import { AuthHeading } from "../components/ui"
import { useRetryCountdown } from "../lib/useRetryCountdown"

const FIELDS = ["email"] as const

export function ForgotPasswordForm({ notice }: { notice?: ReactNode }) {
  const forgot = useForgotPassword()
  const [formError, setFormError] = useState<unknown>(null)
  const [sent, setSent] = useState(false)
  const retryIn = useRetryCountdown(formError)

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
    mode: "onTouched",
  })

  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: () => setFormError(null),
      }),
    [form]
  )

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setFormError(null)
    try {
      await forgot.mutateAsync(email)
      setSent(true)
    } catch (e) {
      if (!applyFieldErrors(e, form.setError, FIELDS)) setFormError(e)
    }
  })

  const busy = form.formState.isSubmitting

  if (sent) {
    // El mismo texto haya o no una cuenta: la API tampoco lo dice.
    return (
      <div className="flex w-full max-w-[360px] flex-col items-center gap-5 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary/14">
          <MailCheckIcon className="size-[26px] text-primary" aria-hidden />
        </span>
        <AuthHeading
          center
          title="Revisa tu correo"
          subtitle="Si hay una cuenta con ese email, te enviamos un enlace para elegir una contraseña nueva. Vence en una hora. Revisa también la carpeta de spam."
        />
        <Button asChild size="lg" className="w-full text-sm">
          <Link to="/login" search={{}}>
            Volver a iniciar sesión
          </Link>
        </Button>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          No me llegó, probar de nuevo
        </button>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-[360px] flex-col gap-5">
      <AuthHeading
        center
        title="¿Olvidaste tu contraseña?"
        subtitle="Escribe el email de tu cuenta y te enviamos un enlace para elegir una nueva"
      />
      {notice}
      {formError != null && (
        <ErrorAlert
          message={errorMessage(formError, { retryIn })}
          action={
            isRetryable(formError)
              ? { label: "Reintentar", onClick: () => void onSubmit() }
              : undefined
          }
        />
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <AuthField
          control={form.control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
        />
        <Button
          type="submit"
          size="lg"
          className="w-full text-sm"
          disabled={busy || retryIn > 0}
        >
          {busy ? "Enviando…" : "Enviar enlace"}
        </Button>
      </form>
      <p className="text-center text-[13px] text-muted-foreground">
        ¿Te acordaste?{" "}
        <Link
          to="/login"
          search={{}}
          className="font-medium text-foreground underline underline-offset-4"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
