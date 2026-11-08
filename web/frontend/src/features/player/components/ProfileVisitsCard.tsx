import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { LockIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { api, unwrap, type Schemas } from "@/api/client"
import { errorMessage } from "@/api/errors"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { timeAgo } from "@/features/shell/notifications/lib/model"
import { VipDialog } from "@/features/vip/VipDialog"

// Visitas a tu perfil (replanteo 86, bitácora 2026-11-07-visitas-al-perfil). Solo en el perfil propio. Sin VIP: el
// número y siluetas (la API no manda quiénes); con VIP: quiénes, las últimas y navegar sin dejar rastro (15 por semana).

type Visits = Schemas["ProfileVisits"]
type Visitor = NonNullable<Visits["items"]>[number]

export const profileVisitsKey = ["me", "profile-visits"] as const
export const profileVisitsOptions = queryOptions({
  queryKey: profileVisitsKey,
  queryFn: () => unwrap(api.GET("/api/v1/me/profile-visits")),
})

/** Colores de las siluetas: al azar, no dicen nada de quién visitó. */
const TONES = [
  "bg-red-500/80",
  "bg-lime-500/80",
  "bg-sky-500/80",
  "bg-yellow-500/80",
  "bg-violet-500/80",
  "bg-muted",
  "bg-muted",
  "bg-muted",
]
const GRID = 21
/** Al azar, una vez por carga de la página. */
const SEED = Math.floor(Math.random() * 1_000_000)

function Silhouette({ tone }: { tone: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid aspect-square justify-items-center overflow-hidden rounded-md",
        tone
      )}
    >
      <svg viewBox="0 0 24 24" className="mt-[30%] size-[70%]">
        <circle cx="12" cy="8" r="4.2" className="fill-black/35" />
        <path
          d="M3.5 24c0-5 3.8-8.6 8.5-8.6s8.5 3.6 8.5 8.6Z"
          className="fill-black/35"
        />
      </svg>
    </span>
  )
}

function VisitorTile({ v }: { v: Visitor }) {
  return (
    <Link
      to="/player/$nick"
      params={{ nick: v.nick }}
      title={`${v.nick} · ${timeAgo(v.visited_at)}`}
      aria-label={`Ver el perfil de ${v.nick}`}
      className="aspect-square overflow-hidden rounded-md"
    >
      <PlayerAvatar
        alias={v.nick}
        photo={v.photo_url}
        className="size-full rounded-md after:rounded-md"
        imageClassName="rounded-md"
        fallbackClassName="rounded-md text-sm"
      />
    </Link>
  )
}

function VisitorRow({ v }: { v: Visitor }) {
  return (
    <Link
      to="/player/$nick"
      params={{ nick: v.nick }}
      className="flex items-center gap-2.5 border-t py-2 text-[13px] hover:text-primary"
    >
      <PlayerAvatar alias={v.nick} photo={v.photo_url} size="row" />
      <span className="min-w-0 flex-1 truncate font-medium">{v.nick}</span>
      <LevelBadge level={v.level} size={20} />
      <span className="text-right text-xs whitespace-nowrap text-muted-foreground">
        {timeAgo(v.visited_at)}
      </span>
    </Link>
  )
}

function Incognito({ i }: { i: NonNullable<Visits["incognito"]> }) {
  const queryClient = useQueryClient()
  const set = useMutation({
    mutationFn: (enabled: boolean) =>
      unwrap(
        api.PUT("/api/v1/me/profile-visits/incognito", { body: { enabled } })
      ),
    onSuccess: (data) => queryClient.setQueryData(profileVisitsKey, data),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const left = Math.max(0, i.limit - i.used)
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
      <label className="flex items-center gap-2.5 text-[13px] font-semibold">
        <Switch
          checked={i.enabled}
          disabled={set.isPending}
          onCheckedChange={(v) => set.mutate(v)}
        />
        Navegar sin dejar rastro
        <span className="ml-auto font-mono text-xs text-yellow-600 tabular-nums dark:text-yellow-300">
          {left} de {i.limit}
        </span>
      </label>
      <div
        aria-hidden
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${i.limit}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: i.limit }, (_, k) => (
          <span
            key={k}
            className={cn(
              "h-1.5 rounded-[2px]",
              k < i.used ? "bg-muted-foreground/30" : "bg-yellow-400"
            )}
          />
        ))}
      </div>
      <span className="text-xs leading-snug text-muted-foreground">
        {i.enabled
          ? `Esta semana puedes ver ${left} ${left === 1 ? "perfil" : "perfiles"} más sin aparecer en sus visitas. Desde el perfil ${i.limit + 1} sí apareces. Se renueva el lunes.`
          : `Si lo prendes, visitas hasta ${i.limit} perfiles por semana sin aparecer en sus visitas.`}
      </span>
    </div>
  )
}

