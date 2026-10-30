import { useEffect, useState } from "react"

import { cn } from "cn"
import { ChevronDownIcon, CheckIcon, HistoryIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { countdown, fmtLongDate } from "./labels"
import type { Season } from "./queries"
import { HISTORIC } from "./search"

// Franja de la temporada sobre el podio (contrato 8f): selector, estado y cuenta regresiva.

export function SeasonBar({
  seasons,
  season,
  onSelect,
}: {
  seasons: Season[]
  /** La temporada elegida, o null en Histórico. */
  season: Season | null
  onSelect: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border bg-card px-4 py-3">
      <SeasonPicker seasons={seasons} season={season} onSelect={onSelect} />
      {!season ? (
        <span className="text-xs text-muted-foreground">
          Todas las partidas jugadas en el servidor, sin temporadas.
        </span>
      ) : season.status === "active" ? (
        <>
          <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-win/15 px-2 font-mono text-[11px] font-semibold tracking-[.04em] text-win">
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            EN CURSO
          </span>
          <Countdown endsAt={season.ends_at} />
          <span className="text-xs text-muted-foreground md:ml-auto">
            Top {season.top_n} con medalla · mínimo {season.min_matches} mixes
            para tener puesto
          </span>
        </>
      ) : (
        <>
          <span className="inline-flex h-[22px] items-center rounded-full bg-muted px-2 font-mono text-[11px] font-semibold tracking-[.04em] text-muted-foreground">
            CERRADA
          </span>
          {season.closed_at && (
            <span className="text-xs text-muted-foreground">
              Cerró el {fmtLongDate(season.closed_at)}
            </span>
          )}
          {season.champion && (
            <span className="text-[13px]">
              <span aria-hidden>🏆 </span>
              <span className="sr-only">Campeón: </span>
              {season.champion.alias}
            </span>
          )}
        </>
      )}
    </div>
  )
}

function Countdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  const left = countdown(endsAt, now)
  const num = "font-mono text-[15px] font-semibold text-foreground tabular-nums"
  return (
    <span className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
      {left ? (
        <>
          Termina en <b className={num}>{left.d}</b> d{" "}
          <b className={num}>{left.h}</b> h <b className={num}>{left.m}</b> min
        </>
      ) : (
        "Cerrando…"
      )}
    </span>
  )
}

const segment =
  "inline-flex h-7 items-center gap-1.5 rounded-[calc(var(--radius)-4px)] px-3 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
const pressed = "bg-background font-semibold text-foreground shadow-sm"

/**
 * Control segmentado: la temporada en curso, las anteriores en un menú y el Histórico aparte (una
 * vista de todas las partidas, no una temporada más).
 */
function SeasonPicker({
  seasons,
  season,
  onSelect,
}: {
  seasons: Season[]
  season: Season | null
  onSelect: (value: string) => void
}) {
  const active = seasons.find((s) => s.status === "active")
  const closed = seasons.filter((s) => s.status !== "active")
  const pastPicked = season && season.status !== "active" ? season : null

  return (
    <div
      role="group"
      aria-label="Temporada"
      className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[9px] bg-muted p-[3px]"
    >
      {active && (
        <button
          type="button"
          aria-pressed={season?.id === active.id}
          onClick={() => onSelect(active.id)}
          className={cn(segment, season?.id === active.id && pressed)}
        >
          <span className="size-1.5 rounded-full bg-win" aria-hidden />
          {active.name}
        </button>
      )}
      {closed.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={
              pastPicked
                ? `Temporada anterior: ${pastPicked.name}`
                : "Temporadas anteriores"
            }
            className={cn(segment, pastPicked && pressed)}
          >
            {pastPicked ? pastPicked.name : "Anteriores"}
            <ChevronDownIcon className="size-3.5" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {closed.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onSelect={() => onSelect(s.id)}
                className="justify-between gap-6"
              >
                {s.name}
                {s.id === pastPicked?.id && (
                  <CheckIcon className="size-4 text-primary" aria-hidden />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <button
        type="button"
        aria-pressed={!season}
        onClick={() => onSelect(HISTORIC)}
        className={cn(segment, !season && pressed)}
      >
        <HistoryIcon
          className={cn("size-3.5", !season && "text-primary")}
          aria-hidden
        />
        Histórico
      </button>
    </div>
  )
}
