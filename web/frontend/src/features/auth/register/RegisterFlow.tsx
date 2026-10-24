import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { useForm, useWatch } from "react-hook-form"

import { errorMessage, isApiError, isRetryable } from "@/api/errors"
import { useSignup } from "@/auth/queries"
import { signupSchema, type SignupValues } from "@/auth/schemas"
import { CONFIRMATION_LINK_EXPIRY } from "@/config/site"
import { mixesCopy, mixesTotalOptions } from "@/features/public/queries"
import { AuthShell, type SideCopy } from "../AuthShell"
import { ErrorAlert, StepButton, StepProgress } from "../ui"
import { useRetryCountdown } from "../useRetryCountdown"
import { AccountStep } from "./AccountStep"
import { AliasStep } from "./AliasStep"
import { CheckEmailStep } from "./CheckEmailStep"
import { aliasReady, useAliasStatus, type AliasState } from "./useAliasStatus"

type Step = 1 | 2 | 3
const STEP_NAME: Record<Step, string> = {
  1: "Cuenta",
  2: "Alias",
  3: "Confirma tu email",
}
const accountSchema = signupSchema.pick({ email: true, password: true })

/** Registro en 3 pasos, sin sesión. La cuenta se crea al confirmar el alias (paso 2). */
export function RegisterFlow() {
  const navigate = useNavigate()
  const signup = useSignup()
  const mixes = useQuery(mixesTotalOptions).data
  const [step, setStep] = useState<Step>(1)
  const [tried, setTried] = useState(false)
  const [formError, setFormError] = useState<unknown>(null)
  const [created, setCreated] = useState<{ alias: string; email: string }>()
  // Rechazo del backend para un alias concreto (409 en uso, 400 no permitido).
  const [rejected, setRejected] = useState<{
    alias: string
    state: AliasState
  }>()
  const retryIn = useRetryCountdown(formError)

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", tag: "" },
    mode: "onChange",
  })
  const [email, password, tag] = useWatch({
    control: form.control,
    name: ["email", "password", "tag"],
  })
  const liveAlias = useAliasStatus(tag)
  const aliasState =
    rejected && rejected.alias === tag.trim() ? rejected.state : liveAlias

  const accountReady = accountSchema.safeParse({ email, password }).success

  async function continueToAlias() {
    setTried(true)
    if (await form.trigger(["email", "password"])) setStep(2)
  }

  async function createAccount() {
    if (!aliasReady(aliasState) || signup.isPending) return
    if (!(await form.trigger())) return
    setFormError(null)
    const values = form.getValues()
    try {
      const result = await signup.mutateAsync(values)
      // La contraseña no queda en memoria después de crear la cuenta.
      form.resetField("password")
      if (result.session) {
        // La API no pidió confirmar el email: se sigue directo a la Bienvenida.
        await navigate({ to: "/welcome", replace: true })
        return
      }
      setCreated({ alias: values.tag.trim(), email: values.email.trim() })
      setStep(3)
    } catch (e) {
      if (isApiError(e)) {
        if (e.details.some((d) => d.path === "tag")) {
          setRejected({
            alias: values.tag.trim(),
            state: e.code === "CONFLICT" ? "taken" : "blocked",
          })
          return
        }
        const fieldIssue = e.details.find(
          (d) => d.path === "email" || d.path === "password"
        )
        // 409 sin detalle de campo: el email ya tiene una cuenta.
        if (fieldIssue || e.code === "CONFLICT") {
          form.setError((fieldIssue?.path as "email" | "password") ?? "email", {
            type: "server",
            message: fieldIssue?.message || e.message,
          })
          setTried(true)
          setStep(1)
          return
        }
      }
      setFormError(e)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (step === 1) void continueToAlias()
    else if (step === 2) void createAccount()
  }

  const side: SideCopy =
    step === 1
      ? mixes
        ? mixesCopy(mixes)
        : null
      : step === 2
        ? {
            title: "El alias aparece en el ranking, los planteles y el chat.",
            subtitle: "En el juego puedes usar el nombre que quieras.",
          }
        : {
            title: `El enlace vence en ${CONFIRMATION_LINK_EXPIRY}.`,
            // Provisorio: "Si vence, inicia sesión y te enviamos otro" requiere el reenvío del backend.
            subtitle: "Revisa también la carpeta de spam.",
          }

  return (
    <AuthShell swap={{ label: "Iniciar sesión", to: "/login" }} side={side}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex w-full max-w-[520px] flex-col gap-6"
      >
        <StepProgress
          total={3}
          current={step}
          label={`Paso ${step} de 3 · ${STEP_NAME[step]}`}
          onBack={step === 2 ? () => setStep(1) : undefined}
        />

        {step === 1 && <AccountStep control={form.control} tried={tried} />}
        {step === 2 && <AliasStep control={form.control} state={aliasState} />}
        {step === 3 && created && (
          <CheckEmailStep alias={created.alias} email={created.email} />
        )}

        {formError != null && (
          <ErrorAlert
            message={errorMessage(formError, { retryIn })}
            action={
              isRetryable(formError)
                ? { label: "Reintentar", onClick: () => void createAccount() }
                : undefined
            }
          />
        )}

        {step < 3 && (
          <div className="flex items-center justify-end gap-2">
            {step === 1 ? (
              <StepButton type="submit" ready={accountReady}>
                Continuar
              </StepButton>
            ) : (
              <StepButton
                type="submit"
                ready={aliasReady(aliasState) && retryIn === 0}
                disabled={signup.isPending}
              >
                {signup.isPending ? "Creando cuenta…" : "Crear cuenta"}
              </StepButton>
            )}
          </div>
        )}
      </form>
    </AuthShell>
  )
}
