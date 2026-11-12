import { cn } from "cn"
import { CheckIcon, CoinsIcon, HeartIcon, LockIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { FramedAvatar, MiniCard, NameFx, VipBadge } from "./cosmetics"
import type { ShopDemo } from "./demo"
import { RARITY, rarityOf } from "./economy"
import {
  COLLECTIONS,
  COSMETICS_BASE,
  type CatalogItem,
  type Currency,
  type ShopItem,
} from "./types"

// Piezas que comparten la tienda, el inventario y la ficha del artículo.

export const GOLD = "text-[#e8b53a]"
export const num = (n: number) => n.toLocaleString("es")

/** Lo que cuesta comprarlo hoy: lo normal en puntos, lo VIP en monedas VIP (shop_buy). */
export function priceOf(c: CatalogItem, shop: ShopDemo) {
  const vip = c.vip_only
  return {
    price: vip ? c.vip_price : c.price,
    balance: vip ? shop.coins.balance : shop.points.balance,
    currency: (vip ? "vip" : "points") as Currency,
  }
}

/** Cantidad con su moneda: "1.200 pts" o la medalla VIP y "500". */
export function Amount({
  value,
  currency,
  className,
  strike,
}: {
  value: number
  currency: Currency
  className?: string
  strike?: boolean
}) {
  const Tag = strike ? "s" : "span"
  return (
    <Tag
      className={cn(
        "inline-flex items-baseline gap-1 font-mono font-semibold tabular-nums",
        currency === "vip" ? GOLD : "text-primary",
        strike && "font-normal text-muted-foreground",
        className
      )}
    >
      {num(value)}
      <span className="font-sans text-[0.75em] font-medium opacity-70">
        {currency === "vip" ? "VIP" : "pts"}
      </span>
    </Tag>
  )
}

export function CurrencyIcon({
  currency,
  className,
}: {
  currency: Currency
  className?: string
}) {
  return currency === "vip" ? (
    <VipBadge className={cn("h-4", className)} />
  ) : (
    <CoinsIcon aria-hidden className={cn("size-4 text-primary", className)} />
  )
}

export function RarityTag({
  item,
  className,
}: {
  item: CatalogItem
  className?: string
}) {
  const r = RARITY[rarityOf(item)]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold",
        r.text,
        className
      )}
    >
      <i className={cn("size-1.5 rounded-full", r.bar)} />
      {r.label}
    </span>
  )
}

/** La vista previa de un artículo según su tipo, sobre el fondo de la tarjeta. */
export function Vis({
  i,
  shop,
  alias,
  tall,
}: {
  i: ShopItem
  shop: ShopDemo
  alias: string
  tall?: boolean
}) {
  return (
    <div
      className={cn(
        "grid place-items-center bg-muted/40 bg-[radial-gradient(120%_90%_at_50%_0%,color-mix(in_oklch,var(--foreground)_7%,transparent),transparent_70%)]",
        tall ? "h-[220px]" : "h-[150px]"
      )}
    >
      {i.kind === "frame" && (
        <FramedAvatar alias={alias} frame={i} size={tall ? 168 : 120} />
      )}
      {i.kind === "sticker" && (
        <img
          src={COSMETICS_BASE + (i.file ?? "")}
          alt=""
          loading="lazy"
          className={tall ? "size-36" : "size-24"}
        />
      )}
      {i.kind === "theme" && (
        <div className={cn("w-4/5 rounded-lg border bg-card p-3", i.css_class)}>
          <b className="text-sm text-primary">{alias}</b>
          <small className="block text-xs text-muted-foreground">
            Así se ve tu perfil
          </small>
          <i className="mt-2 block h-1.5 rounded bg-primary" />
        </div>
      )}
      {i.kind === "name" && (
        <NameFx
          text={alias}
          effect={i}
          className={cn(
            "font-bold text-primary",
            tall ? "text-4xl" : "text-2xl"
          )}
        />
      )}
      {i.kind === "background" && (
        <MiniCard
          className="h-full max-w-none rounded-none border-0"
          avatar={tall ? 104 : 72}
          alias={alias}
          level={shop.level}
          frame={shop.visible.frame ? shop.byId[shop.visible.frame] : null}
          name={shop.visible.name ? shop.byId[shop.visible.name] : null}
          background={i}
        />
      )}
    </div>
  )
}

