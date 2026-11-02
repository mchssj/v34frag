import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { SwordsIcon, UsersIcon, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { fmtDateTime, mapLabel } from "../labels"
import type { MmMeeting, MmPlayer } from "../types"

// Con quién ya jugaste: un ícono para las veces en tu equipo y otro para las veces en contra. Cada
// uno abre las partidas y lleva a la que elijas. Sin partidas, no se muestra.

export function Encounters({ player }: { player: MmPlayer }) {
  const { with: together, against } = player.meetings
  return (
    <>
      {together.length > 0 && (
        <Meetings
          icon={UsersIcon}
          title={`En tu equipo con ${player.nick}`}
          label={`Jugaste ${together.length} con ${player.nick}`}
          items={together}
          className="text-win"
        />
      )}
      {against.length > 0 && (
        <Meetings
          icon={SwordsIcon}
          title={`En contra de ${player.nick}`}
          label={`Jugaste ${against.length} contra ${player.nick}`}
          items={against}
          className="text-destructive"
        />
      )}
    </>
  )
}

function Meetings({
  icon: Icon,
  title,
  label,
  items,
  className,
}: {
  icon: LucideIcon
  title: string
  label: string
  items: MmMeeting[]
  className: string
}) {
  const wins = items.filter((m) => m.won).length
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          aria-label={label}
          title={label}
          className={cn("gap-1 px-1 font-mono tabular-nums", className)}
        >
          <Icon aria-hidden />
          {items.length}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-[13px] font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">
            Ganaste {wins} de {items.length}
          </p>
        </div>
        <ul className="flex max-h-60 flex-col divide-y overflow-y-auto">
          {items.map((m) => (
            <li key={m.match_id}>
              <Link
                to="/match/$id"
                params={{ id: m.match_id }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-muted/50",
                  m.won
                    ? "shadow-[inset_3px_0_0_var(--win)]"
                    : "shadow-[inset_3px_0_0_var(--destructive)]"
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">
                    {m.map ? mapLabel(m.map) : "Mapa"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {fmtDateTime(m.played_at)}
                  </span>
                </span>
                <span
                  className={cn(
                    "ml-auto font-mono font-semibold tabular-nums",
                    m.won ? "text-win" : "text-destructive"
                  )}
                >
                  {m.score}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
