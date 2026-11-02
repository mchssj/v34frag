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
import { suggestBan } from "./room/roomData"
import { useMmMutation } from "./queries"
import { useMmSource } from "./source"
import type { MmLobby, MmVetoBan, MmVetoMap } from "./types"
import { useNow } from "./useNow"

// Veto de capitanes (plan, sección 2): banean por turnos hasta que queda un mapa. Solo el capitán
// del turno puede hacer clic; los demás lo ven en vivo.

export function VetoBoard({ lobby }: { lobby: MmLobby }) {
  const source = useMmSource()
  const veto = lobby.veto!
  const now = useNow(veto.turn !== null, 250)
  const ban = useMmMutation((map: string) => source.veto(lobby.match_id!, map))

  const me = lobby.players.find((p) => p.is_me)
  const captainOf = (team: 1 | 2) =>
    lobby.players.find((p) => p.team === team && p.is_captain)
  const myTurn = veto.turn !== null && me?.is_captain && me.team === veto.turn
  const left = secondsLeft(veto.deadline, now)
  const suggestion = me ? suggestBan(veto, me.team) : null
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
              ? "Tu turno: banea un mapa."
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
              <CrownIcon aria-hidden className="size-3.5 text-primary" />
              {teamName(t)}: {captainOf(t)?.nick ?? "—"}
              {captainOf(t)?.is_me && " (tú)"}
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
        {me && veto.turn === me.team && suggestion && (
          <p className="mb-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs">
            Te conviene banear <strong>{suggestion.label}</strong>: tu equipo
            gana {suggestion.mine} %, ellos {suggestion.theirs} %.
          </p>
        )}
        <ul className="flex flex-col gap-1">
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
          "flex h-8 w-full items-center gap-2.5 rounded-lg border bg-muted/40 pr-2.5 text-left text-[13px] transition-colors",
          canBan && "cursor-pointer hover:border-destructive hover:bg-muted",
          ban && "opacity-50",
          picked && "border-primary bg-primary/10"
        )}
      >
        <span className="h-full w-14 shrink-0 overflow-hidden rounded-l-[inherit] bg-muted">
          {map.image_url && (
            <img
              src={map.image_url}
              alt=""
              aria-hidden
              className={cn("size-full object-cover", ban && "grayscale")}
            />
          )}
        </span>
        <span className={cn("font-medium", ban && "line-through")}>
          {label}
        </span>
        {!ban && !picked && map.team1_win_pct !== null && (
          <span
            title="% de victorias en este mapa de cada equipo"
            className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums"
          >
            A {map.team1_win_pct}% · B {map.team2_win_pct}%
          </span>
        )}
        {ban && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <BanIcon aria-hidden className="size-3" />
            {teamName(ban.team)}
            {ban.auto && " · auto"}
          </span>
        )}
        {picked && (
          <span className="ml-auto text-xs font-semibold text-primary">
            Se juega
          </span>
        )}
        {canBan && (
          <span className="text-xs font-medium text-destructive">Banear</span>
        )}
      </button>
    </li>
  )
}
