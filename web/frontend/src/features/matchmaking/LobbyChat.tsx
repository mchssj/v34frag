import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import { SendIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlayerName } from "./PlayerMenu"
import { mmKeys } from "./queries"
import { useMmSource } from "./source"
import type { MmLobby } from "./types"

const MAX = 300

// Chat de sala (plan, decisión "Chat de sala"): debajo de los jugadores: el de equipo en la columna
// propia y el general en la del rival. Los dos salen del chat de la partida.
export function LobbyChat({
  lobby,
  scope,
  className,
}: {
  lobby: MmLobby
  scope: "all" | "team"
  className?: string
}) {
  const source = useMmSource()
  const [text, setText] = useState("")
  const matchId = lobby.match_id!
  const chatKey = [...mmKeys.all, "chat", matchId]
  const queryClient = useQueryClient()
  const { data = [] } = useQuery({
    queryKey: chatKey,
    queryFn: ({ signal }) => source.chat(matchId, signal),
  })
  const team = scope === "team"
  const send = useMutation({
    mutationFn: (m: string) => source.sendChat(matchId, m, team),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKey }),
  })
  const me = lobby.players.find((p) => p.is_me)
  const messages = data.filter((m) =>
    team ? m.team !== null && m.team === me?.team : m.team === null
  )
  const list = useRef<HTMLUListElement>(null)
  const count = messages.length
  useEffect(() => {
    // Solo baja la lista: scrollIntoView movería también la página.
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [count])

  const submit = () => {
    const m = text.trim()
    if (!m) return
    send.mutate(m, {
      onSuccess: () => setText(""),
      onError: (e) => toast.error(errorMessage(e)),
    })
  }
  const where = team ? "a tu equipo" : "a todos"

  return (
    <section
      aria-label={team ? "Chat de equipo" : "Chat general"}
      className={cn(
        "flex h-64 flex-col overflow-hidden rounded-xl border bg-card",
        className
      )}
    >
      <h2 className="border-b px-4 py-2 text-sm font-semibold">
        {team ? "Chat de equipo" : "Chat general"}
      </h2>
      <ul
        ref={list}
        aria-label="Mensajes"
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 py-2 text-[13px]"
      >
        {count === 0 && (
          <li className="m-auto text-xs text-muted-foreground">
            Todavía no hay mensajes.
          </li>
        )}
        {messages.map((m) => (
          <li key={m.id} className="leading-snug wrap-anywhere">
            <PlayerName
              nick={m.nick}
              playerId={lobby.players.find((p) => p.nick === m.nick)?.player_id}
              isMe={m.nick === me?.nick}
              lobbyId={lobby.id}
              className={cn("font-bold", m.nick === me?.nick && "text-primary")}
            >
              {m.nick}:
            </PlayerName>{" "}
            {m.message}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-1.5 border-t p-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Input
          aria-label={`Mensaje ${where}`}
          placeholder={`Mensaje ${where}`}
          maxLength={MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-8"
        />
        <Button
          type="submit"
          size="icon"
          aria-label={`Enviar ${where}`}
          disabled={!text.trim() || send.isPending}
        >
          <SendIcon />
        </Button>
      </form>
    </section>
  )
}
