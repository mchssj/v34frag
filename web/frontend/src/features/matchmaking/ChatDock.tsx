import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import { MessageSquareIcon, MinusIcon, SendIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlayerName } from "./PlayerMenu"
import { mmKeys } from "./queries"
import { useMmSource } from "./source"
import type { MmParty, MmPartyChatMessage } from "./types"

const MAX = 300
/** Respuestas de un toque en el chat del grupo, para no escribir mientras se busca. */
const QUICK = ["Dale", "¿Uno más?", "Listo", "Me voy en esta"]
const OPEN_KEY = "csstv.mm.chat-open"

type Room = "party" | "global"

const readOpen = () => {
  try {
    const v = localStorage.getItem(OPEN_KEY)
    // En celular arranca cerrado para no tapar la página.
    return v === null ? window.innerWidth >= 1024 : v === "1"
  } catch {
    return true
  }
}

/**
 * Chat de Jugar (prototipo, bitácora 2026-11-08-pcw-demo): una ventana aparte abajo a la derecha, encima de la
 * página y sin achicarla, con el chat del grupo y el global. Se minimiza a un botón con los mensajes sin leer.
 */
export function ChatDock({
  party,
  meNick,
}: {
  party: MmParty | null
  meNick: string
}) {
  const source = useMmSource()
  const inParty = !!party && party.members.length > 1 && !!source.partyChat
  const [open, setOpen] = useState(readOpen)
  const [room, setRoom] = useState<Room>(inParty ? "party" : "global")
  const active: Room = room === "party" && !inParty ? "global" : room

  const global = useQuery({
    queryKey: mmKeys.globalChat,
    queryFn: ({ signal }) => source.globalChat!(signal),
  })
  const group = useQuery({
    // Con los miembros en la clave, el aviso de quién entró o salió aparece sin esperar otro mensaje.
    queryKey: [...mmKeys.partyChat, party?.id, party?.members.length],
    queryFn: ({ signal }) => source.partyChat!(signal),
    enabled: inParty,
  })

  // Sin leer: lo que llegó desde la última vez que se vio cada sala. La sala abierta no tiene.
  const [seen, setSeen] = useState<Record<Room, number>>({
    party: 0,
    global: 0,
  })
  const count = (r: Room) =>
    (r === "party"
      ? inParty
        ? group.data?.length
        : 0
      : global.data?.length) ?? 0
  const unread = (r: Room) =>
    open && active === r ? 0 : Math.max(0, count(r) - seen[r])
  // Al salir de una sala (cambiar de pestaña o minimizar) queda vista hasta ese mensaje.
  const leave = (r: Room) => setSeen((x) => ({ ...x, [r]: count(r) }))

  const pick = (r: Room) => {
    leave(active)
    setRoom(r)
  }
  const toggle = (o: boolean) => {
    if (!o) leave(active)
    setOpen(o)
    try {
      localStorage.setItem(OPEN_KEY, o ? "1" : "0")
    } catch {
      // Sin almacenamiento, solo no se recuerda.
    }
  }
  const total = unread("party") + unread("global")

  if (!open)
    return (
      <Button
        onClick={() => toggle(true)}
        className="fixed right-4 bottom-4 z-40 h-11 rounded-full px-4 shadow-lg"
        aria-label={
          total ? `Abrir el chat, ${total} sin leer` : "Abrir el chat"
        }
      >
        <MessageSquareIcon />
        Chat
        {total > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-background px-1 font-mono text-[11px] text-foreground tabular-nums">
            {total}
          </span>
        )}
      </Button>
    )

  return (
    <section
      aria-label="Chat"
      className="fixed right-4 bottom-4 z-40 flex h-[26rem] max-h-[calc(100dvh-2rem)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b px-2 py-1.5">
        <Tabs
          value={active}
          onValueChange={(v) => pick(v as Room)}
          className="flex-1"
        >
          <TabsList variant="line" aria-label="Sala del chat">
            {source.partyChat && (
              <TabsTrigger value="party" disabled={!inParty}>
                Grupo
                <Unread n={unread("party")} />
              </TabsTrigger>
            )}
            <TabsTrigger value="global">
              Global
              <Unread n={unread("global")} />
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Minimizar el chat"
          onClick={() => toggle(false)}
        >
          <MinusIcon />
        </Button>
      </div>
      {active === "party" && party ? (
        <Room
          key={`party-${party.id}`}
          messages={group.data ?? []}
          meNick={meNick}
          empty="Solo lo ven los del grupo. Se borra al deshacerse."
          placeholder="Mensaje al grupo"
          quick={QUICK}
          send={(m) => source.sendPartyChat!(m)}
          invalidate={mmKeys.partyChat}
        />
      ) : (
        <Room
          key="global"
          messages={global.data ?? []}
          meNick={meNick}
          empty="Todavía no hay mensajes."
          placeholder="Mensaje a todos"
          send={(m) => source.sendGlobalChat!(m)}
          invalidate={mmKeys.globalChat}
          note={
            inParty
              ? undefined
              : "Lo ven todos los que están en Jugar. Sin insultos: se puede reportar."
          }
        />
      )}
    </section>
  )
}

function Unread({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[10px] text-primary-foreground tabular-nums">
      {n}
    </span>
  )
}

function Room({
  messages,
  meNick,
  empty,
  placeholder,
  quick,
  note,
  send: sendFn,
  invalidate,
}: {
  messages: MmPartyChatMessage[]
  meNick: string | undefined
  empty: string
  placeholder: string
  quick?: string[]
  note?: string
  send: (m: string) => Promise<void>
  invalidate: readonly unknown[]
}) {
  const queryClient = useQueryClient()
  const [text, setText] = useState("")
  const send = useMutation({
    mutationFn: sendFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invalidate }),
  })
  const list = useRef<HTMLUListElement>(null)
  const count = messages.length
  useEffect(() => {
    // Solo baja la lista: scrollIntoView movería también la página.
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [count])

  const submit = (raw: string) => {
    const m = raw.trim()
    if (!m) return
    send.mutate(m, {
      onSuccess: () => setText(""),
      onError: (e) => toast.error(errorMessage(e)),
    })
  }

  return (
    <>
      <ul
        ref={list}
        aria-label="Mensajes"
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2 text-[13px]"
      >
        {count === 0 && (
          <li className="m-auto text-center text-xs text-muted-foreground">
            {empty}
          </li>
        )}
        {messages.map((m) =>
          m.system ? (
            <li
              key={m.id}
              className="text-center text-xs text-muted-foreground"
            >
              {m.message}
            </li>
          ) : (
            <li key={m.id} className="leading-snug break-words">
              <PlayerName
                nick={m.nick}
                playerId={m.player_id}
                isMe={m.nick === meNick}
                className={cn("font-bold", m.nick === meNick && "text-primary")}
              >
                {m.nick}:
              </PlayerName>{" "}
              {m.message}
            </li>
          )
        )}
      </ul>
      {note && (
        <p className="px-3 pb-1 text-[11px] text-muted-foreground">{note}</p>
      )}
      {quick && (
        <div className="flex flex-wrap gap-1 px-2 pt-2">
          {quick.map((q) => (
            <Button
              key={q}
              size="xs"
              variant="outline"
              disabled={send.isPending}
              onClick={() => submit(q)}
            >
              {q}
            </Button>
          ))}
        </div>
      )}
      <form
        className="flex gap-1.5 p-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit(text)
        }}
      >
        <Input
          aria-label={placeholder}
          placeholder={placeholder}
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
    </>
  )
}
