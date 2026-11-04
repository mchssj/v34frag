import { Link } from "@tanstack/react-router"
import { useState } from "react"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MapBackdrop } from "@/features/mixes/components/MapBackdrop"
import { SideTable } from "@/features/mixes/components/MixRoom"
import type { RoomPlayer } from "@/features/mixes/lib/room"
import {
  bestValues,
  columnsFor,
  nextSort,
  type StatsSort,
  type StatsTab,
} from "@/features/mixes/lib/stats"
import { StatsTabs } from "@/features/mixes/components/StatsTabs"
import type { MmLobby, MmMatch, MmPlayer } from "../types"
import { Highlights } from "./Highlights"
import { leadersOf, mvpOf, roomSide } from "./roomData"

// Estadísticas de la sala, postpartido (plan, sección 7): MVP, destacados y las mismas tablas de la
// sala de Mixes, más lo más destacado (clips).

export function RoomStats({
  lobby,
  match,
  backdrop,
  mapName,
}: {
  lobby: MmLobby
  match: MmMatch
  backdrop: string | null
  mapName: string | null
}) {
  const byId = new Map(lobby.players.map((p) => [p.player_id, p]))
  const [tab, setTab] = useState<StatsTab>("general")
  const [sort, setSort] = useState<StatsSort>(null)
  const cols = columnsFor(tab, "finished")
  const best = bestValues(cols, match.stats)

  return (
    <div className="flex flex-col gap-4">
      <MvpAndLeaders
        stats={match.stats}
        image={lobby.mvp_image_url ?? null}
        playerOf={(key) => byId.get(key)}
      />

      <StatsTabs
        value={tab}
        onChange={(t) => {
          setTab(t)
          setSort(null)
        }}
      />
      {([1, 2] as const).map((team) => (
        <SideTable
          key={team}
          side={roomSide(lobby, match, team)}
          accent={team === 1 ? "a" : "b"}
          status="finished"
          cols={cols}
          best={best}
          totalRounds={match.score1 + match.score2}
          sort={sort}
          onSort={(key) => setSort((cur) => nextSort(cur, key))}
        />
      ))}

      {match.clips.length > 0 && (
        <Highlights
          clips={match.clips}
          players={lobby.players}
          mapName={mapName}
          poster={backdrop}
        />
      )}
    </div>
  )
}

function PlayerAvatar({
  p,
  size,
}: {
  p: { nick: string; photo_url?: string | null } | undefined
  size: string
}) {
  return (
    <Avatar className={size}>
      {p?.photo_url && <AvatarImage src={p.photo_url} alt="" />}
      <AvatarFallback className="text-[10px] font-semibold">
        {(p?.nick ?? "?").slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

/** Lo que se muestra de un jugador junto a sus números (en un mix, sin foto ni nivel). */
export type CardPlayer = Pick<MmPlayer, "nick" | "photo_url"> &
  Partial<Pick<MmPlayer, "level" | "elo">>

/**
 * MVP y destacados (más kills, más daño…), arriba de las tablas. La usan la sala del matchmaking y
 * el detalle de un mix terminado. `image` es la imagen fija del MVP que sube un admin.
 */
export function MvpAndLeaders({
  stats,
  image,
  playerOf,
}: {
  stats: RoomPlayer[]
  image: string | null
  playerOf: (key: string) => CardPlayer | undefined
}) {
  const mvp = mvpOf(stats)
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {mvp && <MvpCard stat={mvp} player={playerOf(mvp.key)} image={image} />}
      <ul
        aria-label="Destacados"
        className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card"
      >
        {leadersOf(stats).map((l) => (
          <li
            key={l.label}
            className="flex flex-1 items-center gap-3 px-4 py-2.5"
          >
            <PlayerAvatar
              p={playerOf(l.player.key) ?? l.player}
              size="size-8"
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">
                {l.player.nick}
              </span>
              <span className="text-xs text-muted-foreground">{l.label}</span>
            </span>
            <span className="ml-auto font-mono text-lg font-semibold tabular-nums">
              {l.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MvpCard({
  stat,
  player,
  image,
}: {
  stat: RoomPlayer
  player: CardPlayer | undefined
  image: string | null
}) {
  const items: [string, string][] = [
    [stat.rating?.toFixed(2) ?? "—", "Rating"],
    [
      stat.delta === null ? "—" : `${stat.delta >= 0 ? "+" : ""}${stat.delta}`,
      "Δ ELO",
    ],
    [`${stat.k}/${stat.d}/${stat.a}`, "K/D/A"],
    [stat.adr === null ? "—" : stat.adr.toFixed(1), "ADR"],
    [stat.hs === null ? "—" : `${stat.hs}%`, "% de HS"],
  ]
  return (
    <section
      aria-label="MVP"
      className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]"
    >
      <MapBackdrop image={image} className="h-full py-0">
        <div className="flex h-full flex-wrap items-center gap-x-6 gap-y-4 p-5">
          <PlayerAvatar p={player ?? stat} size="size-16" />
          <div className="flex flex-col gap-1">
            <span className="inline-flex h-[18px] w-fit items-center rounded-[4px] bg-primary px-[5px] text-[10px] font-bold text-primary-foreground">
              MVP
            </span>
            <Link
              to="/player/$nick"
              params={{ nick: stat.nick }}
              className="text-xl font-semibold hover:underline"
            >
              {stat.nick}
            </Link>
            {player?.level !== undefined && (
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <LevelBadge level={player.level} size={20} />
                {player.elo}
              </span>
            )}
          </div>
          <dl className="ml-auto grid grid-cols-3 gap-x-6 gap-y-3 sm:grid-cols-5">
            {items.map(([v, l]) => (
              <div key={l} className="flex flex-col-reverse">
                <dt className="text-xs text-muted-foreground">{l}</dt>
                <dd className="font-mono text-lg font-semibold tabular-nums">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </MapBackdrop>
    </section>
  )
}