/** Vista chica de un artículo (packs, inventario y ranuras). */
export function Thumb({
  i,
  alias,
  small,
  className,
}: {
  i: ShopItem
  alias: string
  small?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid place-items-center overflow-hidden bg-muted/40",
        small ? "h-14" : "h-[96px]",
        className
      )}
    >
      {i.kind === "frame" && (
        <FramedAvatar alias={alias} frame={i} size={small ? 52 : 80} />
      )}
      {i.kind === "sticker" && (
        <img
          src={COSMETICS_BASE + (i.file ?? "")}
          alt=""
          loading="lazy"
          className={small ? "size-10" : "size-16"}
        />
      )}
      {i.kind === "theme" && (
        <div
          className={cn(
            "w-4/5 rounded-md border bg-card",
            small ? "p-1.5" : "p-2",
            i.css_class
          )}
        >
          {!small && (
            <b className="block truncate text-xs text-primary">{alias}</b>
          )}
          <i
            className={cn("block h-1 rounded bg-primary", !small && "mt-1.5")}
          />
        </div>
      )}
      {i.kind === "name" && (
        <NameFx
          text={small ? alias.slice(0, 6) : alias}
          effect={i}
          className={cn(
            "max-w-[90%] truncate font-bold text-primary",
            small ? "text-xs" : "text-base"
          )}
        />
      )}
      {i.kind === "background" && (
        <img
          src={COSMETICS_BASE + (i.file ?? "")}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      )}
    </div>
  )
}

export function WishButton({
  on,
  onClick,
  className,
}: {
  on: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={
        on ? "Sacar de la lista de deseos" : "Agregar a la lista de deseos"
      }
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "grid size-7 place-items-center rounded-full bg-background/80 text-muted-foreground backdrop-blur transition-colors hover:text-rose-500",
        on && "text-rose-500",
        className
      )}
    >
      <HeartIcon className={cn("size-3.5", on && "fill-current")} />
    </button>
  )
}

/** Precio o estado de un artículo, como lo ve la cuenta. */
export function PriceLine({ c, shop }: { c: CatalogItem; shop: ShopDemo }) {
  const owned = shop.owned.includes(c.id)
  const usable = shop.canUse(c)
  const p = priceOf(c, shop)
  const vipLocked = c.vip_only && !shop.vip
  const onSale = !c.vip_only && c.weekly && c.base_price !== c.price
  if (c.vip_reward)
    return (
      <span className={cn("text-xs font-semibold", GOLD)}>
        {usable ? "Incluido con tu VIP" : "Viene con el VIP"}
      </span>
    )
  if (owned)
    return (
      <span className="flex flex-col text-xs font-semibold text-win">
        <span className="inline-flex items-center gap-1">
          <CheckIcon className="size-3.5" /> En tu inventario
        </span>
        {vipLocked && (
          <span className="font-normal text-muted-foreground">
            Congelado: se usa siendo VIP
          </span>
        )}
      </span>
    )
  if (p.price == null)
    return (
      <span className="text-xs text-muted-foreground">No está a la venta</span>
    )
  const short = p.balance < p.price
  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex items-baseline gap-1.5">
        {onSale && (
          <Amount
            value={c.base_price!}
            currency="points"
            strike
            className="text-xs"
          />
        )}
        <Amount value={p.price} currency={p.currency} className="text-base" />
      </span>
      <span className="text-[11px] text-muted-foreground">
        {vipLocked
          ? "Se compra siendo VIP"
          : short
            ? `Te faltan ${num(p.price - p.balance)}`
            : "Te alcanza"}
      </span>
    </span>
  )
}

/** Botón principal de un artículo: equipar, comprar o nada. */
export function MainAction({
  c,
  shop,
  onBuy,
  onEquip,
  className,
}: {
  c: CatalogItem
  shop: ShopDemo
  onBuy: () => void
  onEquip: (on: boolean) => void
  className?: string
}) {
  const owned = shop.owned.includes(c.id)
  const usable = shop.canUse(c)
  const eq = isEquipped(c, shop)
  const p = priceOf(c, shop)
  const vipLocked = c.vip_only && !shop.vip
  if (usable)
    return (
      <Button
        size="sm"
        className={className}
        variant={eq ? "outline" : "default"}
        onClick={() => onEquip(!eq)}
      >
        {eq ? "Sacar" : "Equipar"}
      </Button>
    )
  if (owned || c.vip_reward || p.price == null) return null
  return (
    <Button
      size="sm"
      className={className}
      disabled={vipLocked || p.balance < p.price}
      onClick={onBuy}
    >
      {vipLocked && <LockIcon />}
      Comprar
    </Button>
  )
}

export function isEquipped(c: ShopItem, shop: ShopDemo) {
  return c.kind === "sticker"
    ? shop.visible.stickers.includes(c.id)
    : shop.visible[c.kind] === c.id
}

export function SaleChip({ pct }: { pct: number }) {
  return (
    <Badge variant="solid" shape="tag" size="xs" className="gap-0.5">
      −{pct}%
    </Badge>
  )
}

export function collectionName(c: string) {
  return COLLECTIONS[c] ?? c
}

export function SectionTitle({
  icon,
  title,
  aside,
}: {
  icon: ReactNode
  title: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        {icon}
        {title}
      </h2>
      {aside}
    </div>
  )
}
