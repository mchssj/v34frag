import { cn } from "cn"
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { crestText, MY_ROLE_LABEL, type MyRole } from "./model"
import { Eyebrow, TeamCrest } from "./ui"

export type MyTeam = {
  id: string
  name: string
  tag: string | null
  logo_url?: string | null
  role: MyRole | null
}

/** "Mis equipos": segmentado hasta 3 equipos; desde 4, un desplegable. */
export function TeamSwitcher({
  teams,
  currentId,
  onSelect,
  onFind,
}: {
  teams: MyTeam[]
  currentId: string
  onSelect: (id: string) => void
  /** Buscar otro equipo: se puede estar en varios. */
  onFind: () => void
}) {
  const current = teams.find((t) => t.id === currentId) ?? teams[0]

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Eyebrow className="text-muted-foreground">Mis equipos</Eyebrow>
      {teams.length <= 3 ? (
        <div
          role="radiogroup"
          aria-label="Mis equipos"
          className="flex h-[34px] max-w-full gap-0.5 overflow-x-auto rounded-lg border bg-muted p-[3px]"
        >
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === current.id}
              onClick={() => onSelect(t.id)}
              className="flex items-center gap-2 rounded-[calc(var(--radius)-4px)] px-2.5 text-[13px] whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-sm"
            >
              <span className="font-mono text-[11px] font-semibold">
                {crestText(t)}
              </span>
              <span className="font-semibold">{t.name}</span>
              {t.role && (
                <span className="text-[11px] text-muted-foreground">
                  {MY_ROLE_LABEL[t.role]}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="lg"
              className="max-w-full gap-2"
              aria-label={`Mis equipos: ${current.name}`}
            >
              <TeamCrest team={current} size="xs" />
              <span className="truncate font-semibold">{current.name}</span>
              {current.role && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  {MY_ROLE_LABEL[current.role]}
                </span>
              )}
              <ChevronsUpDownIcon
                className="size-4 text-muted-foreground"
                aria-hidden
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[290px]">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Tus equipos · {teams.length}
            </DropdownMenuLabel>
            {teams.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onSelect={() => onSelect(t.id)}
                className="gap-2.5"
              >
                <TeamCrest team={t} size="xs" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{t.name}</span>
                  {t.role && (
                    <span className="text-[11px] text-muted-foreground">
                      {MY_ROLE_LABEL[t.role]}
                    </span>
                  )}
                </span>
                <CheckIcon
                  className={cn(
                    "size-4 text-primary",
                    t.id !== current.id && "invisible"
                  )}
                  aria-hidden
                />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button variant="outline" size="sm" onClick={onFind}>
        <SearchIcon aria-hidden />
        Buscar equipo
      </Button>
    </div>
  )
}
