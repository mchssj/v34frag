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
import { AccountMenu } from "./AccountMenu"
import { useBadgeCounts } from "./queries"

const itemClass =
  "gap-2.5 px-2 rounded-lg data-active:font-semibold [&_svg]:size-4"

export function AppSidebar({ user }: { user: AuthUser }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const myNick = useQuery(myProfileOptions).data?.player?.nick
  const active = activeNavKey(pathname, myNick)
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
        <AccountMenu
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
  adminBans: (n) => `${n} baneos activos`,
  adminClips: (n) => `${n} clips para revisar`,
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
        (kind === "adminTeams" || kind === "adminClips") &&
          "rounded-md bg-muted px-1.5 font-mono",
        kind === "adminBans" &&
          "rounded-md bg-destructive/15 px-1.5 font-mono text-destructive"
      )}
    >
      {kind === "live" && (
        <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
      )}
      {count}
    </SidebarMenuBadge>
  )
}
