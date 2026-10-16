import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { InfoIcon } from "lucide-react"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"

import { applyFieldErrors } from "@/api/errors"
import { aliasAvailabilityOptions, useSignup } from "@/auth/queries"
import { signupSchema, type SignupValues } from "@/auth/schemas"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { ALIAS_REASON_TEXT, AliasStatus } from "./AliasStatus"
import { FormAlert } from "./FormAlert"
import { TextField } from "./TextField"
import { useRetryCountdown } from "./useRetryCountdown"

const FIELDS = ["email", "password", "tag"] as const

export function SignupForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const signup = useSignup()
  const [formError, setFormError] = useState<unknown>(null)
  const retryIn = useRetryCountdown(signup.error)

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", tag: "" },
    mode: "onTouched",
  })
  const tag = useWatch({ control: form.control, name: "tag" })

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    // Si ya se sabe que el alias no está disponible, no se envía.
    const known = queryClient.getQueryData(
      aliasAvailabilityOptions(values.tag).queryKey
    )
    if (known && !known.available) {
      form.setError("tag", {
        type: "server",
        message: known.reason
          ? ALIAS_REASON_TEXT[known.reason]
          : "Ese alias no está disponible.",
      })
      return
    }
    try {
      const result = await signup.mutateAsync(values)
      if (result.needsConfirmation) {
        await navigate({
          to: "/registro/confirmar",
          state: { signupEmail: values.email },
        })
      } else {
        await navigate({
          to: "/completar-perfil",
          search: { paso: "datos" },
          replace: true,
        })
      }
    } catch (e) {
      if (!applyFieldErrors(e, form.setError, FIELDS)) setFormError(e)
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
          autoComplete="new-password"
          description="Entre 6 y 72 caracteres."
        />
        <TextField
          control={form.control}
          name="tag"
          label="Alias"
          autoComplete="nickname"
          description="Tu nombre en la web. De 2 a 24 caracteres. Podrás cambiarlo cada 15 días."
        >
          <AliasStatus value={tag} />
        </TextField>
        <Alert>
          <InfoIcon />
          <AlertDescription>
            Para entrar a un equipo necesitas tener tu SteamID vinculado a la
            cuenta. Lo vincula un administrador.
          </AlertDescription>
        </Alert>
        <Button type="submit" disabled={busy || retryIn > 0}>
          {busy && <Spinner />}
          Crear cuenta
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link
            to="/ingresar"
            className="text-foreground underline underline-offset-4"
          >
            Ingresar
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
