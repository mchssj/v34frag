import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"

import { applyFieldErrors } from "@/api/errors"
import { useLogin } from "@/auth/queries"
import { loginSchema, type LoginValues } from "@/auth/schemas"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { FormAlert } from "./FormAlert"
import { TextField } from "./TextField"
import { useRetryCountdown } from "./useRetryCountdown"

const FIELDS = ["email", "password"] as const

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const navigate = useNavigate()
  const login = useLogin()
  const [formError, setFormError] = useState<unknown>(null)
  const retryIn = useRetryCountdown(login.error)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
    mode: "onTouched",
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      await login.mutateAsync(values)
      // replace: volver atrás no regresa al login.
      await navigate({ href: redirectTo, replace: true })
    } catch (e) {
      if (!applyFieldErrors(e, form.setError, FIELDS)) setFormError(e)
      form.resetField("password", { keepError: true })
    }
  })

  const busy = form.formState.isSubmitting

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <FormAlert error={formError} retryIn={retryIn} />
        <TextField
          control={form.control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
        />
        <TextField
          control={form.control}
          name="password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
        />
        <Controller
          control={form.control}
          name="remember"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox
                id="remember"
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
              />
              <FieldLabel htmlFor="remember" className="font-normal">
                Recordarme en este equipo
              </FieldLabel>
            </Field>
          )}
        />
        <Button type="submit" disabled={busy || retryIn > 0}>
          {busy && <Spinner />}
          Ingresar
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link
            to="/registro"
            className="text-foreground underline underline-offset-4"
          >
            Crear cuenta
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
