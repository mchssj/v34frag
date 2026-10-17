import {
  Link,
  Outlet,
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router"
import { LogOutIcon, UserRoundIcon } from "lucide-react"

import { requireAuth } from "@/auth/guards"
import { useLogout, useMe } from "@/auth/queries"
import { ROLE_LABEL } from "@/auth/roles"
import { RouteError } from "@/components/RouteError"
import { Logo } from "@/components/brand/Logo"
import { ThemeToggle } from "@/components/brand/ThemeToggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export const Route = createFileRoute("/_app")({
  beforeLoad: requireAuth,
  errorComponent: RouteError,
  component: AppLayout,
})

// Layout con sesión. Provisorio hasta el diseño final.
function AppLayout() {
  const initial = Route.useRouteContext({ select: (c) => c.user })
  // useMe se mantiene al día (por ejemplo, si cambia el rol); la guarda garantiza el primer valor.
  const user = useMe().data ?? initial
  const logout = useLogout()
  const navigate = useNavigate()

  async function onLogout() {
    await logout.mutateAsync()
    await navigate({ to: "/", replace: true })
  }

  const alias = user.tag ?? user.email ?? "Cuenta"

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between gap-6 border-b bg-background/80 px-6 backdrop-blur-[10px]">
        <nav className="flex items-center gap-6">
          <Link to="/home" aria-label="CSSTV, ir al inicio">
            <Logo />
          </Link>
          <Link
            to="/home"
            className="text-sm text-muted-foreground [&.active]:text-foreground"
          >
            Inicio
          </Link>
          {user.role === "admin" && (
            <Link
              to="/admin"
              className="text-sm text-muted-foreground [&.active]:text-foreground"
            >
              Admin
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <Avatar className="size-7">
                <AvatarFallback>
                  {alias.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline">{alias}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span>{alias}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {user.email} · {ROLE_LABEL[user.role]}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/welcome">
                <UserRoundIcon /> Completar perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => void onLogout()}
              disabled={logout.isPending}
            >
              <LogOutIcon /> Salir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </header>
      <div className="flex-1 p-6">
        <Outlet />
      </div>
    </div>
  )
}
