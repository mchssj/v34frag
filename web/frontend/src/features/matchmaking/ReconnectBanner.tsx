import { useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import { PlayIcon, WifiOffIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cmleagueConnectUrl, fmtClock } from "./labels"
import { mmStateOptions, useMmSocket } from "./queries"
import { useMmSource } from "./source"
import { useNow } from "./useNow"

// Si te caes de una partida en curso, el aviso te sigue por toda la web hasta que vuelvas o venza
// el tiempo (plan, decisión "Reconexión visible"). Va en el layout `_app`, arriba de cada página.
export function ReconnectBanner() {
  const source = useMmSource()
  const socketUp = useMmSocket(source)
  const { data } = useQuery(mmStateOptions(source, socketUp, useQueryClient()))
  const lobby = data?.lobby
  const until = lobby?.players.find((p) => p.is_me)?.left_until ?? null
  const away = lobby?.status === "live" && !!until
  const now = useNow(away)
  if (!away || !until || !lobby.server) return null
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5"
    >
      <WifiOffIcon aria-hidden className="size-5 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Te desconectaste de la partida</p>
        <p className="text-[13px] text-muted-foreground">
          Vuelve antes de{" "}
          <span className="font-mono font-semibold text-foreground tabular-nums">
            {fmtClock(Date.parse(until) - now)}
          </span>{" "}
          o queda como abandono y recibes una sanción.
        </p>
      </div>
      <a
        href={cmleagueConnectUrl(lobby.server.address, lobby.server.password)}
        className={cn(buttonVariants({ size: "md" }))}
      >
        <PlayIcon aria-hidden />
        Volver a la partida
      </a>
    </div>
  )
}
