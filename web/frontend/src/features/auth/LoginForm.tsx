import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useState, type ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"

import { applyFieldErrors, errorMessage, isRetryable } from "@/api/errors"
import { useLogin } from "@/auth/queries"
import { loginSchema, type LoginValues } from "@/auth/schemas"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { needsWelcome } from "@/features/onboarding/queries"
import { AuthField, AuthHeading, ErrorAlert } from "./ui"
import { useRetryCountdown } from "./useRetryCountdown"

const FIELDS = ["email", "password"] as const

export function LoginForm({
  redirectTo,
  notice,
}: {
  redirectTo: string
  notice?: ReactNode
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const login = useLogin()
  const [formError, setFormError] = useState<unknown>(null)
  const retryIn = useRetryCountdown(formError)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
    mode: "onTouched",
  })

  // Los errores generales se limpian al escribir.
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: () => setFormError(null),
      }),
    [form]
  )

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      const user = await login.mutateAsync(values)
      // Quien viene de la aplicación del anticheat vuelve a su código: la bienvenida puede esperar.
      if (
        !redirectTo.startsWith("/anticheat/") &&
        (await needsWelcome(queryClient, user.id))
      ) {
        await navigate({ to: "/welcome", replace: true })
      } else {
        await navigate({ href: redirectTo, replace: true })
      }
    } catch (e) {
      if (!applyFieldErrors(e, form.setError, FIELDS)) setFormError(e)
    }
  })

  const busy = form.formState.isSubmitting

  return (
    <div className="flex w-full max-w-[360px] flex-col gap-5">
      <AuthHeading
        center
        title="Inicia sesión"
        subtitle="Ingresa tu email para entrar a tu cuenta"
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
        <AuthField
          control={form.control}
          name="password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
        />
        <Controller
          control={form.control}
          name="remember"
          render={({ field }) => (
            <div className="-mt-1 flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
              />
              <label
                htmlFor="remember"
                className="text-[13px] text-muted-foreground"
              >
                Recordarme en este equipo
              </label>
            </div>
          )}
        />
        <Button
          type="submit"
          size="lg"
          className="w-full text-sm"
          disabled={busy || retryIn > 0}
        >
          {busy ? "Entrando…" : "Iniciar sesión"}
        </Button>
      </form>
      <p className="text-center text-[13px] text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link
          to="/register"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Regístrate
        </Link>
      </p>
    </div>
  )
}
