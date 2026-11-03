import { cn } from "cn"
import { UserPlusIcon, UsersIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlayerPicker } from "./BlockPanel"
import { useMmMutation } from "./queries"
import { useMmSource } from "./source"
import type { MmFriend } from "./types"

// Amigos (plan, decisión "Amigos"): no hay solicitudes. Cada uno marca a quien quiera, y solo si los
// dos se marcaron se ven el estado y se avisan al entrar a la cola.

// Con más de 3, la lista queda del alto de 3 filas (con scroll) y aparece el buscador.
const VISIBLE = 3

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

const STATUS: Record<
  NonNullable<MmFriend["status"]>,
  { label: string; dot: string }
> = {
  queue: { label: "Buscando partida", dot: "bg-primary" },
  free: { label: "Disponible", dot: "bg-win" },
  playing: { label: "En partida", dot: "bg-destructive" },
  offline: { label: "Desconectado", dot: "bg-muted-foreground" },
}

export function FriendsPanel({ friends }: { friends: MmFriend[] }) {
  const source = useMmSource()
  const add = useMmMutation((id: string) => source.addFriend(id))
  const remove = useMmMutation((id: string) => source.removeFriend(id))
  const invite = useMmMutation((id: string) => source.invite(id))
  const [q, setQ] = useState("")
  const term = fold(q.trim())
  const shown = term
    ? friends.filter((f) => fold(f.nick).includes(term))
    : friends
  return (
    <section
      aria-label="Amigos"
      className="flex flex-col overflow-hidden rounded-xl border bg-card"
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <UsersIcon aria-hidden className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Amigos</h2>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {friends.length > VISIBLE && (
          <Input
            type="search"
            aria-label="Buscar entre tus amigos"
            placeholder="Buscar entre tus amigos"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8"
          />
        )}
        {term && shown.length === 0 && (
          <p className="text-[13px] text-muted-foreground">
            Ningún amigo con ese nick.
          </p>
        )}
        <ul
          aria-label="Tus amigos"
          className="-mr-2 flex max-h-29 flex-col gap-1 overflow-y-auto pr-2"
        >
          {shown.map((f) => {
            const status = f.status && STATUS[f.status]
            return (
              <li
                key={f.player_id}
                className="flex items-center gap-2 text-[13px]"
              >
                <LevelBadge level={f.level} size={20} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.nick}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 rounded-full",
                        status?.dot ?? "bg-muted"
                      )}
                    />
                    {status?.label ?? "Todavía no te marcó"}
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
                        onSuccess: () => toast.success(`Invitaste a ${f.nick}`),
                        onError: (e) => toast.error(errorMessage(e)),
                      })
                    }
                  >
                    <UserPlusIcon />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Sacar a ${f.nick} de amigos`}
                  title="Sacar de amigos"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(f.player_id)}
                >
                  <XIcon />
                </Button>
              </li>
            )
          })}
        </ul>
        <PlayerPicker
          label="Buscar a quién sumar a amigos"
          placeholder="Sumar amigo por nick"
          verb="Sumar"
          pending={add.isPending}
          onPick={(id, done) =>
            add.mutate(id, {
              onSuccess: done,
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        />
      </div>
    </section>
  )
}
