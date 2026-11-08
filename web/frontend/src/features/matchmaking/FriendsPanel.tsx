import { cn } from "cn"
import { UserPlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { timeAgo } from "@/features/shell/notifications/lib/model"
import { PlayerPicker } from "./BlockPanel"
import { PlayerName } from "./PlayerMenu"
import { useMmMutation } from "./queries"
import { useMmSource } from "./source"
import type { MmFriend, MmState } from "./types"

// Amigos con solicitudes (replanteo 85, bitácora 2026-11-07-amigos-con-solicitudes): arriba las recibidas con
// Aceptar / Rechazar (rechazar es en silencio), la lista con el estado, las enviadas con Cancelar y el buscador.

const STATUS: Record<MmFriend["status"], { label: string; dot: string }> = {
  queue: { label: "Buscando partida", dot: "bg-primary" },
  free: { label: "Disponible", dot: "bg-win" },
  playing: { label: "En partida", dot: "bg-destructive" },
  offline: { label: "Desconectado", dot: "bg-muted-foreground" },
}

const NO_REQUESTS: MmState["friend_requests"] = { received: [], sent: [] }

export function FriendsPanel({
  friends,
  requests = NO_REQUESTS,
}: {
  friends: MmFriend[]
  requests?: MmState["friend_requests"]
}) {
  const source = useMmSource()
  const add = useMmMutation((id: string) => source.addFriend(id))
  const remove = useMmMutation((id: string) => source.removeFriend(id))
  const answer = useMmMutation(
    ({ id, accept }: { id: string; accept: boolean }) =>
      source.answerFriend(id, accept)
  )
  const invite = useMmMutation((id: string) => source.invite(id))
  const onError = (e: unknown) => toast.error(errorMessage(e))
  return (
    <Card
      variant="outline"
      asChild
      className="flex flex-col overflow-hidden shadow-[0_1px_2px_rgb(0_0_0/.04)]"
    >
      <section aria-label="Amigos">
        <div className="flex items-center gap-2 border-b px-4 py-3.5">
          <h2 className="text-sm font-semibold">Amigos</h2>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {friends.length}
          </span>
        </div>

        {requests.received.length > 0 && (
          <div
            role="group"
            aria-label="Solicitudes recibidas"
            className="flex flex-col gap-2 border-b bg-primary/5 px-4 py-3"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-primary">
              Solicitudes recibidas
              <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground tabular-nums">
                {requests.received.length}
              </span>
            </span>
            <ul className="flex flex-col gap-2">
              {requests.received.map((r) => (
                <li
                  key={r.player_id}
                  className="flex items-center gap-2 text-[13px]"
                >
                  <LevelBadge level={r.level} size={20} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.nick}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {timeAgo(r.created_at)}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="icon-xs"
                    aria-label={`Rechazar la solicitud de ${r.nick}`}
                    title="Rechazar"
                    disabled={answer.isPending}
                    onClick={() =>
                      answer.mutate(
                        { id: r.player_id, accept: false },
                        { onError }
                      )
                    }
                  >
                    <XIcon />
                  </Button>
                  <Button
                    size="xs"
                    aria-label={`Aceptar la solicitud de ${r.nick}`}
                    disabled={answer.isPending}
                    onClick={() =>
                      answer.mutate(
                        { id: r.player_id, accept: true },
                        {
                          onSuccess: () =>
                            toast.success(`${r.nick} ahora es tu amigo`),
                          onError,
                        }
                      )
                    }
                  >
                    Aceptar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2 p-4">
          {friends.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Todavía no tienes amigos. Envíale una solicitud a alguien.
            </p>
          ) : (
            // Se ven 3 amigos y el resto con la barra: la tarjeta no crece con la lista (Kyan, 2026-11-08).
            <ul
              aria-label="Lista de amigos"
              tabIndex={friends.length > 3 ? 0 : undefined}
              className="-mr-2 flex max-h-[116px] [scrollbar-width:thin] flex-col gap-1 overflow-y-auto overscroll-contain pr-2"
            >
              {friends.map((f) => {
                const status = STATUS[f.status] ?? STATUS.offline
                return (
                  <li
                    key={f.player_id}
                    className="flex min-h-9 shrink-0 items-center gap-2 text-[13px]"
                  >
                    <LevelBadge level={f.level} size={20} />
                    <span className="min-w-0 flex-1">
                      <PlayerName
                        nick={f.nick}
                        playerId={f.player_id}
                        friend
                        className="block max-w-full truncate font-medium"
                      />
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span
                          aria-hidden
                          className={cn("size-1.5 rounded-full", status.dot)}
                        />
                        {status.label}
                      </span>
                    </span>
                    {(f.status === "free" || f.status === "queue") && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Invitar a ${f.nick} al grupo`}
                        title="Invitar al grupo"
                        disabled={invite.isPending}
                        onClick={() =>
                          invite.mutate(f.player_id, {
                            onSuccess: () =>
                              toast.success(`Invitaste a ${f.nick}`),
                            onError,
                          })
                        }
                      >
                        <UserPlusIcon />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Eliminar a ${f.nick} de amigos`}
                      title="Eliminar de amigos"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(f.player_id, { onError })}
                    >
                      <XIcon />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {requests.sent.length > 0 && (
          <div
            role="group"
            aria-label="Solicitudes enviadas"
            className="flex flex-col gap-1.5 border-t px-4 py-3"
          >
            <span className="text-xs font-semibold text-muted-foreground">
              Enviadas, esperando respuesta
            </span>
            <ul className="flex flex-col gap-1.5">
              {requests.sent.map((s) => (
                <li
                  key={s.player_id}
                  className="flex items-center gap-2 text-[13px]"
                >
                  <LevelBadge level={s.level} size={20} />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {s.nick}
                  </span>
                  <Button
                    variant="outline"
                    size="xs"
                    aria-label={`Cancelar la solicitud a ${s.nick}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(s.player_id, { onError })}
                  >
                    Cancelar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t p-4">
          <span className="text-xs font-semibold text-muted-foreground">
            Agregar amigo
          </span>
          <PlayerPicker
            label="Buscar a quién enviarle una solicitud de amistad"
            verb="Enviar solicitud"
            pending={add.isPending}
            onPick={(id, done) =>
              add.mutate(id, {
                onSuccess: () => {
                  done()
                  toast.success("Solicitud enviada")
                },
                onError,
              })
            }
          />
        </div>
      </section>
    </Card>
  )
}
