import { useNavigate } from "@tanstack/react-router"
import {
  GitCompareIcon,
  ListChecksIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react"
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
import { NAV_GROUPS, type AppPath } from "./nav"

type Page = { label: string; to: AppPath; icon: LucideIcon; hint: string }

// Páginas que no están en el sidebar pero se pueden buscar.
const EXTRA_PAGES: Page[] = [
  {
    label: "Resultados",
    to: "/matches/results",
    icon: ListChecksIcon,
    hint: "Partidas",
  },
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
  const navigate = useNavigate()

  const pages: Page[] = [
    ...NAV_GROUPS.flatMap((g) =>
      g.items
        .filter((i) => !i.admin || canAccessAdminSection(user.role, i.admin))
        .map((i) => ({ label: i.label, to: i.to, icon: i.icon, hint: g.label }))
    ),
    ...EXTRA_PAGES,
  ]

  function go(to: AppPath) {
    onOpenChange(false)
    setQuery("")
    void navigate({ to })
  }

  return (
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
      <Command>
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
          <CommandGroup heading="Páginas">
            {pages.map((p) => (
              <CommandItem
                key={p.to}
                value={`${p.label} ${p.hint}`}
                onSelect={() => go(p.to)}
                className="h-9"
              >
                <p.icon className="text-muted-foreground" aria-hidden />
                <span className="flex-1 truncate">{p.label}</span>
                <span className="text-xs text-muted-foreground">{p.hint}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          ↑↓ navegar · ↵ abrir · Esc cerrar
        </p>
      </Command>
    </CommandDialog>
  )
}
