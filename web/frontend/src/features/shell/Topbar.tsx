import { Link, useRouterState } from "@tanstack/react-router"
import { SearchIcon } from "lucide-react"
import { Fragment } from "react"

import { THEME_MODES } from "@/components/brand/ThemeSwitch"
import { useTheme, type Theme } from "@/components/theme-provider"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { breadcrumbsFor } from "./nav"
import { NotificationsMenu } from "./notifications/NotificationsMenu"
import { useCrumbData } from "./queries"

// ⌘ en Mac, Ctrl en el resto.
const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
export const SEARCH_SHORTCUT = isMac ? "⌘K" : "Ctrl K"

export function Topbar({ onSearch }: { onSearch: () => void }) {
  return (
    <header className="sticky top-0 z-10 flex h-[52px] shrink-0 items-center gap-2 rounded-t-[inherit] border-b bg-background pr-3 pl-2.5">
      <SidebarTrigger className="size-7" />
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <Breadcrumbs />
      <Button
        variant="outline"
        onClick={onSearch}
        aria-label={`Buscar (${SEARCH_SHORTCUT})`}
        className="h-8 w-60 max-w-[24vw] min-w-9 justify-start gap-2 border-input px-2.5 font-normal text-muted-foreground shadow-xs"
      >
        <SearchIcon className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden flex-1 truncate text-left sm:inline">
          Buscar…
        </span>
        <kbd className="hidden rounded bg-muted px-1.5 font-mono text-[11px] sm:inline">
          {SEARCH_SHORTCUT}
        </kbd>
      </Button>
      <ThemeMenu />
      <NotificationsMenu />
    </header>
  )
}

function Breadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const crumbs = breadcrumbsFor(pathname, useCrumbData(pathname))
  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className={last ? "min-w-0" : "shrink-0"}>
                {last ? (
                  <BreadcrumbPage className="truncate font-medium">
                    {c.label}
                  </BreadcrumbPage>
                ) : c.to ? (
                  <BreadcrumbLink asChild>
                    <Link to={c.to}>{c.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span>{c.label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/** Tema con cambio directo. Los efectos flashbang/smoke se conectan con useThemeFx cuando se decida. */
function ThemeMenu() {
  const { theme, setTheme } = useTheme()
  const current = THEME_MODES.find((m) => m.value === theme) ?? THEME_MODES[2]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={`Tema: ${current.label}`}
        >
          <current.icon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(v) => setTheme(v as Theme)}
        >
          {THEME_MODES.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
