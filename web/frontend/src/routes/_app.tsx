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
      <header className="flex items-center justify-between border-b px-4 py-3">
        <nav className="flex items-center gap-4">
          <Link to="/" className="font-heading font-bold tracking-tight">
            v34frag
          </Link>
          <Link
            to="/panel"
            className="text-sm text-muted-foreground [&.active]:text-foreground"
          >
            Panel
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
              <Link to="/completar-perfil" search={{ paso: "datos" }}>
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
      </header>
      <div className="flex-1 p-6">
        <Outlet />
      </div>
    </div>
  )
}
