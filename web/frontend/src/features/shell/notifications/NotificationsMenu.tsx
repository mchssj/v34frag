import { useNavigate, useRouter } from "@tanstack/react-router"
import { cn } from "cn"
import {
  BanIcon,
  BellIcon,
  CrosshairIcon,
  MedalIcon,
  ShieldIcon,
  TrendingUpIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { InviteDialog } from "./InviteDialog"
import {
  filterByTab,
  isActionable,
  isUrgent,
  timeAgo,
  useNotifications,
  type Notification,
  type NotificationKind,
  type NotificationTab,
} from "./model"

const ICONS: Record<NotificationKind, LucideIcon> = {
  invite: UserPlusIcon,
  pcw: CrosshairIcon,
  veto: BanIcon,
  roster: UsersIcon,
  medal: MedalIcon,
  team: ShieldIcon,
  elo: TrendingUpIcon,
}

const TABS: { value: NotificationTab; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "Sin leer" },
  { value: "requests", label: "Solicitudes" },
]

export function NotificationsMenu({ captain }: { captain: boolean }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<NotificationTab>("all")
  const [invite, setInvite] = useState<Notification | null>(null)
  const n = useNotifications({ captain })
  const navigate = useNavigate()
  const router = useRouter()

  // Al cambiar de ruta se cierra (también con atrás / adelante del navegador).
  useEffect(
    () => router.subscribe("onResolved", () => setOpen(false)),
    [router]
  )

  function openItem(item: Notification) {
    n.markRead(item.id)
    if (item.kind === "invite") {
      setOpen(false)
      setInvite(item)
    } else if (item.path) {
      setOpen(false)
      void navigate({ to: item.path })
    }
  }

  function resolve(item: Notification, resolution: "accepted" | "rejected") {
    n.resolve(item.id, resolution)
    const what = item.kind === "invite" ? "Invitación" : "Solicitud"
    toast.success(
      `${what} ${resolution === "accepted" ? "aceptada" : "rechazada"}`
    )
  }

  const list = filterByTab(n.items, tab)
  const counts: Record<NotificationTab, number> = {
    all: n.items.length,
    unread: n.unread,
    requests: filterByTab(n.items, "requests").length,
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
              n.unread
                ? `Notificaciones, ${n.unread} sin leer`
                : "Notificaciones"
            }
          >
            <BellIcon aria-hidden />
            {n.unread > 0 && (
              <span
                aria-hidden
                className="absolute -top-1.5 -right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 font-mono text-[10px] font-semibold text-primary-foreground ring-2 ring-background"
              >
                {n.unread}
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
              disabled={n.unread === 0}
              onClick={n.markAllRead}
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
                className="inline-flex h-[26px] items-center gap-1.5 rounded-md border border-transparent px-2.5 text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-selected:border-border aria-selected:bg-accent aria-selected:text-foreground"
              >
                {t.label}
                <span className="font-mono text-[11px]">{counts[t.value]}</span>
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <p className="border-t px-4 py-10 text-center text-sm text-muted-foreground">
              Estás al día.
            </p>
          ) : (
            <ul className="max-h-[min(460px,64vh)] overflow-y-auto border-t">
              {list.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onOpen={() => openItem(item)}
                  onResolve={(r) => resolve(item, r)}
                  onDetail={() => {
                    setOpen(false)
                    setInvite(item)
                  }}
                />
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
      <InviteDialog
        item={invite}
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
  onOpen,
  onResolve,
  onDetail,
}: {
  item: Notification
  onOpen: () => void
  onResolve: (r: "accepted" | "rejected") => void
  onDetail: () => void
}) {
  const Icon = ICONS[item.kind]
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
              {item.title}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {timeAgo(item.createdAt)}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">{item.body}</span>
        </span>
        {!item.read && (
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
            <span className="sr-only">Sin leer</span>
          </span>
        )}
      </button>
      {isActionable(item) && (
        <div className="flex items-center gap-2 pl-11">
          {item.resolution ? (
            <span
              className={cn(
                "text-xs font-medium",
                item.resolution === "accepted"
                  ? "text-win"
                  : "text-muted-foreground"
              )}
            >
              {item.resolution === "accepted" ? "Aceptada" : "Rechazada"}
            </span>
          ) : (
            <>
              <Button
                size="sm"
                className="h-7"
                onClick={() => onResolve("accepted")}
              >
                Aceptar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => onResolve("rejected")}
              >
                Rechazar
              </Button>
              {item.kind === "invite" && (
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
