import { useQuery } from "@tanstack/react-query"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { cn } from "cn"
import {
  BanIcon,
  BellIcon,
  CrosshairIcon,
  KeyRoundIcon,
  MedalIcon,
  MegaphoneIcon,
  ShieldAlertIcon,
  ShieldIcon,
  TrendingUpIcon,
  TrophyIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { useMe } from "@/auth/queries"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { InviteDialog } from "./InviteDialog"
import {
  describe,
  filterByTab,
  isPending,
  isUrgent,
  timeAgo,
  type Described,
  type Notification,
  type NotificationKind,
  type NotificationTab,
} from "./model"
import {
  notificationsOptions,
  unreadCountOptions,
  useMarkRead,
  useResolveRequest,
  type Resolution,
} from "./queries"

const ICONS: Record<NotificationKind, LucideIcon> = {
  invite: UserPlusIcon,
  roster: UsersIcon,
  team: ShieldIcon,
  tournament: TrophyIcon,
  veto: BanIcon,
  pcw: CrosshairIcon,
  elo: TrendingUpIcon,
  medal: MedalIcon,
  account: KeyRoundIcon,
  news: MegaphoneIcon,
  admin: ShieldAlertIcon,
}

const TABS: { value: NotificationTab; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "Sin leer" },
  { value: "requests", label: "Solicitudes" },
]

/** Cómo terminó una invitación o un pedido (también si se respondió desde otro lado). */
export function resolutionLabel(n: Notification) {
  const request = n.type === "team_join_request"
  switch (n.resolution) {
    case "accepted":
      return request ? "Aceptado" : "Aceptada"
    case "rejected":
      return request ? "Rechazado" : "Rechazada"
    case "cancelled":
      return request ? "Cancelado" : "Cancelada"
    case "expired":
      return request ? "Vencido" : "Vencida"
    default:
      return null
  }
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<NotificationTab>("all")
  const [invite, setInvite] = useState<Notification | null>(null)
  const me = useMe().data?.tag ?? null
  const count = useQuery(unreadCountOptions).data
  const list = useQuery({ ...notificationsOptions, enabled: open })
  const markRead = useMarkRead()
  const resolveRequest = useResolveRequest()
  const navigate = useNavigate()
  const router = useRouter()

  // Al cambiar de ruta se cierra (también con atrás / adelante del navegador).
  useEffect(
    () => router.subscribe("onResolved", () => setOpen(false)),
    [router]
  )

  const items = list.data ?? []
  const unread = count?.unread ?? 0

  function openItem(item: Notification, d: Described) {
    if (!item.read) markRead.mutate([item.id])
    if (item.type === "team_invite") {
      setOpen(false)
      setInvite(item)
    } else if (d.link) {
      setOpen(false)
      void navigate({ to: d.link.to, params: d.link.params } as never)
    }
  }

  function resolve(item: Notification, resolution: Resolution) {
    resolveRequest.mutate(
      { item, resolution },
      {
        onSuccess: () => {
          const what = item.type === "team_invite" ? "Invitación" : "Pedido"
          const done =
            resolution === "accepted"
              ? item.type === "team_invite"
                ? "aceptada"
                : "aceptado"
              : item.type === "team_invite"
                ? "rechazada"
                : "rechazado"
          toast.success(`${what} ${done}`)
        },
        onError: (e) => toast.error(errorMessage(e)),
      }
    )
  }

  const shown = filterByTab(items, tab)
  const counts: Record<NotificationTab, number> = {
    all: items.length,
    unread: items.filter((i) => !i.read).length,
    requests: items.filter(isPending).length,
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="relative size-8 data-[state=open]:bg-accent"
            aria-label={
              unread ? `Notificaciones, ${unread} sin leer` : "Notificaciones"
            }
          >
            <BellIcon aria-hidden />
            {unread > 0 && (
              <span
                aria-hidden
                className="absolute -top-1.5 -right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground"
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[400px] max-w-[calc(100vw-24px)] gap-0 p-0 leading-design"
        >
          <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
            <h2 className="text-sm font-semibold">Notificaciones</h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={unread === 0 && counts.unread === 0}
              onClick={() => markRead.mutate("all")}
            >
              Marcar todo como leído
            </Button>
          </div>
          <div
            role="tablist"
            aria-label="Filtro"
            className="flex gap-1 px-3 pb-2"
          >
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => setTab(t.value)}
                className="inline-flex h-[26px] items-center gap-1.5 rounded-md border border-transparent px-2.5 text-xs text-muted-foreground hover:text-foreground aria-selected:border-border aria-selected:bg-background aria-selected:text-foreground"
              >
                {t.label}
                <span className="font-mono text-[11px]">{counts[t.value]}</span>
              </button>
            ))}
          </div>
          {list.isPending ? (
            <p className="border-t px-4 py-10 text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          ) : list.isError ? (
            <p className="border-t px-4 py-10 text-center text-sm text-muted-foreground">
              {errorMessage(list.error)}
            </p>
          ) : shown.length === 0 ? (
            <p className="border-t px-4 py-10 text-center text-sm text-muted-foreground">
              Estás al día.
            </p>
          ) : (
            <ul className="max-h-[min(460px,64vh)] overflow-y-auto border-t">
              {shown.map((item) => {
                const d = describe(item, me)
                return (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    d={d}
                    busy={
                      resolveRequest.isPending &&
                      resolveRequest.variables?.item.id === item.id
                    }
                    onOpen={() => openItem(item, d)}
                    onResolve={(r) => resolve(item, r)}
                    onDetail={() => {
                      setOpen(false)
                      setInvite(item)
                    }}
                  />
                )
              })}
            </ul>
          )}
        </PopoverContent>
      </Popover>
      <InviteDialog
        item={invite}
        d={invite ? describe(invite, me) : null}
        resolution={invite ? resolutionLabel(invite) : null}
        onClose={() => setInvite(null)}
        onResolve={(r) => {
          if (invite) resolve(invite, r)
          setInvite(null)
        }}
      />
    </>
  )
}

function NotificationRow({
  item,
  d,
  busy,
  onOpen,
  onResolve,
  onDetail,
}: {
  item: Notification
  d: Described
  busy: boolean
  onOpen: () => void
  onResolve: (r: Resolution) => void
  onDetail: () => void
}) {
  const Icon = ICONS[d.kind]
  const done = resolutionLabel(item)
  return (
    <li
      className={cn(
        "flex flex-col gap-2 border-b px-4 py-3 last:border-b-0",
        !item.read && "bg-primary/5"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex items-start gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full",
            isUrgent(item) ? "bg-primary/16 text-primary" : "bg-muted"
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm",
                item.read ? "font-medium" : "font-semibold"
              )}
            >
              {d.title}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {timeAgo(item.created_at)}
            </span>
          </span>
          {d.body && (
            <span className="text-xs text-muted-foreground">{d.body}</span>
          )}
        </span>
        {!item.read && (
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
            <span className="sr-only">Sin leer</span>
          </span>
        )}
      </button>
      {item.actionable && (
        <div className="flex items-center gap-2 pl-11">
          {done ? (
            <span
              className={cn(
                "text-xs font-medium",
                item.resolution === "accepted"
                  ? "text-win"
                  : "text-muted-foreground"
              )}
            >
              {done}
            </span>
          ) : (
            <>
              <Button
                size="sm"
                className="h-7"
                disabled={busy}
                onClick={() => onResolve("accepted")}
              >
                Aceptar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={busy}
                onClick={() => onResolve("rejected")}
              >
                Rechazar
              </Button>
              {item.type === "team_invite" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={onDetail}
                >
                  Ver detalle
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </li>
  )
}
