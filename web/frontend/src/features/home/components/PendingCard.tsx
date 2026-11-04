import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  BellIcon,
  CircleCheckIcon,
  Gamepad2Icon,
  ShieldIcon,
  TrophyIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { EmptyState } from "@/components/brand/EmptyState"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { fmtClock, secondsLeft } from "@/features/matchmaking/labels"
import { useMmAction, useMmMutation } from "@/features/matchmaking/queries"
import type { MmInvite } from "@/features/matchmaking/types"
import { useNow } from "@/features/matchmaking/useNow"
import { myProfileOptions } from "@/features/profile/api/queries"
import {
  notificationsOptions,
  useMarkRead,
  useResolveRequest,
} from "@/features/shell/notifications/api/queries"
import {
  describe,
  isPending,
  timeAgo,
  type Notification,
  type NotificationKind,
} from "@/features/shell/notifications/lib/model"
import { pendingNotifications } from "../lib/home"
import { useMmState } from "../lib/useMmState"
import { Box } from "./Box"

const MAX = 5

// Ícono por tipo de aviso; el resto, la campana.
const ICON: Partial<Record<NotificationKind, LucideIcon>> = {
  invite: ShieldIcon,
  roster: ShieldIcon,
  team: ShieldIcon,
  tournament: TrophyIcon,
  veto: TrophyIcon,
  pcw: TrophyIcon,
}

/**
 * "Pendientes": lo que necesita una respuesta o un paso, por urgencia. Primero la sala del
 * matchmaking por aceptar, después los turnos (veto, servidor listo), las invitaciones a un grupo,
 * las de equipo y los avisos sin leer.
 */
export function PendingCard({ className }: { className?: string }) {
  const { source, state } = useMmState()
  const notifications = useQuery(notificationsOptions)
  const me = useQuery(myProfileOptions).data?.player?.nick
  const lobby = state?.lobby
  const accepting =
    lobby?.status === "accepting" &&
    !lobby.players.find((p) => p.is_me)?.accepted
  const open =
    !!lobby && !accepting && !["finished", "cancelled"].includes(lobby.status)
  const now = useNow(accepting)

  const rows: { key: string; rank: number; node: ReactNode }[] = []
  if (accepting)
    rows.push({
      key: "mm-accept",
      rank: 0,
      node: (
        <AcceptRow
          source={source}
          left={secondsLeft(lobby.accept_deadline, now)}
        />
      ),
    })
  if (open)
    rows.push({
      key: "mm-lobby",
      rank: 0,
      node: (
        <Row
          icon={Gamepad2Icon}
          hot
          title="Tu partida te espera"
          sub="Vuelve a la sala para vetar o conectarte."
          action={
            <LinkButton to="/play" primary>
              Ir a la sala
            </LinkButton>
          }
        />
      ),
    })
  for (const inv of state?.invites ?? [])
    rows.push({
      key: `mm-invite-${inv.id}`,
      rank: 2,
      node: <InviteRow source={source} invite={inv} />,
    })
  for (const { n, rank } of pendingNotifications(notifications.data ?? []))
    rows.push({
      key: `n-${n.id}`,
      rank,
      node: <NotificationRow n={n} me={me} />,
    })
  rows.sort((a, b) => a.rank - b.rank)
  const shown = rows.slice(0, MAX)

  return (
    <Box
      title="Pendientes"
      sub="Lo que necesita tu atención, ordenado por urgencia"
      className={className}
      aside={
        rows.length > 0 && (
          <Badge variant="muted">
            {rows.length} {rows.length === 1 ? "pendiente" : "pendientes"}
          </Badge>
        )
      }
    >
      {notifications.isPending ? (
        <Skeleton className="mx-4 mb-4 h-40 rounded-lg" />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={CircleCheckIcon}
          title="Todo al día"
          className="flex-1 border-t"
          action={<LinkButton to="/play">Buscar partida</LinkButton>}
        >
          Cuando te inviten, te toque vetar o tu equipo tenga partida, aparece
          acá.
        </EmptyState>
      ) : (
        <ul className="flex flex-col">
          {shown.map((r) => (
            <li key={r.key} className="border-t">
              {r.node}
            </li>
          ))}
        </ul>
      )}
    </Box>
  )
}

