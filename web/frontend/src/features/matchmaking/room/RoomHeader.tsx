import { cn } from "cn"
import { CalendarIcon, MapIcon, SwordsIcon } from "lucide-react"

import { CountryFlag } from "@/components/brand/CountryFlag"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LEVEL_FLOORS } from "@/features/player/labels"
import { fmtDateTime, isCountry } from "../labels"
import type { MmLobby, MmRecent } from "../types"
import {
  avgElo,
  levelOf,
  teamCaptain,
  teamLabel,
  teamPlayers,
  teamRecent,
  type Team,
} from "./roomData"

// Cabecera de la sala: el fondo del mapa, los dos equipos con su ELO promedio y el marcador.

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
  return (
    <section
      aria-label="Partida"
      className="relative isolate overflow-hidden rounded-2xl border bg-card"
    >
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-20 size-full object-cover"
        />
      )}
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(0_0_0/.78),rgb(0_0_0/.45)_50%,rgb(0_0_0/.78))]"
      />
      <div className="flex flex-col gap-4 p-4 text-white sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5">
            <SwordsIcon aria-hidden className="size-3.5" />
            Matchmaking / {lobby.region ?? "Cualquiera"} / {lobby.mode}
          </span>
          <span className="inline-flex items-center gap-3">
            {mapName && (
              <span className="inline-flex items-center gap-1">
                <MapIcon aria-hidden className="size-3.5" />
                {mapName}
              </span>
            )}
            {m && (
              <span className="inline-flex items-center gap-1">
                <CalendarIcon aria-hidden className="size-3.5" />
                {fmtDateTime(m.played_at)}
              </span>
            )}
            {isCountry(lobby.region) && <CountryFlag country={lobby.region} />}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Side lobby={lobby} team={1} />
          <div className="flex items-center gap-3 font-mono text-4xl font-bold tabular-nums sm:text-5xl">
            <Score
              value={m?.score1}
              win={m?.winner === 1}
              lose={m?.winner === 2}
            />
            <span className="text-sm font-semibold text-white/60">vs</span>
            <Score
              value={m?.score2}
              win={m?.winner === 2}
              lose={m?.winner === 1}
            />
          </div>
          <Side lobby={lobby} team={2} />
        </div>
      </div>
    </section>
  )
}

function Score({
  value,
  win,
  lose,
}: {
  value: number | undefined
  win: boolean
  lose: boolean
}) {
  return (
    <span className={cn(win && "text-win", lose && "text-white/50")}>
      {value ?? "–"}
    </span>
  )
}

function Side({ lobby, team }: { lobby: MmLobby; team: Team }) {
  const players = teamPlayers(lobby, team)
  const elo = avgElo(players)
  const captain = teamCaptain(lobby, team)
  const recent = teamRecent(players)
  const winner = lobby.match?.winner === team
  const right = team === 2
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3",
        right ? "flex-row-reverse text-right" : "flex-row"
      )}
    >
      <span className="hidden shrink-0 items-center gap-2 rounded-xl bg-black/45 px-3 py-2 font-mono text-lg font-bold tabular-nums md:inline-flex">
        <LevelBadge
          level={levelOf(elo, LEVEL_FLOORS)}
          size={22}
          className="rounded-full"
        />
        {elo}
      </span>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-1",
          right ? "items-start" : "items-end"
        )}
      >
        {winner && (
          <span className="text-[11px] font-bold tracking-[2px] text-win uppercase">
            Ganador
          </span>
        )}
        <span className="max-w-full truncate text-lg font-bold sm:text-2xl">
          {teamLabel(lobby, team)}
        </span>
        {recent && <RecentLine r={recent} />}
      </div>
      <Avatar
        className={cn(
          "size-14 shrink-0 ring-2 sm:size-16",
          team === 1 ? "ring-primary/70" : "ring-chart-2/70"
        )}
      >
        {captain?.photo_url && <AvatarImage src={captain.photo_url} alt="" />}
        <AvatarFallback className="bg-black/50 text-base font-semibold text-white">
          {(captain?.nick ?? "?").slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </div>
  )
}

/** Promedio del equipo en las últimas 30 partidas. */
function RecentLine({ r }: { r: MmRecent }) {
  const items: [string, string][] = [
    [`${r.win_pct}%`, "Victorias"],
    [r.rating.toFixed(2), "Rating"],
    [r.kd.toFixed(2), "K/D"],
    [r.kr.toFixed(2), "K/R"],
    [r.adr.toFixed(1), "ADR"],
  ]
  return (
    <dl
      aria-label="Promedio de las últimas 30 partidas"
      className="hidden gap-3 lg:flex"
    >
      {items.map(([v, l]) => (
        <div
          key={l}
          className="flex flex-col-reverse items-center leading-tight"
        >
          <dt className="text-[10px] text-white/60">{l}</dt>
          <dd className="font-mono text-xs font-semibold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
