import { useQuery } from "@tanstack/react-query"
import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import { cn } from "cn"
import {
  ExternalLinkIcon,
  LinkIcon,
  LockIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { steamStatusOptions } from "@/features/onboarding/queries"
import type { AppPath } from "@/features/shell/nav"
import { myProfileOptions } from "./queries"

export const PROFILE_SECTIONS: {
  to: AppPath
  label: string
  icon: LucideIcon
}[] = [
  { to: "/profile", label: "Perfil", icon: UserIcon },
  { to: "/profile/privacy", label: "Privacidad", icon: LockIcon },
  { to: "/profile/link", label: "Vinculación", icon: LinkIcon },
  {
    to: "/profile/preferences",
    label: "Preferencias",
    icon: SlidersHorizontalIcon,
  },
  { to: "/profile/account", label: "Cuenta", icon: SettingsIcon },
]

/** Mi perfil: encabezado, navegación por secciones (cada una con su URL) y la sección actual. */
export function ProfileLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const profile = useQuery(myProfileOptions).data
  const linked = (useQuery(steamStatusOptions).data?.steam_ids.length ?? 0) > 0
  const nick = profile?.player?.nick

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-[-0.4px]">
            Mi perfil
          </h1>
          <p className="text-sm text-muted-foreground">
            Tu identidad pública y cómo está vinculada a tu jugador.
          </p>
        </div>
        {nick && (
          <Button asChild variant="outline" className="text-[13px]">
            <Link to="/player/$nick" params={{ nick }}>
              <ExternalLinkIcon aria-hidden />
              Ver perfil público
            </Link>
          </Button>
        )}
      </div>

      <div className="grid items-start gap-5 md:grid-cols-[200px_minmax(0,1fr)] md:gap-7">
        <nav
          aria-label="Secciones de Mi perfil"
          className="-mx-1 flex gap-0.5 overflow-x-auto px-1 md:sticky md:top-[70px] md:mx-0 md:flex-col md:overflow-visible md:px-0"
        >
          {PROFILE_SECTIONS.map(({ to, label, icon: Icon }) => {
            const active = pathname === to
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[34px] shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm whitespace-nowrap transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                  active && "bg-accent font-semibold"
                )}
              >
                <Icon className="size-[15px]" aria-hidden />
                <span className="flex-1">{label}</span>
                {to === "/profile/link" && profile && !linked && (
                  <span
                    className="size-1.5 rounded-full bg-primary"
                    aria-label="Sin jugador vinculado"
                  />
                )}
              </Link>
            )
          })}
        </nav>
        <div className="flex max-w-[720px] min-w-0 flex-col gap-4">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
