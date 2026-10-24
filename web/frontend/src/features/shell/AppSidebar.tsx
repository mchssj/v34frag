import { Link, useRouterState } from "@tanstack/react-router"
import { cn } from "cn"
import { useQuery } from "@tanstack/react-query"

import type { AuthUser } from "@/auth/queries"
import { canAccessAdminSection } from "@/auth/permissions"
import { BrandMark, BrandWordmark } from "@/components/brand/Brand"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { myProfileOptions } from "@/features/profile/queries"
import { activeNavKey, NAV_GROUPS, type BadgeKey } from "./nav"
import { useBadgeCounts, useCrumbData, useShellIdentity } from "./queries"

const itemClass =
  "gap-2.5 px-2 rounded-lg data-active:font-semibold [&_svg]:size-4"

export function AppSidebar({ user }: { user: AuthUser }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = activeNavKey(pathname, useCrumbData(pathname))
  const counts = useBadgeCounts(user)
  const { isMobile, setOpenMobile } = useSidebar()
  // En el teléfono el menú es un panel: se cierra al navegar.
  const closeMobile = () => isMobile && setOpenMobile(false)

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(
      (i) => !i.admin || canAccessAdminSection(user.role, i.admin)
    ),
  })).filter((g) => g.items.length > 0)

  return (
    <Sidebar variant="inset" collapsible="icon">
      {/* En escritorio el contenedor inset ya pone 8px de padding; el panel móvil no. */}
      <SidebarHeader className={cn("p-0 pb-3", isMobile && "px-2 pt-2")}>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              tooltip="CM League"
              className="rounded-lg"
            >
              {/* El logo es una imagen decorativa: el link necesita su propio nombre. */}
              <Link
                to="/home"
                onClick={closeMobile}
                aria-label="CM League, ir al inicio"
              >
                <BrandMark className="size-8" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <BrandWordmark className="h-[15px] self-start" />
                  <span className="truncate text-[11px] leading-none text-muted-foreground">
                    Comunidad Counter-Strike: Source
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className={cn("gap-4", isMobile && "px-2")}>
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="p-0">
            <SidebarGroupLabel className="h-7 text-xs font-medium text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              {group.items.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={active === item.key}
                    tooltip={item.label}
                    className={itemClass}
                  >
                    <Link to={item.to} onClick={closeMobile}>
                      <item.icon aria-hidden />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.badge && (
                    <NavBadge kind={item.badge} count={counts[item.badge]} />
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className={cn("p-0 pt-2", isMobile && "px-2 pb-2")}>
        <UserButton
          user={user}
          active={active === "profile"}
          onNavigate={closeMobile}
        />
      </SidebarFooter>
    </Sidebar>
  )
}

const BADGE_LABEL: Record<BadgeKey, (n: number) => string> = {
  live: (n) => `${n} en vivo`,
  pcw: (n) => `${n} solicitudes abiertas`,
  adminTeams: (n) => `${n} pendientes`,
}

/** Badge de un ítem. En 0 (o mientras carga) no se muestra. */
function NavBadge({ kind, count }: { kind: BadgeKey; count?: number }) {
  if (!count) return null
  return (
    <SidebarMenuBadge
      aria-label={BADGE_LABEL[kind](count)}
      className={cn(
        "text-[11px] font-semibold",
        kind === "live" && "gap-1 text-destructive",
        kind === "pcw" && "font-mono font-normal text-muted-foreground",
        kind === "adminTeams" && "rounded-md bg-muted px-1.5 font-mono"
      )}
    >
      {kind === "live" && (
        <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
      )}
      {count}
    </SidebarMenuBadge>
  )
}

function roleLabel(
  role: AuthUser["role"],
  team?: { name: string; is_captain: boolean }
) {
  if (role === "admin") return "Admin"
  if (role === "organizer") return "Organizador"
  if (team) return `${team.is_captain ? "Capitán" : "Miembro"} de ${team.name}`
  return "Jugador"
}

/** Pie: avatar, alias, rol y nivel. Lleva a Mi perfil. */
function UserButton({
  user,
  active,
  onNavigate,
}: {
  user: AuthUser
  active: boolean
  onNavigate: () => void
}) {
  const { team, level } = useShellIdentity()
  const avatar = useQuery(myProfileOptions).data?.details.avatar_url
  const alias = user.tag ?? "Jugador"
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          asChild
          isActive={active}
          tooltip="Mi perfil"
          className="gap-2.5 rounded-lg"
        >
          <Link
            to="/profile"
            onClick={onNavigate}
            aria-label={`Mi perfil, ${alias}`}
          >
            <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-[13px] font-semibold">
              {avatar ? (
                <img src={avatar} alt="" className="size-full object-cover" />
              ) : (
                alias.slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-[1.25]">
              <span className="truncate text-sm font-semibold">{alias}</span>
              <span className="truncate text-xs text-muted-foreground">
                {roleLabel(user.role, team)}
              </span>
            </span>
            {level !== null && (
              <span
                aria-label={`Nivel ${level}`}
                className="grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-md bg-foreground px-1 font-mono text-[11px] font-semibold text-background"
              >
                {level}
              </span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