export function ProfileVisitsCard() {
  const { data: v } = useQuery(profileVisitsOptions)
  const [vipOpen, setVipOpen] = useState(false)
  const [allOpen, setAllOpen] = useState(false)
  const total = v?.total ?? 0
  // Las siluetas cambian de color en cada carga de la página: no corresponden a nadie.
  const tones = useMemo(
    () =>
      Array.from(
        { length: Math.min(total, GRID) },
        (_, i) => TONES[((SEED + i) * 2654435761) % TONES.length]!
      ),
    [total]
  )
  if (!v) return null
  const items = v.items ?? []
  return (
    <Card
      variant="outline"
      className={cn(
        "flex flex-col gap-3.5 p-4",
        v.vip && "border-yellow-500/30"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Visitas a tu perfil</span>
        {v.vip && (
          <Badge variant="vip" size="sm">
            VIP
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          <LockIcon aria-hidden className="size-3" />
          Solo tú ves esto
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[28px] leading-none font-semibold tabular-nums">
          {total}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {total === 1 ? "jugador" : "jugadores"} en 30 días
        </span>
        {v.week > 0 && (
          <span className="ml-auto font-mono text-xs text-win tabular-nums">
            {v.week} esta semana
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          Todavía nadie visitó tu perfil este mes.
        </p>
      ) : v.vip ? (
        <>
          <div className="grid grid-cols-7 gap-1.5">
            {items.slice(0, GRID).map((x) => (
              <VisitorTile key={x.player_id} v={x} />
            ))}
          </div>
          <div className="flex flex-col">
            {items.slice(0, 3).map((x) => (
              <VisitorRow key={x.player_id} v={x} />
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {tones.map((t, k) => (
            <Silhouette key={k} tone={t} />
          ))}
        </div>
      )}

      {v.vip ? (
        <>
          {v.incognito && <Incognito i={v.incognito} />}
          {items.length > 3 && (
            <Button
              variant="link"
              className="h-auto self-end p-0 text-[13px]"
              onClick={() => setAllOpen(true)}
            >
              Ver todas las visitas
            </Button>
          )}
          <Dialog open={allOpen} onOpenChange={setAllOpen}>
            <DialogContent className="sm:max-w-[440px]">
              <DialogHeader>
                <DialogTitle>Visitas a tu perfil</DialogTitle>
                <DialogDescription>
                  Los últimos 30 días, el más reciente primero.
                </DialogDescription>
              </DialogHeader>
              <div className="flex max-h-[60vh] flex-col overflow-y-auto">
                {items.map((x) => (
                  <VisitorRow key={x.player_id} v={x} />
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-3 py-2.5">
          <LockIcon
            aria-hidden
            className="size-4 shrink-0 text-yellow-600 dark:text-yellow-300"
          />
          <span className="flex-1 text-[13px] leading-snug">
            Con VIP ves quiénes son y cuándo entraron.
          </span>
          <Button
            size="sm"
            className="bg-yellow-400 text-yellow-950 hover:bg-yellow-300"
            onClick={() => setVipOpen(true)}
          >
            Ser VIP
          </Button>
        </div>
      )}
      <VipDialog open={vipOpen} onOpenChange={setVipOpen} />
    </Card>
  )
}
