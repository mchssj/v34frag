import { cn } from "cn"
import {
  CalendarPlusIcon,
  CheckIcon,
  CircleDashedIcon,
  LinkIcon,
  XIcon,
} from "lucide-react"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { TeamCrest } from "@/components/brand/TeamCrest"
import { Button } from "@/components/ui/button"
import { levelOf } from "@/features/matchmaking/room/roomData"
import { MapBackdrop } from "@/features/mixes/components/MapBackdrop"
import { LEVEL_FLOORS } from "@/features/player/lib/labels"
import { avgElo, countdown, headToHead, sideName, whenLabel } from "../lib/pcw"
import { stepLabel } from "../lib/series"
import type { PcwMatch, PcwResult, PcwSide } from "../types"
import type { SeriesActions } from "./MyPcw"
import { TeamName } from "./TeamName"
import { copyLink, downloadIcs } from "./share"

/**
 * La próxima PCW en grande, arriba de Mis PCW (Kyan, 2026-11-08): los dos equipos, cuánto falta, quién está listo,
 * los rosters, el historial entre los dos y la acción que toca.
 */
export function NextPcw({
  m,
  now,
  results,
  myTeamId,
  backdrop,
  onReady,
  onAnswer,
  onCancel,
  series,
}: {
  m: PcwMatch
  now: Date
  results: PcwResult[]
  myTeamId: string
  /** Foto de fondo: el mapa que se juega o el primero del pool. */
  backdrop: string | null
  onReady: (id: string) => void
  onAnswer: (id: string, ok: boolean) => void
  onCancel: (id: string) => void
  series: SeriesActions
}) {
  const left = countdown(m.starts_at, now)
  const h2h = m.them.team ? headToHead(results, myTeamId, m.them.team.id) : null
  const usReady = m.status !== "waiting"
  const themReady =
    m.status === "ready_both" || m.status === "live" || !!m.booking
  const canCancel =
    !m.booking && (m.status === "waiting" || m.status === "ready_us")
  const title = `PCW BO${m.best_of} vs ${sideName(m.them)}`

  return (
    <section
      aria-label="Tu próxima PCW"
      className="overflow-hidden rounded-xl border bg-card"
    >
      <MapBackdrop image={backdrop} className="px-4 py-5 sm:px-6">
        <div className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-6">
          <Side side={m.us} ready={usReady} />
          {/* En celular el reloj va arriba y los dos equipos debajo. */}
          <div className="order-first col-span-2 flex flex-col items-center gap-1 text-center sm:order-none sm:col-span-1">
            <span className="text-[11px] font-semibold tracking-[.3px] text-muted-foreground uppercase">
              Próxima · PCW BO{m.best_of}
            </span>
            <span
              aria-label={left ? `Faltan ${left}` : undefined}
              className="font-mono text-3xl leading-none font-bold whitespace-nowrap tabular-nums in-data-photo:[text-shadow:0_2px_14px_rgb(0_0_0/.55)] sm:text-4xl"
            >
              {m.booking ? "EN SALA" : (left ?? whenLabel(m.starts_at, now))}
            </span>
            <span className="text-xs text-muted-foreground">
              {m.booking ? stepLabel(m.booking) : whenLabel(m.starts_at, now)}
            </span>
          </div>
          <Side side={m.them} ready={themReady} end />
        </div>
      </MapBackdrop>

      <div className="grid gap-4 border-t px-4 py-3 sm:grid-cols-2 sm:px-6">
        <Roster side={m.us} label="Ustedes" />
        <Roster side={m.them} label={sideName(m.them)} />
      </div>

      {m.proposed_at && (
        <div className="mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs sm:mx-6">
          {m.proposed_by === "them" ? (
            <>
              <span className="min-w-[11rem] flex-1">
                Proponen pasarla a <b>{whenLabel(m.proposed_at, now)}</b>
              </span>
              <Button size="xs" onClick={() => onAnswer(m.id, true)}>
                <CheckIcon />
                Aceptar
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onAnswer(m.id, false)}
              >
                Mantener
              </Button>
            </>
          ) : (
            <span>
              Propusiste <b>{whenLabel(m.proposed_at, now)}</b> · esperando
              respuesta
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-4 py-2.5 sm:px-6">
        {h2h && (
          <span className="text-xs text-muted-foreground">
            Contra ellos: <b className="text-foreground">{h2h.label}</b>
          </span>
        )}
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copyLink(m.id, "match")}
        >
          <LinkIcon />
          Copiar link
        </Button>
        {m.starts_at && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              downloadIcs({
                id: m.id,
                title,
                startsAt: m.starts_at!,
                bestOf: m.best_of,
                kind: "match",
              })
            }
          >
            <CalendarPlusIcon />
            Al calendario
          </Button>
        )}
        {canCancel && (
          <Button variant="ghost" size="sm" onClick={() => onCancel(m.id)}>
            <XIcon />
            Cancelar
          </Button>
        )}
        {m.booking ? (
          <Button onClick={() => series.onRoom(m.id)}>
            {m.booking.step === "finished" || m.booking.step === "abandoned"
              ? "Ver resultado"
              : "Ir a la sala"}
          </Button>
        ) : m.status === "waiting" ? (
          <Button onClick={() => onReady(m.id)}>Estamos listos</Button>
        ) : m.status === "ready_us" ? (
          <Button variant="secondary" onClick={() => onReady(m.id)}>
            Simular: el rival está listo
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function Side({
  side,
  ready,
  end = false,
}: {
  side: PcwSide
  ready: boolean
  end?: boolean
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:text-left",
        end && "sm:flex-row-reverse sm:text-right"
      )}
    >
      {side.team ? (
        <TeamCrest team={side.team} size="md" />
      ) : (
        <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-foreground font-mono text-sm font-bold text-background">
          MIX
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <TeamName
          team={side.team}
          name={sideName(side)}
          className="truncate text-base font-bold sm:text-xl"
        />
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs sm:self-start",
            end && "sm:self-end",
            ready ? "text-win" : "text-muted-foreground"
          )}
        >
          {ready ? (
            <CheckIcon aria-hidden className="size-3.5" />
          ) : (
            <CircleDashedIcon aria-hidden className="size-3.5" />
          )}
          {ready ? "Listos" : "Todavía no"}
        </span>
      </span>
    </div>
  )
}

function Roster({ side, label }: { side: PcwSide; label: string }) {
  const elo = avgElo(side.roster)
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label} · ELO medio
        <LevelBadge level={levelOf(elo, LEVEL_FLOORS)} size={20} />
        <span className="font-mono text-foreground">{elo}</span>
      </span>
      <ul className="flex flex-wrap gap-1.5">
        {side.roster.map((p) => (
          <li
            key={p.id}
            className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs"
          >
            <PlayerAvatar alias={p.alias} photo={p.photo} className="size-5" />
            {p.alias}
          </li>
        ))}
      </ul>
    </div>
  )
}