function Row({
  icon: Icon,
  title,
  sub,
  when,
  urgent,
  hot,
  action,
}: {
  icon: LucideIcon
  title: string
  sub?: string
  when?: ReactNode
  urgent?: boolean
  hot?: boolean
  action?: ReactNode
}) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[32px_minmax(0,1fr)_auto_auto]">
      <span
        className={cn(
          "grid size-8 place-items-center rounded-[9px]",
          hot ? "bg-primary/15 text-primary" : "bg-muted"
        )}
      >
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[13.5px] font-semibold">{title}</span>
        {sub && (
          <span className="truncate text-[12.5px] text-muted-foreground">
            {sub}
          </span>
        )}
      </span>
      <span
        className={cn(
          "hidden font-mono text-xs whitespace-nowrap sm:block",
          urgent ? "text-primary" : "text-muted-foreground"
        )}
      >
        {when}
      </span>
      <span className="flex gap-1.5">{action}</span>
    </div>
  )
}

function AcceptRow({
  source,
  left,
}: {
  source: Parameters<typeof useMmAction>[0]
  left: number
}) {
  const accept = useMmAction(source, "accept")
  return (
    <Row
      icon={Gamepad2Icon}
      hot
      title="Te encontramos partida"
      sub="Acéptala antes de que venza o vuelves a la cola sin ella."
      when={`Vence en ${fmtClock(left * 1000)}`}
      urgent
      action={
        <Button
          size="sm"
          disabled={accept.isPending}
          onClick={() => accept.mutate()}
        >
          Aceptar
        </Button>
      }
    />
  )
}

function InviteRow({
  source,
  invite,
}: {
  source: Parameters<typeof useMmAction>[0]
  invite: MmInvite
}) {
  const respond = useMmMutation((accept: boolean) =>
    source.respondInvite(invite.id, accept)
  )
  return (
    <Row
      icon={UsersIcon}
      hot
      title={`${invite.from.nick} te invitó a su grupo`}
      sub="Matchmaking · El grupo entra junto a la cola."
      action={
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={respond.isPending}
            onClick={() => respond.mutate(false)}
          >
            Rechazar
          </Button>
          <Button
            size="sm"
            disabled={respond.isPending}
            onClick={() => respond.mutate(true)}
          >
            Unirme
          </Button>
        </>
      }
    />
  )
}

function NotificationRow({ n, me }: { n: Notification; me?: string }) {
  const d = describe(n, me)
  const resolve = useResolveRequest()
  const markRead = useMarkRead()
  const urgent = n.type === "veto_turn"
  const read = () => {
    if (!n.read) markRead.mutate([n.id])
  }
  return (
    <Row
      icon={ICON[d.kind] ?? BellIcon}
      hot={urgent || isPending(n)}
      title={d.title}
      sub={d.body}
      when={timeAgo(n.created_at)}
      urgent={urgent}
      action={
        isPending(n) ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={resolve.isPending}
              onClick={() =>
                resolve.mutate({ item: n, resolution: "rejected" })
              }
            >
              Rechazar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={resolve.isPending}
              onClick={() =>
                resolve.mutate({ item: n, resolution: "accepted" })
              }
            >
              Aceptar
            </Button>
          </>
        ) : d.link ? (
          <Link
            to={d.link.to}
            params={d.link.params as never}
            onClick={read}
            className={buttonVariants({
              size: "sm",
              variant: urgent ? "default" : "outline",
            })}
          >
            {urgent ? "Ir al veto" : "Ver"}
          </Link>
        ) : (
          <Button size="sm" variant="ghost" onClick={read}>
            Listo
          </Button>
        )
      }
    />
  )
}

function LinkButton({
  to,
  primary,
  children,
}: {
  to: "/play"
  primary?: boolean
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={buttonVariants({
        size: "sm",
        variant: primary ? "default" : "outline",
      })}
    >
      {children}
    </Link>
  )
}
