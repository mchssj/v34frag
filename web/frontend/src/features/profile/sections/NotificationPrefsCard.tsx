import { useQuery } from "@tanstack/react-query"
import { InfoIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { Schemas } from "@/api/client"
import { errorMessage } from "@/api/errors"
import { getsAdminNotifications } from "@/auth/permissions"
import { useMe } from "@/auth/queries"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { myProfileOptions, useUpdateProfile } from "../queries"
import { CardTitle, SectionCard } from "../ui"

type Prefs = Schemas["NotificationPrefs"]
type Category = keyof Prefs

// Categorías del contrato (notificaciones.md); `always` = lo que llega aunque esté apagada.
const CATEGORIES: {
  key: Category
  title: string
  description: string
  always?: string
}[] = [
  {
    key: "team",
    title: "Equipos",
    description: "Invitaciones, pedidos, altas y bajas del plantel.",
    always: "Las invitaciones y los pedidos para entrar llegan siempre.",
  },
  {
    key: "tournament",
    title: "Torneos",
    description: "Inscripciones, fixture, veto y resultados.",
  },
  {
    key: "pcw",
    title: "PCW",
    description: "Te aceptan una práctica, la cancelan o sale el resultado.",
  },
  {
    key: "elo",
    title: "Mixes y ELO",
    description:
      "Cambios de nivel, mixes interrumpidos o borrados, ajustes de ELO y videos de tus jugadas.",
  },
  {
    key: "season",
    title: "Temporadas",
    description: "Tu puesto, el cierre de la temporada y las medallas.",
  },
  {
    key: "account",
    title: "Cuenta",
    description: "SteamID vinculados, alias y rol.",
    always: "El aviso de cambio de contraseña llega siempre.",
  },
  {
    key: "news",
    title: "Novedades",
    description: "Torneo nuevo y temporada nueva.",
  },
  {
    key: "admin",
    title: "Administración",
    description:
      "Pedidos de SteamID y de equipos, mixes por revisar y demos que fallaron.",
  },
]

/** Qué notificaciones llegan a la campana, por categoría. Se guarda al tocar cada una. */
export function NotificationPrefsCard() {
  const profile = useQuery(myProfileOptions)
  const role = useMe().data?.role
  const update = useUpdateProfile()
  // Lo elegido se ve enseguida; si la API falla, vuelve atrás.
  const [local, setLocal] = useState<Partial<Prefs>>({})
  const saved = profile.data?.preferences.notifications
  const shown = CATEGORIES.filter(
    (c) => c.key !== "admin" || (role && getsAdminNotifications(role))
  )

  async function toggle(key: Category, on: boolean) {
    setLocal((l) => ({ ...l, [key]: on }))
    try {
      await update.mutateAsync({
        preferences: { notifications: { [key]: on } },
      })
      toast("Preferencia guardada")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setLocal((l) => {
        const rest = { ...l }
        delete rest[key]
        return rest
      })
    }
  }

  return (
    <SectionCard className="px-5 py-1">
      <div className="border-b py-4">
        <CardTitle
          title="Notificaciones"
          description="Qué te avisamos en la campana. Solo en la web: sin Discord ni email."
        />
      </div>
      {!saved ? (
        <div className="flex flex-col gap-3 py-4">
          {shown.map((c) => (
            <Skeleton key={c.key} className="h-10 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {shown.map((c) => {
            const id = `notif-${c.key}`
            const on = local[c.key] ?? saved[c.key]
            return (
              <div
                key={c.key}
                className="flex items-center justify-between gap-4 border-b py-3.5"
              >
                <label htmlFor={id} className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{c.title}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {c.description}
                  </span>
                  {c.always && (
                    <span className="mt-1 flex items-center gap-1.5 text-xs">
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full bg-primary"
                      />
                      {c.always}
                    </span>
                  )}
                </label>
                <Switch
                  id={id}
                  checked={on}
                  onCheckedChange={(v) => void toggle(c.key, v)}
                />
              </div>
            )
          })}
          <p className="my-4 flex items-start gap-2 rounded-lg bg-muted p-3 text-[13px] leading-[1.45] text-pretty">
            <InfoIcon
              className="mt-px size-[15px] shrink-0 text-primary"
              aria-hidden
            />
            Con una categoría apagada, esas notificaciones no se guardan:
            prenderla de nuevo no trae las de antes.
          </p>
        </>
      )}
    </SectionCard>
  )
}
