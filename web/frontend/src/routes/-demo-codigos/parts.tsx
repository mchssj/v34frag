import { cn } from "cn"
import { CoinsIcon, CrownIcon, GiftIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { VipBadge } from "@/features/shop/cosmetics"
import { Amount, Thumb } from "@/features/shop/parts"
import type { ItemKind, ShopItem } from "@/features/shop/types"

import { DAY, MIN, type CodeState, type Reward } from "./sim"

export type Items = Map<string, ShopItem>

// En singular: "Marco Neón", no "Marcos Neón" (KINDS de la tienda está en plural).
export const KIND_ONE: Record<ItemKind, string> = {
  frame: "Marco",
  sticker: "Sticker",
  theme: "Tema",
  name: "Nombre",
  background: "Fondo",
}

export const itemName = (it: ShopItem) => `${KIND_ONE[it.kind]} ${it.name}`

export const fmtDate = (t: number) =>
  new Date(t).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

/** "3 días", "5 h", "12 min". */
export function span(ms: number): string {
  if (ms >= 2 * DAY) return `${Math.floor(ms / DAY)} días`
  if (ms >= DAY) return "1 día"
  if (ms >= 60 * MIN) return `${Math.floor(ms / (60 * MIN))} h`
  return `${Math.max(1, Math.ceil(ms / MIN))} min`
}

export const daysLabel = (d: number | null) =>
  d === null
    ? "para siempre"
    : d === 7
      ? "1 semana"
      : d === 30
        ? "1 mes"
        : d === 90
          ? "3 meses"
          : `${d} ${d === 1 ? "día" : "días"}`

type Prize = {
  reward: Reward
  itemId: string | null
  amount: number | null
  days?: number | null
}

/** El premio en una línea: "VIP · 1 semana", "500 puntos", "Marco Neón · 1 mes". */
export function prizeText(p: Prize, items: Items): string {
  if (p.reward === "points") return `${p.amount!.toLocaleString("es")} puntos`
  if (p.reward === "vip_coins")
    return `${p.amount!.toLocaleString("es")} monedas VIP`
  if (p.reward === "vip") return `VIP · ${daysLabel(p.days ?? null)}`
  const it = items.get(p.itemId!)
  const name = it ? itemName(it) : p.itemId!
  return `${name} · ${daysLabel(p.days ?? null)}`
}

/** Ícono o vista del premio. */
export function PrizeArt({
  p,
  items,
  alias,
  small,
  className,
}: {
  p: Prize
  items: Items
  alias: string
  small?: boolean
  className?: string
}) {
  const box = cn(
    "grid place-items-center rounded-lg bg-muted/40",
    small ? "size-12" : "size-24",
    className
  )
  if (p.reward === "item") {
    const it = items.get(p.itemId!)
    return it ? (
      <Thumb
        i={it}
        alias={alias}
        small={small}
        className={cn(
          "rounded-lg",
          small ? "size-12 h-12" : "size-24 h-24",
          className
        )}
      />
    ) : (
      <div className={box}>
        <GiftIcon aria-hidden className="size-1/2 text-muted-foreground" />
      </div>
    )
  }
  if (p.reward === "vip")
    return (
      <div className={cn(box, "bg-yellow-500/10")}>
        <VipBadge className={small ? "h-6" : "h-12"} />
      </div>
    )
  if (p.reward === "vip_coins")
    return (
      <div className={cn(box, "bg-yellow-500/10")}>
        <CrownIcon
          aria-hidden
          className={cn("text-[#e8b53a]", small ? "size-6" : "size-11")}
        />
      </div>
    )
  return (
    <div className={cn(box, "bg-primary/10")}>
      <CoinsIcon
        aria-hidden
        className={cn("text-primary", small ? "size-6" : "size-11")}
      />
    </div>
  )
}

export function PrizeAmount({ p }: { p: Prize }) {
  if (p.reward === "points")
    return <Amount value={p.amount!} currency="points" />
  if (p.reward === "vip_coins")
    return <Amount value={p.amount!} currency="vip" />
  return null
}

const STATE_VARIANT: Record<
  CodeState,
  "win" | "muted" | "warn" | "danger" | "primary"
> = {
  activo: "win",
  programado: "primary",
  agotado: "muted",
  vencido: "warn",
  revocado: "danger",
}

export function StateBadge({ state }: { state: CodeState }) {
  return (
    <Badge variant={STATE_VARIANT[state]} size="sm" className="capitalize">
      {state}
    </Badge>
  )
}
