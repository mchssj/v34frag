import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import type { AuthUser } from "@/auth/queries"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { AuthShell, type SideCopy } from "@/features/auth/AuthShell"
import { ErrorAlert, StepButton, StepProgress } from "@/features/auth/ui"
import { myProfileOptions, useUpdateProfile } from "@/features/profile/queries"
import {
  COUNTRIES,
  GAME_ROLES,
  filledFields,
  personalSchema,
  socialsSchema,
  type SocialsInput,
  type SocialsValues,
} from "@/features/profile/schemas"
import { ClaimStep } from "./ClaimStep"
import { ContactsStep } from "./ContactsStep"
import { PhotoStep } from "./PhotoStep"
import { PlayStyleStep, type Country, type GameRole } from "./PlayStyleStep"
import {
  markStepSaved,
  markWelcomeSeen,
  onboardingFrom,
  steamStatusOptions,
  welcomeSteps,
  type WelcomeStep,
} from "./queries"

const STEP_NAME: Record<WelcomeStep, string> = {
  photo: "Foto y nombre",
  style: "Estilo de juego",
  contacts: "Contactos",
  link: "Vinculación",
}
const SIDE: Record<WelcomeStep, SideCopy> = {
  photo: {
    title: "Una foto hace que te reconozcan en el roster.",
    subtitle: "Puedes cambiarla desde Mi perfil.",
  },
  style: {
    title: "Los capitanes buscan jugadores por rol para sus PCW.",
    subtitle: "Puedes cambiarlo desde tu perfil.",
  },
  contacts: {
    title: "La mayoría de los equipos se coordina por Discord.",
    subtitle: "Agrégalo para que te inviten a PCW.",
  },
  link: {
    title: "Escribe el código en el chat del servidor.",
    subtitle: "Tu SteamID queda vinculado a tu cuenta.",
  },
}
const DONE_MESSAGE = "¡Listo! Ya puedes jugar tu primer mix."
const LATER_MESSAGE = "Puedes completar tu perfil cuando quieras"

const isRole = (v: unknown): v is GameRole =>
  (GAME_ROLES as readonly unknown[]).includes(v) && v !== "Otro"
const isCountry = (v: unknown): v is Country =>
  (COUNTRIES as readonly unknown[]).includes(v)

/**
 * Bienvenida del primer login: foto y nombre, estilo de juego, contactos y vinculación por
 * !claim (todos opcionales). Muestra solo los pasos que faltan al entrar.
 */
