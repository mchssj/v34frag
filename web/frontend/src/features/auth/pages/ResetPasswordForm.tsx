import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import {
  applyFieldErrors,
  errorMessage,
  isApiError,
  isRetryable,
} from "@/api/errors"
import { useResetPassword } from "@/auth/queries"
import { resetPasswordSchema, type ResetPasswordValues } from "@/auth/schemas"
import { AuthField } from "@/components/brand/AuthField"
import { ErrorAlert } from "@/components/brand/ErrorAlert"
import { Button } from "@/components/ui/button"
import { AuthHeading, AuthNotice } from "../components/ui"
import { useRetryCountdown } from "../lib/useRetryCountdown"

/** Errores que gastan el link: hay que pedir otro correo. */
function linkSpent(e: unknown) {
  return isApiError(e, "INVALID_LINK") || isApiError(e, "SAME_PASSWORD")
}

export function ResetPasswordForm({ tokenHash }: { tokenHash: string | null }) {
  const navigate = useNavigate()
  const reset = useResetPassword()
  const [formError, setFormError] = useState<unknown>(null)
  const retryIn = useRetryCountdown(formError)

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm: "" },
    mode: "onTouched",
  })

  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: () => setFormError((e: unknown) => (linkSpent(e) ? e : null)),
      }),
    [form]
  )

  const onSubmit = form.handleSubmit(async ({ password }) => {
    if (!tokenHash) return
    setFormError(null)
    try {
      await reset.mutateAsync({ tokenHash, password })
      await navigate({ to: "/home", replace: true })
    } catch (e) {
      // El token ya se usó del lado de la API: el error del campo no sirve, va el aviso de pedir otro.
      if (linkSpent(e) || !applyFieldErrors(e, form.setError, ["password"]))
        setFormError(e)
    }
  })

  if (!tokenHash || linkSpent(formError)) {
    const same = isApiError(formError, "SAME_PASSWORD")
    return (
      <div className="flex w-full max-w-[360px] flex-col gap-5">
        <AuthHeading center title="Elige una contraseña nueva" />
        <AuthNotice tone="error">
          {same
            ? "La contraseña nueva tiene que ser distinta de la anterior. Este enlace ya se usó: pide otro correo y elige una distinta."
            : "El enlace no es válido o venció. Pide otro correo para elegir una contraseña nueva."}
        </AuthNotice>
        <Button asChild size="lg" className="w-full text-sm">
          <Link to="/forgot-password" search={{}}>
            Pedir otro correo
          </Link>
        </Button>
      </div>
    )
  }

  const busy = form.formState.isSubmitting

  return (
    <div className="flex w-full max-w-[360px] flex-col gap-5">
      <AuthHeading
        center
        title="Elige una contraseña nueva"
        subtitle="Al guardarla se cierra la sesión en todos tus otros dispositivos"
      />
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
          name="password"
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
        />
        <AuthField
          control={form.control}
          name="confirm"
          label="Repite la contraseña"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
        />
        <Button
          type="submit"
          size="lg"
          className="w-full text-sm"
          disabled={busy || retryIn > 0}
        >
          {busy ? "Guardando…" : "Guardar y entrar"}
        </Button>
      </form>
    </div>
  )
}
