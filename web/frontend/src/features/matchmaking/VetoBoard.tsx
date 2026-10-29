import { cn } from "cn"
import { BanIcon, CrownIcon } from "lucide-react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { secondsLeft, teamName } from "./labels"
import { useMmMutation } from "./queries"
import { useMmSource } from "./source"
import type { MmLobby, MmVetoBan, MmVetoMap } from "./types"
import { useNow } from "./useNow"

// Veto de capitanes (plan, sección 2): banean por turnos hasta que queda un mapa. Solo el capitán
// del turno puede hacer clic; los demás lo ven en vivo.

export function VetoBoard({
  lobby,
  compact = false,
}: {
  lobby: MmLobby
  /** En la columna del medio de la sala: tres mapas por fila. */
  compact?: boolean
}) {
  const source = useMmSource()
  const veto = lobby.veto!
  const now = useNow(veto.turn !== null, 250)
  const ban = useMmMutation((map: string) => source.veto(map))

  const me = lobby.players.find((p) => p.is_me)
  const captainOf = (team: 1 | 2) =>
    lobby.players.find((p) => p.team === team && p.is_captain)
  const myTurn = veto.turn !== null && me?.is_captain && me.team === veto.turn
  const left = secondsLeft(veto.deadline, now)
  const banOf = new Map(veto.bans.map((b) => [b.map, b]))
  const turnCaptain = veto.turn ? captainOf(veto.turn) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Veto de mapas</CardTitle>
        <CardDescription>
          {veto.turn === null
            ? `Se juega ${veto.pool.find((m) => m.name === lobby.map)?.label ?? lobby.map}.`
            : myTurn
              ? "Tu turno: baneá un mapa."
              : `Banea ${turnCaptain?.nick ?? "el capitán"} (${teamName(veto.turn)}).`}
        </CardDescription>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          {([1, 2] as const).map((t) => (
            <span
              key={t}
              className={cn(
                "inline-flex items-center gap-1.5",
                veto.turn === t ? "font-semibold" : "text-muted-foreground"
              )}
            >
              <CrownIcon
                aria-hidden
                className="size-3.5 text-sidebar-primary"
              />
              {teamName(t)}: {captainOf(t)?.nick ?? "—"}
              {captainOf(t)?.is_me && " (vos)"}
            </span>
          ))}
          {veto.turn !== null && (
            <span
              role="timer"
              aria-label={`${left} segundos para banear`}
              className={cn(
                "ml-auto font-mono text-lg font-bold tabular-nums",
                left <= 5 && "text-destructive"
              )}
            >
              {left}s
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ul
          className={cn(
            "grid gap-2",
            compact
              ? "grid-cols-3"
              : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7"
          )}
        >
          {veto.pool.map((m) => (
            <MapTile
              key={m.name}
              map={m}
              ban={banOf.get(m.name)}
              picked={veto.turn === null && lobby.map === m.name}
              canBan={!!myTurn && !banOf.has(m.name) && !ban.isPending}
              onBan={() =>
                ban.mutate(m.name, {
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function MapTile({
  map,
  ban,
  picked,
  canBan,
  onBan,
}: {
  map: MmVetoMap
  ban: MmVetoBan | undefined
  picked: boolean
  canBan: boolean
  onBan: () => void
}) {
  const label = map.label
  return (
    <li>
      <button
        type="button"
        disabled={!canBan}
        onClick={onBan}
        aria-label={
          ban
            ? `${label}, baneado por ${teamName(ban.team)}`
            : canBan
              ? `Banear ${label}`
              : label
        }
        className={cn(
          "relative flex aspect-[4/3] w-full flex-col justify-end overflow-hidden rounded-xl border bg-muted p-2.5 text-left transition",
          canBan &&
            "cursor-pointer hover:border-destructive hover:ring-2 hover:ring-destructive/30",
          ban && "opacity-45 grayscale",
          picked && "border-win ring-2 ring-win/40"
        )}
      >
        {map.image_url && (
          <img
            src={map.image_url}
            alt=""
            aria-hidden
            className="absolute inset-0 -z-0 size-full object-cover"
          />
        )}
        <span className="relative font-semibold drop-shadow">{label}</span>
        {ban && (
          <span className="relative mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <BanIcon aria-hidden className="size-3" />
            {teamName(ban.team)}
            {ban.auto && " · auto"}
          </span>
        )}
        {picked && (
          <span className="relative mt-0.5 text-[11px] font-semibold text-win">
            Se juega
          </span>
        )}
      </button>
    </li>
  )
}
