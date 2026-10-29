import { cn } from "cn"
import { SendIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useMmMutation } from "./queries"
import { useMmSource } from "./source"
import type { MmLobby } from "./types"

const MAX = 200

// Chat de sala (plan, decisión "Chat de sala"): a todos o solo al equipo.
export function LobbyChat({ lobby }: { lobby: MmLobby }) {
  const source = useMmSource()
  const [text, setText] = useState("")
  const [teamOnly, setTeamOnly] = useState(false)
  const send = useMmMutation(({ m, team }: { m: string; team: boolean }) =>
    source.sendChat(m, team)
  )
  const end = useRef<HTMLLIElement>(null)
  const count = lobby.chat.length
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" })
  }, [count])

  const submit = () => {
    const m = text.trim()
    if (!m) return
    send.mutate(
      { m, team: teamOnly },
      {
        onSuccess: () => setText(""),
        onError: (e) => toast.error(errorMessage(e)),
      }
    )
  }

  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardTitle>Chat de la sala</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
        <ul
          aria-label="Mensajes"
          aria-live="polite"
          className="flex h-56 flex-col gap-1.5 overflow-y-auto rounded-lg border bg-muted/30 p-2 text-sm"
        >
          {count === 0 && (
            <li className="m-auto text-xs text-muted-foreground">
              Todavía no hay mensajes.
            </li>
          )}
          {lobby.chat.map((m) => (
            <li key={m.id} className="leading-snug break-words">
              {m.team !== null && (
                <span className="mr-1 rounded bg-primary/15 px-1 text-[10px] font-semibold text-primary uppercase">
                  Equipo
                </span>
              )}
              <strong className={cn(m.mine && "text-primary")}>
                {m.nick}:
              </strong>{" "}
              {m.message}
            </li>
          ))}
          <li ref={end} aria-hidden />
        </ul>
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Button
            type="button"
            size="sm"
            variant={teamOnly ? "secondary" : "ghost"}
            aria-pressed={teamOnly}
            title="Mandar solo a tu equipo"
            onClick={() => setTeamOnly((v) => !v)}
            className="h-8"
          >
            {teamOnly ? "Equipo" : "Todos"}
          </Button>
          <Input
            aria-label="Mensaje"
            placeholder={teamOnly ? "Mensaje a tu equipo" : "Mensaje a todos"}
            maxLength={MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-8"
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Enviar"
            disabled={!text.trim() || send.isPending}
          >
            <SendIcon />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
