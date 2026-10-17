import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"
import { z } from "zod"

import { safeRedirect } from "@/auth/redirect"
import { AuthShell, type SideCopy } from "@/features/auth/AuthShell"
import { LoginForm } from "@/features/auth/LoginForm"
import {
  featuredLiveOptions,
  mixesCopy,
  mixesTotalOptions,
  sideName,
} from "@/features/public/queries"

const searchSchema = z.object({
  aviso: z
    .enum(["cuenta-confirmada", "enlace-invalido"])
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute("/_auth/login")({
  validateSearch: searchSchema,
  component: LoginPage,
})

/** Partida oficial en vivo si la hay; si no, los mixes reportados (siempre datos reales). */
function useLoginSide(): SideCopy {
  const live = useQuery(featuredLiveOptions).data
  const mixes = useQuery(mixesTotalOptions).data
  if (live) {
    return {
      title: live.event
        ? `${live.event.name}: ${live.label ?? "partida"} en vivo.`
        : `${live.label ?? "Partida oficial"} en vivo.`,
      subtitle: `${sideName(live.side1)} vs ${sideName(live.side2)} · en vivo ahora`,
    }
  }
  return mixes ? mixesCopy(mixes) : null
}

function LoginPage() {
  const { redirect, aviso } = Route.useSearch()
  const side = useLoginSide()

  const notice =
    aviso === "cuenta-confirmada" ? (
      <p
        role="status"
        className="flex gap-2.5 rounded-lg border border-win/40 bg-win/8 px-3 py-2.5 text-[13px] text-win"
      >
        <CircleCheckIcon className="mt-px size-4 shrink-0" aria-hidden />
        Tu cuenta quedó confirmada. Ya puedes iniciar sesión.
      </p>
    ) : aviso === "enlace-invalido" ? (
      <p
        role="alert"
        className="flex gap-2.5 rounded-lg border border-destructive/40 bg-destructive/8 px-3 py-2.5 text-[13px] text-destructive"
      >
        <CircleAlertIcon className="mt-px size-4 shrink-0" aria-hidden />
        El enlace de confirmación no es válido o venció.
      </p>
    ) : undefined

  return (
    <AuthShell swap={{ label: "Crear cuenta", to: "/register" }} side={side}>
      <LoginForm
        redirectTo={safeRedirect(redirect, "/home")}
        notice={notice}
      />
    </AuthShell>
  )
}
