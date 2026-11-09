import { cn } from "cn"
import { ServerIcon } from "lucide-react"

import { CountryFlag } from "@/components/brand/CountryFlag"
import { TeamCrest } from "@/components/brand/TeamCrest"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MapBackdrop } from "@/features/mixes/components/MapBackdrop"
import { WatchTvButton } from "@/features/mixes/components/parts"
import { fmtDateTime, isCountry } from "../labels"
import type { LobbyStatus, MmLobby } from "../types"
import {
  avgElo,
  teamCaptain,
  teamLabel,
  teamPlayers,
  teamRecent,
  winChance,
  type Team,
} from "./roomData"

// Cabecera de la sala, igual a la de la sala de Mixes: el marcador sobre la foto del mapa y una
// franja de abajo con los datos de la partida.

const STATUS_CHIP: Partial<Record<LobbyStatus, string>> = {
  veto: "VETO",
  waiting_server: "BUSCANDO SERVIDOR",
  assigned: "PREPARANDO",
  connecting: "CONECTANDO",
  finished: "FINAL",
  cancelled: "CANCELADA",
}

export function RoomHeader({
  lobby,
  backdrop,
  mapName,
}: {
  lobby: MmLobby
  backdrop: string | null
  mapName: string | null
}) {
  const m = lobby.match
  const live = lobby.status === "live"
  const details = [
    lobby.kind_label ?? `Matchmaking ${lobby.mode}`,
    lobby.server?.name,
    m && fmtDateTime(m.played_at),
  ]
  return (
    <section
      aria-label="Partida"
      className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]"
    >
      <MapBackdrop image={backdrop}>
        <div className="grid grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-5 sm:px-6">
          <Side lobby={lobby} team={1} />
          <div className="order-1 flex min-w-[140px] flex-col items-center gap-1 sm:order-none">
            <span
              className={cn(
                "inline-flex h-[22px] items-center gap-1.5 rounded-[calc(var(--radius)-4px)] px-2 text-[11px] font-semibold tracking-[.3px]",
                live
                  ? "bg-destructive text-white"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              {live && (
                <span
                  aria-hidden
                  className="size-1.5 animate-live rounded-full bg-current"
                />
              )}
              {live ? "EN VIVO" : STATUS_CHIP[lobby.status]}
            </span>
            <span className="font-mono text-[32px] leading-none font-bold tracking-[-2px] whitespace-nowrap tabular-nums in-data-photo:[text-shadow:0_2px_14px_rgb(0_0_0/.55)]">
              {m?.score1 ?? "–"} : {m?.score2 ?? "–"}
            </span>
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              {mapName ?? "Mapa por vetar"}
            </span>
          </div>
          <Side lobby={lobby} team={2} />
        </div>
        {!["finished", "cancelled"].includes(lobby.status) && (
          <WinChance lobby={lobby} />
        )}
      </MapBackdrop>
      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground">
        <ServerIcon aria-hidden className="size-[13px]" />
        {details.filter(Boolean).join(" · ")}
        {isCountry(lobby.region) && <CountryFlag country={lobby.region} />}
        {lobby.elo_stake && !lobby.match?.winner && (
          <span className="ml-auto font-mono text-xs">
            En juego: <span className="text-win">+{lobby.elo_stake.win}</span> /{" "}
            <span className="text-destructive">−{lobby.elo_stake.loss}</span>{" "}
            ELO
          </span>
        )}
        {live && lobby.server?.tv && (
          <WatchTvButton
            tv={lobby.server.tv}
            label="Ver en CM League TV"
            className="ml-auto h-[30px] px-3 text-[13px]"
          />
        )}
      </div>
    </section>
  )
}

/** Probabilidad de ganar de cada equipo, según el ELO promedio. */
function WinChance({ lobby }: { lobby: MmLobby }) {
  const a = winChance(
    avgElo(teamPlayers(lobby, 1)),
    avgElo(teamPlayers(lobby, 2))
  )
  return (
    <div className="flex items-center gap-2 px-4 pb-3 font-mono text-xs tabular-nums sm:px-6">
      <span>{a}%</span>
      <span
        role="img"
        aria-label={`Probabilidad de ganar: equipo A ${a} %, equipo B ${100 - a} %`}
        className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-chart-2"
      >
        <span className="bg-primary" style={{ width: `${a}%` }} />
      </span>
      <span>{100 - a}%</span>
    </div>
  )
}

function Side({ lobby, team }: { lobby: MmLobby; team: Team }) {
  const players = teamPlayers(lobby, team)
  const captain = teamCaptain(lobby, team)
  const recent = teamRecent(players)
  const winner = lobby.match?.winner === team
  const left = team === 1
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3.5",
        left
          ? "order-2 flex-row-reverse justify-end sm:order-none sm:flex-row"
          : "order-3 sm:order-none"
      )}
    >
      {!left && <Tag lobby={lobby} team={team} />}
      <span
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          left ? "items-start sm:items-end" : "items-start"
        )}
      >
        {winner && (
          <span className="text-xs font-semibold text-win">Ganador</span>
        )}
        <span className="max-w-full truncate text-xl font-semibold">
          {teamLabel(lobby, team)}
        </span>
        <span className="text-xs text-muted-foreground">
          ELO prom. {avgElo(players)}
          {recent && ` · rating ${recent.rating.toFixed(2)}`}
        </span>
      </span>
      {left && <Tag lobby={lobby} team={team} />}
      <span className="sr-only">Capitán: {captain?.nick}</span>
    </div>
  )
}

function Tag({ lobby, team }: { lobby: MmLobby; team: Team }) {
  const captain = teamCaptain(lobby, team)
  // Un bando que juega como equipo (PCW) muestra su escudo; el matchmaking, la foto del capitán.
  const crest = lobby.crests?.[team]
  if (crest)
    return (
      <TeamCrest
        team={crest}
        size="sm"
        className={cn(
          lobby.match?.winner === team && "shadow-[0_0_0_2px_var(--primary)]"
        )}
      />
    )
  return (
    <Avatar
      className={cn(
        "size-11 flex-none rounded-tile",
        lobby.match?.winner === team && "shadow-[0_0_0_2px_var(--primary)]"
      )}
    >
      {captain?.photo_url && (
        <AvatarImage src={captain.photo_url} alt="" className="rounded-tile" />
      )}
      <AvatarFallback className="rounded-tile bg-muted font-mono text-sm font-bold in-data-photo:bg-white/14 in-data-photo:backdrop-blur-md">
        {(captain?.nick ?? "?").slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}
