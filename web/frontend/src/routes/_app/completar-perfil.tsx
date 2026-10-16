import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import { useMe } from "@/auth/queries"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AvatarStep } from "@/features/auth/onboarding/AvatarStep"
import { PersonalStep } from "@/features/auth/onboarding/PersonalStep"
import { SocialsStep } from "@/features/auth/onboarding/SocialsStep"

const STEPS = ["datos", "redes", "avatar"] as const
type Step = (typeof STEPS)[number]

const searchSchema = z.object({
  paso: z.enum(STEPS).catch("datos"),
})

const TITLES: Record<Step, { title: string; description: string }> = {
  datos: {
    title: "Datos personales",
    description: "Nombre, país y rol. Todo es opcional.",
  },
  redes: {
    title: "Redes",
    description: "Steam, FACEIT y Discord para tu perfil.",
  },
  avatar: {
    title: "Avatar",
    description: "La imagen que se ve junto a tu alias.",
  },
}

export const Route = createFileRoute("/_app/completar-perfil")({
  validateSearch: searchSchema,
  component: CompleteProfilePage,
})

function CompleteProfilePage() {
  const { paso } = Route.useSearch()
  const navigate = useNavigate()
  const initial = Route.useRouteContext({ select: (c) => c.user })
  const user = useMe().data ?? initial
  const index = STEPS.indexOf(paso)

  function next() {
    const following = STEPS[index + 1]
    if (following)
      void navigate({ to: "/completar-perfil", search: { paso: following } })
    else void navigate({ to: "/panel", replace: true })
  }

  const { title, description } = TITLES[paso]

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <p className="text-xs text-muted-foreground">
          Paso {index + 1} de {STEPS.length}
        </p>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* key: cada paso arranca con su formulario limpio. */}
        {paso === "datos" && <PersonalStep key="datos" onDone={next} />}
        {paso === "redes" && <SocialsStep key="redes" onDone={next} />}
        {paso === "avatar" && (
          <AvatarStep key="avatar" onDone={next} alias={user.tag ?? "?"} />
        )}
      </CardContent>
    </Card>
  )
}
