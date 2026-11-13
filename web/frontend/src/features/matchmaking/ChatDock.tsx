import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import { MessageSquareIcon, MinusIcon, SendIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlayerName } from "./PlayerMenu"
import { mmKeys } from "./queries"
import { useMmSource } from "./source"
import type { MmParty, MmPartyChatMessage } from "./types"

const MAX = 300
/** Respuestas de un toque en el chat del grupo, para no escribir mientras se busca. */
const QUICK = ["Dale", "¿Uno más?", "Listo", "Me voy en esta"]
const OPEN_KEY = "csstv.mm.chat-open"

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
 * Chat del grupo en Jugar (bitácoras 2026-11-08-pcw-demo y 2026-11-08-pcw-real): una ventana aparte abajo a la derecha, encima
 * de la página y sin achicarla. Solo con un grupo de más de uno. Se minimiza a un botón con los mensajes sin leer.
 * Sin chat global: no se quiere cargar el socket con mensajes para todos (Kyan, 2026-11-08).
 */
export function ChatDock({
  party,
  meNick,
}: {
  party: MmParty
  meNick: string
}) {
  const source = useMmSource()
  const [open, setOpen] = useState(readOpen)
  const { data = [] } = useQuery({
    // Con los miembros en la clave, el aviso de quién entró o salió aparece sin esperar otro mensaje.
    queryKey: [...mmKeys.partyChat, party.id, party.members.length],
    queryFn: ({ signal }) => source.partyChat!(signal),
  })

  // Sin leer: lo que llegó mientras estaba minimizado.
  const [seen, setSeen] = useState(0)
  const unread = open ? 0 : Math.max(0, data.length - seen)
  const toggle = (o: boolean) => {
    if (!o) setSeen(data.length)
    setOpen(o)
    try {
      localStorage.setItem(OPEN_KEY, o ? "1" : "0")
    } catch {
      // Sin almacenamiento, solo no se recuerda.
    }
  }
  const others = party.members.length - 1

  if (!open)
    return (
      <Button
        onClick={() => toggle(true)}
        className="fixed right-4 bottom-4 z-40 h-11 rounded-full px-4 shadow-lg"
        aria-label={
          unread
            ? `Abrir el chat del grupo, ${unread} sin leer`
            : "Abrir el chat del grupo"
        }
      >
        <MessageSquareIcon />
        Chat del grupo
        {unread > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-background px-1 font-mono text-[11px] text-foreground tabular-nums">
            {unread}
          </span>
        )}
      </Button>
    )

  return (
    <section
      aria-label="Chat del grupo"
      className="fixed right-4 bottom-4 z-40 flex h-[24rem] max-h-[calc(100dvh-2rem)] w-[min(21rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b py-1.5 pr-2 pl-3">
        <MessageSquareIcon aria-hidden className="size-3.5" />
        <h2 className="flex-1 text-sm font-semibold">
          Chat del grupo{" "}
          <span className="text-xs font-normal text-muted-foreground">
            · {others === 1 ? "1 compañero" : `${others} compañeros`}
          </span>
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Minimizar el chat"
          onClick={() => toggle(false)}
        >
          <MinusIcon />
        </Button>
      </div>
      <Room
        key={party.id}
        messages={data}
        meNick={meNick}
        empty="Solo lo ven los del grupo. Se borra al deshacerse."
        placeholder="Mensaje al grupo"
        quick={QUICK}
        send={(m) => source.sendPartyChat!(m)}
        invalidate={mmKeys.partyChat}
      />
    </section>
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
              className="text-center text-xs wrap-anywhere text-muted-foreground"
            >
              {m.message}
            </li>
          ) : (
            <li key={m.id} className="leading-snug wrap-anywhere">
              <PlayerName
                nick={m.nick}
                playerId={m.player_id}
                messageId={m.id}
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