export function WelcomeFlow({ user }: { user: AuthUser }) {
  const navigate = useNavigate()
  const profile = useQuery(myProfileOptions)
  const [steps, setSteps] = useState<WelcomeStep[] | null>(null)
  const [index, setIndex] = useState(0)
  const current = steps?.[index] ?? null
  // En la vinculación se consulta cada 5 s hasta que el SteamID queda vinculado.
  const steam = useQuery({
    ...steamStatusOptions,
    refetchInterval: (q) =>
      current === "link" && !(q.state.data?.steam_ids.length ?? 0)
        ? 5000
        : false,
  })
  const update = useUpdateProfile()
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState<string | null>(null)
  const [role, setRole] = useState<GameRole>("Rifler")
  const [country, setCountry] = useState<Country>("Argentina")
  const details = profile.data?.details
  // `values` sigue al perfil guardado (react-hook-form solo reinicia si cambia de verdad).
  const contacts = useForm<SocialsInput, unknown, SocialsValues>({
    resolver: zodResolver(socialsSchema),
    defaultValues: { discord: "", steam: "", faceit: "" },
    values: details && {
      discord: details.discord ?? "",
      steam: details.steam ?? "",
      faceit: details.faceit ?? "",
    },
  })

  // Se marca como vista al entrar: después queda el aviso del Home.
  useEffect(() => markWelcomeSeen(user.id), [user.id])

  // Los pasos se arman una vez, con lo que ya tenga cargado el perfil.
  if (steps === null && profile.data && steam.data) {
    const d = profile.data.details
    setName(d?.real_name ?? "")
    if (isRole(d?.game_role)) setRole(d.game_role)
    if (isCountry(d?.country)) setCountry(d.country)
    setSteps(welcomeSteps(onboardingFrom(profile.data, steam.data)))
  }

  const total = steps?.length ?? 0
  const isLast = index === total - 1

  function finish(message: string) {
    toast(message)
    void navigate({ to: "/home", replace: true })
  }

  /** Después de guardar: siguiente paso, o termina si era el último. */
  function advance() {
    if (isLast) return finish(DONE_MESSAGE)
    toast("Perfil actualizado")
    setIndex(index + 1)
  }

  async function savePhoto() {
    const parsed = personalSchema.shape.real_name.safeParse(name)
    if (!parsed.success) return setNameError(parsed.error.issues[0].message)
    setNameError(null)
    if (parsed.data !== (profile.data?.details?.real_name ?? ""))
      await update.mutateAsync({ real_name: parsed.data || null })
    // Guardar con todo vacío también cuenta como hecho (paso opcional).
    markStepSaved(user.id, "photo")
    advance()
  }

  async function saveStyle() {
    await update.mutateAsync({ game_role: role, country })
    advance()
  }

  const saveContacts = contacts.handleSubmit(async (values) => {
    const filled = filledFields(values)
    if (Object.keys(filled).length) await update.mutateAsync(filled)
    markStepSaved(user.id, "contacts")
    advance()
  })

  async function save() {
    try {
      if (current === "photo") await savePhoto()
      else if (current === "style") await saveStyle()
      else if (current === "contacts") await saveContacts()
    } catch {
      // El error se muestra con ErrorAlert.
    }
  }

  const linked = (steam.data?.steam_ids.length ?? 0) > 0
  const alias = user.tag ?? "jugador"
  // El saludo va en el primer paso que se ve.
  const greetAlias = index === 0 ? alias : null

  return (
    <AuthShell
      swap={{ label: "Saltar por ahora", onClick: () => finish(LATER_MESSAGE) }}
      side={current ? SIDE[current] : null}
    >
      {current === null ? (
        profile.isError || steam.isError ? (
          <ErrorAlert message={errorMessage(profile.error ?? steam.error)} />
        ) : (
          <Spinner className="size-6 text-muted-foreground" />
        )
      ) : (
        <div className="flex w-full max-w-[520px] flex-col gap-6">
          <StepProgress
            total={total}
            current={index + 1}
            label={`Completa tu perfil · paso ${index + 1} de ${total} · ${STEP_NAME[current]}`}
          />

          {current === "photo" && (
            <PhotoStep
              alias={alias}
              greet={index === 0}
              avatarUrl={profile.data?.details?.avatar_url}
              name={name}
              nameError={nameError}
              onName={setName}
            />
          )}
          {current === "style" && (
            <PlayStyleStep
              greetAlias={greetAlias}
              role={role}
              country={country}
              onRole={setRole}
              onCountry={setCountry}
            />
          )}
          {current === "contacts" && (
            <ContactsStep control={contacts.control} greetAlias={greetAlias} />
          )}
          {current === "link" && <ClaimStep status={steam.data} />}

          {update.error != null && current !== "link" && (
            <ErrorAlert message={errorMessage(update.error)} />
          )}

          <div className="flex items-center justify-end gap-2">
            {(current !== "link" || !linked) && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="px-3.5 text-sm font-normal text-muted-foreground"
                onClick={() =>
                  isLast
                    ? finish(
                        current === "link"
                          ? "Puedes vincular tu jugador desde Mi perfil"
                          : LATER_MESSAGE
                      )
                    : setIndex(index + 1)
                }
              >
                Lo hago después
              </Button>
            )}
            {current === "link" ? (
              <StepButton
                ready={linked}
                onClick={() => linked && finish(DONE_MESSAGE)}
              >
                Terminar
              </StepButton>
            ) : (
              <StepButton
                ready
                disabled={update.isPending}
                onClick={() => void save()}
              >
                {isLast ? "Guardar y terminar" : "Guardar y seguir"}
              </StepButton>
            )}
          </div>
        </div>
      )}
    </AuthShell>
  )
}
