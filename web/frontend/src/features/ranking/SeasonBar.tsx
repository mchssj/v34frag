import { useEffect, useState } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Temporada
        <Select value={season?.id ?? HISTORIC} onValueChange={onSelect}>
          <SelectTrigger
            size="sm"
            aria-label="Temporada"
            className="h-8 text-[13px] font-medium text-foreground"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {seasons.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
                {s.status === "active" ? " · en curso" : ""}
              </SelectItem>
            ))}
            <SelectItem value={HISTORIC}>Histórico</SelectItem>
          </SelectContent>
        </Select>
      </label>
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
