import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import type { AuthUser } from "@/auth/queries"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { AuthShell, type SideCopy } from "@/features/auth/AuthShell"
import { ErrorAlert, StepButton, StepProgress } from "@/features/auth/ui"
import { myProfileOptions, useUpdateProfile } from "@/features/profile/queries"
import { COUNTRIES, GAME_ROLES } from "@/features/profile/schemas"
import { ClaimStep } from "./ClaimStep"
import { PlayStyleStep, type Country, type GameRole } from "./PlayStyleStep"
import {
  markWelcomeSeen,
  onboardingFrom,
  steamStatusOptions,
} from "./queries"

type Step = 1 | 2
const STEP_NAME: Record<Step, string> = { 1: "Estilo de juego", 2: "Vinculación" }
const SIDE: Record<Step, SideCopy> = {
  1: {
    title: "Los capitanes buscan jugadores por rol para sus PCW.",
    subtitle: "Puedes cambiarlo desde tu perfil.",
  },
  2: {
    title: "Escribe el código en el chat del servidor.",
    subtitle: "Tu SteamID queda vinculado a tu cuenta.",
  },
}

const isRole = (v: unknown): v is GameRole =>
  (GAME_ROLES as readonly unknown[]).includes(v) && v !== "Otro"
const isCountry = (v: unknown): v is Country =>
  (COUNTRIES as readonly unknown[]).includes(v)

/** Bienvenida del primer login: estilo de juego y vinculación por !claim (los dos opcionales). */
export function WelcomeFlow({ user }: { user: AuthUser }) {
  const navigate = useNavigate()
  const profile = useQuery(myProfileOptions)
  const [step, setStep] = useState<Step | null>(null)
  // En el paso 2 se consulta cada 5 s hasta que el SteamID queda vinculado.
  const steam = useQuery({
    ...steamStatusOptions,
    refetchInterval: (q) =>
      step === 2 && !(q.state.data?.steam_ids.length ?? 0) ? 5000 : false,
  })
  const update = useUpdateProfile()
  const [role, setRole] = useState<GameRole>("Rifler")
  const [country, setCountry] = useState<Country>("Argentina")

  // Se marca como vista al entrar: después queda el aviso del Home.
  useEffect(() => markWelcomeSeen(user.id), [user.id])

  // Arranca en el primer paso pendiente, con lo que ya tenga cargado el perfil.
  if (step === null && profile.data && steam.data) {
    const status = onboardingFrom(profile.data, steam.data)
    const details = profile.data.details
    if (isRole(details?.game_role)) setRole(details.game_role)
    if (isCountry(details?.country)) setCountry(details.country)
    setStep(status.style && !status.linked ? 2 : 1)
  }

  function finish(message: string) {
    toast(message)
    void navigate({ to: "/home", replace: true })
  }

  async function saveStyle() {
    try {
      await update.mutateAsync({ game_role: role, country })
      toast("Perfil actualizado")
      setStep(2)
    } catch {
      // El error se muestra con ErrorAlert.
    }
  }

  const linked = (steam.data?.steam_ids.length ?? 0) > 0
  const alias = user.tag ?? "jugador"

  return (
    <AuthShell
      swap={{
        label: "Saltar por ahora",
        onClick: () => finish("Puedes completar tu perfil cuando quieras"),
      }}
      side={step ? SIDE[step] : null}
    >
      {step === null ? (
        profile.isError || steam.isError ? (
          <ErrorAlert message={errorMessage(profile.error ?? steam.error)} />
        ) : (
          <Spinner className="size-6 text-muted-foreground" />
        )
      ) : (
        <div className="flex w-full max-w-[520px] flex-col gap-6">
          <StepProgress
            total={2}
            current={step}
            label={`Completa tu perfil · paso ${step} de 2 · ${STEP_NAME[step]}`}
          />

          {step === 1 ? (
            <PlayStyleStep
              alias={alias}
              role={role}
              country={country}
              onRole={setRole}
              onCountry={setCountry}
            />
          ) : (
            <ClaimStep status={steam.data} />
          )}

          {update.error != null && step === 1 && (
            <ErrorAlert message={errorMessage(update.error)} />
          )}

          <div className="flex items-center justify-end gap-2">
            {(step === 1 || !linked) && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="px-3.5 text-sm font-normal text-muted-foreground"
                onClick={() =>
                  step === 1
                    ? setStep(2)
                    : finish("Puedes vincular tu jugador desde Mi perfil")
                }
              >
                Lo hago después
              </Button>
            )}
            {step === 1 ? (
              <StepButton
                ready
                disabled={update.isPending}
                onClick={() => void saveStyle()}
              >
                Guardar y seguir
              </StepButton>
            ) : (
              <StepButton
                ready={linked}
                onClick={() =>
                  linked && finish("¡Listo! Ya puedes jugar tu primer mix.")
                }
              >
                Terminar
              </StepButton>
            )}
          </div>
        </div>
      )}
    </AuthShell>
  )
}
