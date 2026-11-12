import { cn } from "cn"
import { CheckIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

import { VipBadge } from "./cosmetics"
import type { ShopDemo } from "./demo"
import { RARITY, rarityOf, type Bundle } from "./economy"
import {
  Amount,
  collectionName,
  isEquipped,
  MainAction,
  PriceLine,
  RarityTag,
  SaleChip,
  Thumb,
  Vis,
  WishButton,
} from "./parts"
import { KINDS, type CatalogItem } from "./types"

export function ItemCard({
  c,
  shop,
  alias,
  trying,
  onOpen,
  onBuy,
  onEquip,
}: {
  c: CatalogItem
  shop: ShopDemo
  alias: string
  trying?: boolean
  onOpen: () => void
  onBuy: () => void
  onEquip: (on: boolean) => void
}) {
  const eq = isEquipped(c, shop)
  const rarity = RARITY[rarityOf(c)]
  const onSale = !c.vip_only && c.weekly && c.base_price !== c.price
  return (
    <Card
      variant="outline"
      asChild
      className={cn(
        "group/item flex flex-col overflow-hidden bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--primary)_45%,var(--border))] motion-reduce:hover:translate-y-0",
        c.vip_only && "border-[color-mix(in_oklch,#e8b53a_30%,var(--border))]",
        (eq || trying) && "border-primary ring-1 ring-primary"
      )}
    >
      <article>
        <div className="relative">
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Ver ${c.name}`}
            className="block w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Vis i={c} shop={shop} alias={alias} />
          </button>
          {/* Franja de rareza, como en las cajas de skins. */}
          <i className={cn("absolute inset-x-0 bottom-0 h-0.5", rarity.bar)} />
          <span className="pointer-events-none absolute top-2 left-2 flex gap-1">
            {onSale && <SaleChip pct={shop.config.weekly_discount} />}
            {eq && (
              <Badge variant="strong" shape="tag" size="xs">
                <CheckIcon />
                Puesto
              </Badge>
            )}
          </span>
          <span className="absolute top-2 right-2 flex items-center gap-1">
            {c.vip_only && <VipBadge className="h-6" />}
            <WishButton
              on={shop.wish.includes(c.id)}
              onClick={() => shop.toggleWish(c.id)}
              className="opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 aria-pressed:opacity-100"
            />
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-sm font-semibold">{c.name}</h3>
            <RarityTag item={c} className="shrink-0" />
          </div>
          <span className="truncate text-[11px] text-muted-foreground">
            {KINDS[c.kind].replace(/s$/, "")} · {collectionName(c.collection)}
            {c.animated ? " · Animado" : ""}
          </span>
          <div className="mt-auto flex items-end justify-between gap-2 border-t pt-2.5">
            <div className="min-h-9 min-w-0">
              <PriceLine c={c} shop={shop} />
            </div>
            <MainAction c={c} shop={shop} onBuy={onBuy} onEquip={onEquip} />
          </div>
        </div>
      </article>
    </Card>
  )
}

export function BundleCard({
  b,
  shop,
  alias,
  onOpen,
}: {
  b: Bundle
  shop: ShopDemo
  alias: string
  onOpen: () => void
}) {
  const have = b.items.length - b.missing.length
  const done = !b.missing.length
  const locked = b.currency === "vip" && !shop.vip
  const bal = b.currency === "vip" ? shop.coins.balance : shop.points.balance
  return (
    <Card
      variant="outline"
      className={cn(
        "flex w-[300px] flex-col overflow-hidden bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]",
        b.currency === "vip" &&
          "border-[color-mix(in_oklch,#e8b53a_30%,var(--border))]"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver el pack ${b.name}`}
        className="grid grid-cols-2 gap-px bg-border text-left"
      >
        {b.items.slice(0, 4).map((i, k) => (
          // Con 3 artículos, el primero ocupa las dos filas: sin hueco vacío.
          <div
            key={i.id}
            className={cn(
              "relative bg-card",
              b.items.length === 3 && k === 0 && "row-span-2"
            )}
          >
            <Thumb
              i={i}
              alias={alias}
              className={b.items.length === 3 && k === 0 ? "h-full" : undefined}
            />
            {shop.owned.includes(i.id) && (
              <CheckIcon className="absolute top-1.5 right-1.5 size-4 rounded-full bg-win p-0.5 text-white" />
            )}
          </div>
        ))}
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold">Pack {b.name}</h3>
          {b.currency === "vip" && <VipBadge className="h-5" />}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {collectionName(b.collection)} · {b.items.length} artículos · tenés{" "}
          {have}
        </span>
        <div className="mt-auto flex items-end justify-between gap-2 border-t pt-2.5">
          {done ? (
            <span className="text-xs font-semibold text-win">
              Colección completa
            </span>
          ) : (
            <span className="flex items-baseline gap-1.5">
              <Amount
                value={b.full}
                currency={b.currency}
                strike
                className="text-xs"
              />
              <Amount
                value={b.price}
                currency={b.currency}
                className="text-base"
              />
            </span>
          )}
          {!done && (
            <Button
              size="sm"
              variant={locked || bal < b.price ? "outline" : "default"}
              onClick={onOpen}
            >
              Ver pack
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
