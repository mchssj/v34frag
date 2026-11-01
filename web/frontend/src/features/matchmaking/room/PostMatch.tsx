import { cn } from "cn"
import { RotateCcwIcon, ThumbsUpIcon, UserPlusIcon } from "lucide-react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { Button } from "@/components/ui/button"
import { LEVEL_FLOORS } from "@/features/player/labels"
import { useMmMutation } from "../queries"
import { useMmSource } from "../source"
import type { MmLobby, MmPlayer } from "../types"
import { comparedToAverage, levelOf } from "./roomData"

// Lo que aparece cuando termina la partida: tu resumen, jugar de nuevo, felicitar e invitar.

/** Tu ELO antes y después, cuánto falta para el próximo nivel y tu partida contra tu promedio. */
export function MatchSummary({ lobby }: { lobby: MmLobby }) {
  const me = lobby.players.find((p) => p.is_me)
  const stat = lobby.match?.stats.find((s) => s.me)
  if (!me || !stat) return null
  const delta = stat.delta ?? 0
  const after = me.elo + delta
  const level = levelOf(after, LEVEL_FLOORS)
  const floor = LEVEL_FLOORS[level - 1]!
  const next = LEVEL_FLOORS[level] ?? null
  const progress = next ? ((after - floor) / (next - floor)) * 100 : 100
  const compared = comparedToAverage(stat, me.recent)
  return (
    <section aria-label="Tu resumen" className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">Tu partida</h2>
      <div className="mt-2 flex items-center gap-2 font-mono tabular-nums">
        <span className="text-muted-foreground">{me.elo}</span>
        <span aria-hidden className="text-muted-foreground">
          →
        </span>
        <span className="text-lg font-bold">{after}</span>
        <span
          className={cn(
            "font-semibold",
            delta >= 0 ? "text-win" : "text-destructive"
          )}
        >
          {delta >= 0 ? "+" : ""}
          {delta}
        </span>
        <LevelBadge level={level} size={22} className="ml-auto" />
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        aria-hidden
      >
        <div
          className="h-full bg-primary"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {next
          ? `Faltan ${next - after} ELO para el nivel ${level + 1}`
          : "Nivel máximo"}
      </p>
      {compared.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {compared.map((c) => (
            <li key={c.label}>
              {c.label}{" "}
              <span
                className={cn(
                  "font-mono font-semibold",
                  c.diff >= 0 ? "text-win" : "text-destructive"
                )}
              >
                {c.diff >= 0 ? "+" : ""}
                {c.diff}%
              </span>
            </li>
          ))}
          <li className="text-muted-foreground">contra tu promedio</li>
        </ul>
      )}
    </section>
  )
}

/** Vuelve a la cola con el mismo modo, la misma región y tu grupo. */
export function PlayAgain({
  lobby,
  onDone,
}: {
  lobby: MmLobby
  onDone: () => void
}) {
  const source = useMmSource()
  const join = useMmMutation(() => source.join(lobby.mode, lobby.region))
  return (
    <Button
      size="md"
      disabled={join.isPending}
      onClick={() =>
        join.mutate(undefined, {
          onSuccess: onDone,
          onError: (e) => toast.error(errorMessage(e)),
        })
      }
    >
      <RotateCcwIcon aria-hidden />
      Jugar de nuevo
    </Button>
  )
}

/** Felicitar a un jugador (un voto por partida) e invitarlo al grupo. */
export function PlayerPostMatch({
  lobby,
  player,
}: {
  lobby: MmLobby
  player: MmPlayer
}) {
  const source = useMmSource()
  const commend = useMmMutation(() =>
    source.commend(lobby.id, player.player_id)
  )
  const invite = useMmMutation(() => source.invite(player.player_id))
  const voted = lobby.commended
  const mine = voted === player.player_id
  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={!!voted || commend.isPending}
        aria-label={
          mine ? `Felicitaste a ${player.nick}` : `Felicitar a ${player.nick}`
        }
        title={mine ? "Lo felicitaste" : "Felicitar"}
        className={cn(mine && "text-primary disabled:opacity-100")}
        onClick={() =>
          commend.mutate(undefined, {
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      >
        <ThumbsUpIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={invite.isPending}
        aria-label={`Invitar a ${player.nick} al grupo`}
        title="Invitar al grupo"
        onClick={() =>
          invite.mutate(undefined, {
            onSuccess: () => toast.success(`Invitaste a ${player.nick}`),
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      >
        <UserPlusIcon />
      </Button>
    </>
  )
}
