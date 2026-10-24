import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { LogOutIcon } from "lucide-react"

import { useLogout, useMe } from "@/auth/queries"
import { ROLE_LABEL } from "@/auth/roles"
import { Button } from "@/components/ui/button"
import { timeAgo } from "@/features/shell/notifications/model"
import { myProfileOptions } from "../queries"
import { SectionCard } from "../ui"
import { PasswordCard } from "./PasswordCard"

const day = (iso: string | null | undefined) =>
  iso ? format(parseISO(iso), "d MMM yyyy", { locale: es }) : "—"

/** Contraseña, datos de la cuenta y cerrar sesión. */
export function AccountSection() {
  const user = useMe().data
  const profile = useQuery(myProfileOptions).data
  const logout = useLogout()
  const navigate = useNavigate()

  async function onLogout() {
    await logout.mutateAsync()
    await navigate({ to: "/", replace: true })
  }

  const teams = profile?.teams
    .map((t) => (t.is_captain ? `${t.name} (capitán)` : t.name))
    .join(" · ")
  const lastSeen = profile?.details?.last_seen

  const rows = [
    { k: "Registrado", v: day(user?.created_at) },
    { k: "Última conexión", v: lastSeen ? timeAgo(lastSeen) : "—" },
    { k: "Rol de cuenta", v: user ? ROLE_LABEL[user.role] : "—" },
    { k: "Equipos actuales", v: teams || "Ninguno" },
    {
      k: "Partidas jugadas en el servidor",
      v: String(profile?.matches_played ?? 0),
    },
  ]

  return (
    <>
      <PasswordCard />
      <SectionCard className="px-5 py-2">
        <dl>
          {rows.map((r) => (
            <div
              key={r.k}
              className="flex justify-between gap-3 border-b py-3 text-sm"
            >
              <dt className="text-muted-foreground">{r.k}</dt>
              <dd className="text-right font-medium">{r.v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-end py-3.5">
          <Button
            variant="outline"
            className="text-[13px] text-destructive hover:text-destructive"
            disabled={logout.isPending}
            onClick={() => void onLogout()}
          >
            <LogOutIcon aria-hidden />
            Cerrar sesión
          </Button>
        </div>
      </SectionCard>
    </>
  )
}
