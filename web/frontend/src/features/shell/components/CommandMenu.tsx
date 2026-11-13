import { useNavigate } from "@tanstack/react-router"
import {
  GitCompareIcon,
  LoaderCircleIcon,
  LogOutIcon,
  TrophyIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react"
import { defaultFilter } from "cmdk"
import { useState, type ReactNode } from "react"

import type { AuthUser } from "@/auth/queries"
import { canAccessAdminSection } from "@/auth/permissions"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { TeamCrest } from "@/components/brand/TeamCrest"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { STATUS_LABEL } from "@/features/events/lib/model"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { LogoutDialog } from "./AccountMenu"
import { useGlobalSearch } from "../api/queries"
import { NAV_GROUPS, type AppPath } from "../lib/nav"

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
 * Búsqueda ⌘K: páginas (filtradas acá) y jugadores, equipos y torneos (de la API, desde 2
 * caracteres). cmdk no filtra: ocultaría resultados de la API que no contienen lo escrito tal
 * cual (tildes, el equipo de un jugador).
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
  const found = useGlobalSearch(useDebouncedValue(query.trim(), 300))

  const pages: Page[] = [
    ...NAV_GROUPS.flatMap((g) =>
      g.items
        .filter((i) => !i.soon)
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

  const typed = query.trim() !== ""
  const scored = pages.map((p) => ({ p, score: filter(pageValue(p), query) }))
  const shownPages = typed
    ? scored
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.p)
    : pages
  const logoutScore = typed ? filter(LOGOUT_VALUE, query) : 1
  // Con menos de 2 caracteres no se busca en la API (y no quedan resultados viejos).
  const remote = query.trim().length >= 2
  const players = remote ? found.players : []
  const teams = remote ? found.teams : []
  const events = remote ? found.events : []
  const total =
    shownPages.length +
    (logoutScore > 0 ? 1 : 0) +
    players.length +
    teams.length +
    events.length
  const searching = remote && found.loading && total === 0

  function close() {
    onOpenChange(false)
    setQuery("")
  }
  function go(to: AppPath) {
    close()
    void navigate({ to })
  }

  // El grupo Cuenta va primero si "Cerrar sesión" es lo que mejor coincide: así Enter lo elige.
  const accountFirst =
    typed && logoutScore > Math.max(0, ...scored.map((x) => x.score))
  const account = logoutScore > 0 && (
    <CommandGroup heading="Cuenta">
      <CommandItem
        value={LOGOUT_VALUE}
        onSelect={() => {
          close()
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
        description="Busca un jugador, equipo, torneo o página de CM League."
        className="top-[12vh] leading-design sm:max-w-[600px]"
      >
        <Command shouldFilter={false}>
          <div className="relative">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Escribe un nick, equipo, torneo o página…"
              className="pr-12"
            />
            <Kbd className="absolute top-1/2 right-3 h-auto -translate-y-1/2 rounded px-1.5 font-mono text-[11px] font-normal">
              ESC
            </Kbd>
          </div>
          <CommandList className="max-h-[min(420px,60vh)]">
            {searching ? (
              <div
                role="status"
                className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
              >
                <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                Buscando…
              </div>
            ) : (
              <CommandEmpty>Sin resultados para “{query}”.</CommandEmpty>
            )}
            {accountFirst && account}
            {shownPages.length > 0 && (
              <CommandGroup heading="Páginas">
                {shownPages.map((p) => (
                  <ResultItem
                    key={p.to}
                    value={`page:${p.to}`}
                    onSelect={() => go(p.to)}
                    icon={
                      <p.icon className="text-muted-foreground" aria-hidden />
                    }
                    label={p.label}
                    hint={p.hint}
                  />
                ))}
              </CommandGroup>
            )}
            {players.length > 0 && (
              <CommandGroup heading="Jugadores">
                {players.map((p) => (
                  <ResultItem
                    key={p.id}
                    value={`player:${p.id}`}
                    onSelect={() => {
                      close()
                      void navigate({
                        to: "/player/$nick",
                        params: { nick: p.alias },
                      })
                    }}
                    icon={
                      <PlayerAvatar
                        alias={p.alias}
                        photo={p.photo_url}
                        className="size-6"
                      />
                    }
                    label={p.alias}
                    hint={
                      p.teams.length
                        ? p.teams.map((t) => t.tag ?? t.name).join(" · ")
                        : p.elo !== null
                          ? `ELO ${p.elo}`
                          : undefined
                    }
                  />
                ))}
              </CommandGroup>
            )}
            {teams.length > 0 && (
              <CommandGroup heading="Equipos">
                {teams.map((t) => (
                  <ResultItem
                    key={t.id}
                    value={`team:${t.id}`}
                    onSelect={() => {
                      close()
                      void navigate({ to: "/teams/$id", params: { id: t.id } })
                    }}
                    icon={<TeamCrest team={t} size="xs" />}
                    label={t.name}
                    hint={t.tag ?? undefined}
                  />
                ))}
              </CommandGroup>
            )}
            {events.length > 0 && (
              <CommandGroup heading="Torneos">
                {events.map((e) => (
                  <ResultItem
                    key={e.id}
                    value={`event:${e.id}`}
                    onSelect={() => {
                      close()
                      void navigate({ to: "/events/$id", params: { id: e.id } })
                    }}
                    icon={
                      <TrophyIcon
                        className="text-muted-foreground"
                        aria-hidden
                      />
                    }
                    label={e.name}
                    hint={STATUS_LABEL[e.status]}
                  />
                ))}
              </CommandGroup>
            )}
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

function ResultItem({
  value,
  onSelect,
  icon,
  label,
  hint,
}: {
  value: string
  onSelect: () => void
  icon: ReactNode
  label: string
  hint?: string
}) {
  return (
    <CommandItem value={value} onSelect={onSelect} className="h-9">
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {hint && (
        <span className="max-w-[40%] truncate text-xs text-muted-foreground">
          {hint}
        </span>
      )}
    </CommandItem>
  )
}
