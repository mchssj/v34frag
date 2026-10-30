import { useNavigate } from "@tanstack/react-router"
import {
  GitCompareIcon,
  LogOutIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react"
import { defaultFilter } from "cmdk"
import { useState } from "react"

import type { AuthUser } from "@/auth/queries"
import { canAccessAdminSection } from "@/auth/permissions"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { LogoutDialog } from "./AccountMenu"
import { NAV_GROUPS, type AppPath } from "./nav"

type Page = { label: string; to: AppPath; icon: LucideIcon; hint: string }

// Una palabra que empieza con lo escrito gana a una coincidencia salteada: "cerrar" va a Cerrar
// sesión y no a "Comparar jugadores".
const filter = (value: string, search: string, keywords?: string[]) => {
  const score = defaultFilter(value, search, keywords)
  const q = search.trim().toLowerCase()
  const words = [value, ...(keywords ?? [])]
    .join(" ")
    .toLowerCase()
    .split(/\s+/)
  return q && words.some((w) => w.startsWith(q)) ? score + 1 : score
}

const LOGOUT_VALUE = "Cerrar sesión salir logout"
const pageValue = (p: Page) => `${p.label} ${p.hint}`

// Páginas que no están en el sidebar pero se pueden buscar.
const EXTRA_PAGES: Page[] = [
  {
    label: "Comparar jugadores",
    to: "/players/compare",
    icon: GitCompareIcon,
    hint: "Ranking",
  },
  { label: "Mi perfil", to: "/profile", icon: UserRoundIcon, hint: "Cuenta" },
]

/**
 * Búsqueda ⌘K. Por ahora solo páginas: jugadores, equipos y torneos llegan con GET /search
 * (pedido al backend).
 */
export function CommandMenu({
  user,
  open,
  onOpenChange,
}: {
  user: AuthUser
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = useState("")
  const [leaving, setLeaving] = useState(false)
  const navigate = useNavigate()

  const pages: Page[] = [
    ...NAV_GROUPS.flatMap((g) =>
      g.items
        .filter((i) => !i.admin || canAccessAdminSection(user.role, i.admin))
        .map((i) => ({
          label: i.label,
          to: i.to,
          icon: i.icon,
          hint: g.label,
        }))
    ),
    ...EXTRA_PAGES,
  ]

  function go(to: AppPath) {
    onOpenChange(false)
    setQuery("")
    void navigate({ to })
  }

  // cmdk 1.1.1 ordena las opciones dentro de cada grupo pero no los grupos (busca el grupo por su
  // id y el atributo tiene el título), así que el orden de los grupos se decide acá con el mismo
  // puntaje: si "Cerrar sesión" es lo que mejor coincide, va primero y Enter lo elige.
  const accountFirst =
    query.trim() !== "" &&
    filter(LOGOUT_VALUE, query) >
      Math.max(0, ...pages.map((p) => filter(pageValue(p), query)))
  const account = (
    <CommandGroup heading="Cuenta">
      <CommandItem
        value={LOGOUT_VALUE}
        onSelect={() => {
          onOpenChange(false)
          setQuery("")
          setLeaving(true)
        }}
        className="h-9 text-destructive data-[selected=true]:text-destructive"
      >
        <LogOutIcon className="text-destructive" aria-hidden />
        <span className="flex-1 truncate">Cerrar sesión</span>
      </CommandItem>
    </CommandGroup>
  )

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={(o) => {
          onOpenChange(o)
          if (!o) setQuery("")
        }}
        title="Buscar"
        description="Busca una página de CM League."
        className="top-[12vh] leading-design sm:max-w-[600px]"
      >
        <Command filter={filter}>
          <div className="relative">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Escribe un nick, equipo, torneo o página…"
              className="pr-12"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">
              ESC
            </kbd>
          </div>
          <CommandList className="max-h-[min(420px,60vh)]">
            <CommandEmpty>Sin resultados para “{query}”.</CommandEmpty>
            {accountFirst && account}
            <CommandGroup heading="Páginas">
              {pages.map((p) => (
                <CommandItem
                  key={p.to}
                  value={pageValue(p)}
                  onSelect={() => go(p.to)}
                  className="h-9"
                >
                  <p.icon className="text-muted-foreground" aria-hidden />
                  <span className="flex-1 truncate">{p.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.hint}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {!accountFirst && account}
          </CommandList>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            ↑↓ navegar · ↵ abrir · Esc cerrar
          </p>
        </Command>
      </CommandDialog>
      <LogoutDialog open={leaving} onOpenChange={setLeaving} />
    </>
  )
}
