import { Link } from "@tanstack/react-router"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Gamepad2Icon, SearchIcon, ShieldAlertIcon } from "lucide-react"
import type { ReactNode } from "react"

import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { fmtClock } from "@/features/matchmaking/labels"
import { useNow } from "@/features/matchmaking/useNow"
import { useMmState } from "../lib/useMmState"

// Estados de la sala que siguen abiertos (aceptando, veto, servidor, en juego).
const CLOSED = new Set(["finished", "cancelled"])

/** Tarjeta "Jugar": refleja el estado del matchmaking y lleva a /play. */
export function PlayCard() {
  const { state } = useMmState()
  const inQueue = !!state?.queue
  const now = useNow(inQueue || !!state?.penalty)

  if (!state) return <Skeleton className="h-[78px] rounded-xl" />

  const lobby =
    state.lobby && !CLOSED.has(state.lobby.status) ? state.lobby : null
  if (lobby)
    return (
      <Frame
        icon={<Gamepad2Icon aria-hidden className="size-5" />}
        title="Tienes una partida en curso"
        sub="Vuelve a la sala para aceptar, vetar o conectarte."
        action={<GoPlay primary>Volver a la sala</GoPlay>}
      />
    )
  if (state.queue)
    return (
      <Frame
        highlight
        icon={<SearchIcon aria-hidden className="size-5" />}
        title="Buscando partida"
        sub={
          <span className="font-mono tabular-nums">
            {fmtClock(now - Date.parse(state.queue.joined_at))} · puesto{" "}
            {state.queue.position} de {state.queue_size}
            {state.queue.elo_window !== null &&
              ` · ±${state.queue.elo_window} ELO`}
          </span>
        }
        action={<GoPlay>Ver la cola</GoPlay>}
      />
    )
  if (state.ban)
    return (
      <Frame
        icon={<ShieldAlertIcon aria-hidden className="size-5" />}
        title={`Excluido del matchmaking hasta el ${format(parseISO(state.ban.until), "d 'de' MMMM", { locale: es })}`}
        sub={state.ban.reason}
      />
    )
  if (state.penalty && Date.parse(state.penalty.until) > now)
    return (
      <Frame
        icon={<ShieldAlertIcon aria-hidden className="size-5" />}
        title="Tienes una sanción por abandonar"
        sub={
          <>
            Puedes volver a jugar en{" "}
            <span className="font-mono tabular-nums">
              {fmtClock(Date.parse(state.penalty.until) - now)}
            </span>
            .
          </>
        }
      />
    )
  if (!state.open || state.block_reason)
    return (
      <Frame
        icon={<Gamepad2Icon aria-hidden className="size-5" />}
        title="Jugar una partida"
        sub={state.block_reason ?? "El matchmaking está cerrado por ahora."}
        action={<GoPlay>Ver más</GoPlay>}
      />
    )
  return (
    <Frame
      icon={<Gamepad2Icon aria-hidden className="size-5" />}
      title="Jugar una partida"
      sub="Matchmaking: te emparejamos por ELO y abrimos el servidor."
      stats={[
        [String(state.queue_size), "En cola"],
        [String(state.live_matches), "En juego"],
        [
          `${state.servers.free} de ${state.servers.total}`,
          "Servidores libres",
        ],
      ]}
      action={<GoPlay primary>Buscar partida</GoPlay>}
    />
  )
}

function Frame({
  icon,
  title,
  sub,
  stats,
  action,
  highlight,
}: {
  icon: ReactNode
  title: string
  sub: ReactNode
  stats?: [string, string][]
  action?: ReactNode
  highlight?: boolean
}) {
  return (
    <Card
      asChild
      variant="outline"
      className={highlight ? "border-primary/40" : undefined}
    >
      <section
        aria-label="Jugar"
        className="flex flex-wrap items-center gap-4 p-4"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/14 text-primary">
          {icon}
        </span>
        <div className="flex min-w-40 flex-1 flex-col gap-0.5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="text-[12.5px] text-muted-foreground">{sub}</p>
        </div>
        {stats && (
          <dl className="flex flex-wrap gap-[18px]">
            {stats.map(([v, l]) => (
              <div key={l} className="flex flex-col-reverse">
                <dt className="text-xs text-muted-foreground">{l}</dt>
                <dd className="font-mono text-[17px] font-semibold tabular-nums">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {action}
      </section>
    </Card>
  )
}

function GoPlay({
  primary,
  children,
}: {
  primary?: boolean
  children: ReactNode
}) {
  return (
    <Link
      to="/play"
      className={buttonVariants({ variant: primary ? "default" : "outline" })}
    >
      {children}
    </Link>
  )
}
