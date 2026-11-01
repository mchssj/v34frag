import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ChevronsUpDownIcon,
  LogOutIcon,
  PencilIcon,
  SlidersHorizontalIcon,
  UserRoundIcon,
} from "lucide-react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { useState } from "react"

import { useLogout, type AuthUser } from "@/auth/queries"
import { THEME_MODES } from "@/components/brand/ThemeSwitch"
import { useTheme, type Theme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { myProfileOptions } from "@/features/profile/queries"
import { useShellIdentity } from "./queries"

function roleLabel(
  role: AuthUser["role"],
  team: { name: string; is_captain: boolean } | undefined
) {
  if (role === "admin") return "Admin"
  if (role === "organizer") return "Organizador"
  if (role === "moderator") return "Moderador"
  if (team) return `${team.is_captain ? "Capitán" : "Miembro"} de ${team.name}`
  return "Jugador"
}

/**
 * Pie del sidebar: avatar, alias, rol y nivel. Abre el menú de la cuenta (perfil público, editar
 * perfil, cuenta, tema y cerrar sesión). Sin jugador vinculado no hay perfil público.
 */
export function AccountMenu({
  user,
  active,
  onNavigate,
}: {
  user: AuthUser
  active: boolean
  onNavigate: () => void
}) {
  const { team, level } = useShellIdentity()
  const { isMobile, state } = useSidebar()
  const profile = useQuery(myProfileOptions).data
  const avatar = profile?.details.avatar_url
  const nick = profile?.player?.nick
  const alias = user.tag ?? "Jugador"
  const [leaving, setLeaving] = useState(false)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              isActive={active}
              aria-label={`Menú de cuenta, ${alias}`}
              className="gap-2.5 rounded-lg data-[state=open]:bg-sidebar-accent"
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
              <ChevronsUpDownIcon
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            // Con el sidebar colapsado el pie es solo el avatar: el menú sale al costado.
            side={state === "collapsed" && !isMobile ? "right" : "top"}
            align="end"
            className="min-w-56 p-1"
          >
            {nick && (
              <DropdownMenuItem asChild className="h-8 gap-2">
                <Link to="/player/$nick" params={{ nick }} onClick={onNavigate}>
                  <UserRoundIcon aria-hidden />
                  Ver perfil público
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild className="h-8 gap-2">
              <Link to="/profile" onClick={onNavigate}>
                <PencilIcon aria-hidden />
                Editar perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="h-8 gap-2">
              <Link to="/profile/account" onClick={onNavigate}>
                <SlidersHorizontalIcon aria-hidden />
                Cuenta
              </Link>
            </DropdownMenuItem>
            <ThemeRow />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="h-8 gap-2"
              onSelect={() => setLeaving(true)}
            >
              <LogOutIcon aria-hidden />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <LogoutDialog open={leaving} onOpenChange={setLeaving} />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

/** "Tema" con Claro, Oscuro y Sistema en una fila: son ítems de radio, así se llega con el teclado. */
function ThemeRow() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="flex h-8 items-center gap-2 px-1.5 text-sm">
      <span className="flex-1">Tema</span>
      <DropdownMenuPrimitive.RadioGroup
        value={theme}
        onValueChange={(v) => setTheme(v as Theme)}
        className="flex gap-0.5 rounded-md bg-muted p-0.5"
      >
        {THEME_MODES.map(({ value, label, icon: Icon }) => (
          <DropdownMenuPrimitive.RadioItem
            key={value}
            value={value}
            aria-label={label}
            title={label}
            // Elegir el tema no cierra el menú: se ve el cambio al instante.
            onSelect={(e) => e.preventDefault()}
            className="grid size-6 cursor-default place-items-center rounded-[5px] text-muted-foreground outline-hidden focus:ring-2 focus:ring-ring/50 data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:shadow-sm"
          >
            <Icon aria-hidden className="size-3.5" />
          </DropdownMenuPrimitive.RadioItem>
        ))}
      </DropdownMenuPrimitive.RadioGroup>
    </div>
  )
}

/** Confirmación de cerrar sesión (menú de cuenta y ⌘K). */
export function LogoutDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const logout = useLogout()
  const navigate = useNavigate()

  async function run() {
    await logout.mutateAsync()
    onOpenChange(false)
    await navigate({ to: "/", replace: true })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-[400px]">
        <div className="flex flex-col gap-1.5">
          <DialogTitle className="text-base font-semibold">
            ¿Cerrar sesión?
          </DialogTitle>
          <DialogDescription className="text-pretty">
            Vas a tener que entrar de nuevo con tu correo y contraseña en este
            dispositivo.
          </DialogDescription>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={logout.isPending}
            onClick={() => void run()}
          >
            Cerrar sesión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
