import { cn } from "cn"
import {
  CheckIcon,
  LayersIcon,
  MonitorIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { Segmented } from "@/components/brand/Segmented"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import {
  CardBackground,
  FramedAvatar,
  MiniCard,
  NameFx,
  Stickers,
  VipBadge,
} from "./cosmetics"
import type { ShopDemo } from "./demo"
import { themeKey, type Bundle } from "./economy"
import {
  Amount,
  collectionName,
  MainAction,
  PriceLine,
  priceOf,
  RarityTag,
  Thumb,
  Vis,
  WishButton,
} from "./parts"
import { COSMETICS_BASE, KINDS, type CatalogItem, type Equipped } from "./types"

export type Opened =
  { type: "item"; id: string } | { type: "bundle"; id: string } | null

type View = "profile" | "mini" | "lobby"

/** Lo equipado con un artículo (o un pack) puesto encima, para la vista previa. */
function withItems(e: Equipped, items: CatalogItem[]): Equipped {
  const n = { ...e, stickers: [...e.stickers] }
  for (const t of items) {
    if (t.kind === "sticker") {
      if (!n.stickers.includes(t.id))
        n.stickers = [...n.stickers, t.id].slice(-3)
    } else n[t.kind] = t.id
  }
  return n
}

export function ItemSheet({
  opened,
  onOpen,
  onClose,
  shop,
  alias,
}: {
  opened: Opened
  onOpen: (o: Opened) => void
  onClose: () => void
  shop: ShopDemo
  alias: string
}) {
  const [view, setView] = useState<View>("profile")
  const [confirm, setConfirm] = useState<"item" | "bundle" | null>(null)
  const item = opened?.type === "item" ? shop.catalogById[opened.id] : undefined
  const bundle =
    opened?.type === "bundle"
      ? shop.bundles.find((b) => b.id === opened.id)
      : item
        ? shop.bundles.find((b) => b.id === `pack-${themeKey(item)}`)
        : undefined
  const preview =
    opened?.type === "bundle" ? (bundle?.items ?? []) : item ? [item] : []
  const prev = withItems(shop.visible, preview)

  function buyItem() {
    if (!item) return
    const err = shop.buy(item.id)
    setConfirm(null)
    if (err) return void toast.error(err)
    toast.success(`¡${item.name} ya es tuyo!`, {
      action: { label: "Ponérmelo", onClick: () => shop.equip(item.id, true) },
    })
  }
  function buyBundle(b: Bundle) {
    const err = shop.buyBundle(b)
    setConfirm(null)
    if (err) return void toast.error(err)
    toast.success(`¡Compraste el pack ${b.name}! Ya está en tu inventario.`)
  }
  function equip(on: boolean) {
    if (!item) return
    const err = shop.equip(item.id, on)
    if (err) toast.error(err)
    else
      toast.success(
        on ? `Te pusiste «${item.name}».` : `Te sacaste «${item.name}».`
      )
  }

  const title =
    opened?.type === "bundle"
      ? `Pack ${bundle?.name ?? ""}`
      : (item?.name ?? "")
  const p = item ? priceOf(item, shop) : null
  return (
    <Sheet open={!!opened} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[440px]">
        <SheetHeader className="gap-1 border-b p-4 pr-12">
          <SheetTitle className="flex items-center gap-2 text-lg">
            {title}
            {(item?.vip_only || bundle?.currency === "vip") &&
            opened?.type !== "item" ? (
              <VipBadge className="h-5" />
            ) : item?.vip_only ? (
              <VipBadge className="h-5" />
            ) : null}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {item && <RarityTag item={item} />}
            <span>
              {opened?.type === "bundle"
                ? `${bundle?.items.length ?? 0} artículos · ${collectionName(bundle?.collection ?? "")}`
                : item
                  ? `${KINDS[item.kind].replace(/s$/, "")} · ${collectionName(item.collection)}${item.animated ? " · Animado" : ""}`
                  : ""}
            </span>
          </SheetDescription>
        </SheetHeader>

        {item && (
          <div className="relative border-b">
            <Vis i={item} shop={shop} alias={alias} tall />
            <WishButton
              on={shop.wish.includes(item.id)}
              onClick={() => shop.toggleWish(item.id)}
              className="absolute top-3 right-3 size-8"
            />
          </div>
        )}

        <div className="flex flex-col gap-5 p-4">
          {item?.description && (
            <p className="text-sm text-muted-foreground">{item.description}</p>
          )}

          {/* Cómo te queda, en los tres lugares donde se ve. */}
          <section className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Cómo te queda</h3>
              <Segmented
                label="Dónde se ve"
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: "profile", label: "Perfil", icon: UserIcon },
                  { value: "mini", label: "Miniperfil", icon: MonitorIcon },
                  { value: "lobby", label: "Lobby", icon: UsersIcon },
                ]}
              />
            </div>
            <Preview view={view} prev={prev} shop={shop} alias={alias} />
          </section>

          {bundle && (
            <section className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <LayersIcon className="size-4 text-muted-foreground" />
                  {opened?.type === "bundle" ? "Qué trae" : "Colección"}
                </h3>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {bundle.items.length - bundle.missing.length}/
                  {bundle.items.length}
                </span>
              </div>
              <Progress
                value={
                  ((bundle.items.length - bundle.missing.length) /
                    bundle.items.length) *
                  100
                }
              />
              <ul className="grid grid-cols-2 gap-2">
                {bundle.items.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => onOpen({ type: "item", id: i.id })}
                      className={cn(
                        "relative block w-full overflow-hidden rounded-lg border text-left transition-colors hover:border-primary/60",
                        i.id === item?.id && "border-primary"
                      )}
                    >
                      <Thumb i={i} alias={alias} />
                      <span className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs">
                        <span className="truncate">
                          {KINDS[i.kind].replace(/s$/, "")}
                        </span>
                        {shop.owned.includes(i.id) ? (
                          <CheckIcon className="size-3.5 text-win" />
                        ) : (
                          <Amount
                            value={
                              (bundle.currency === "vip"
                                ? i.vip_price
                                : i.base_price) ?? 0
                            }
                            currency={bundle.currency}
                            className="text-[11px]"
                          />
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {opened?.type === "item" && bundle.missing.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpen({ type: "bundle", id: bundle.id })}
                >
                  Completar la colección con el pack (−
                  {shop.config.bundle_discount}%)
                </Button>
              )}
            </section>
          )}
        </div>

        <SheetFooter className="mt-auto flex-row items-center justify-between gap-3 border-t bg-card p-4">
          {item && (
            <>
              <PriceLine c={item} shop={shop} />
              <MainAction
                c={item}
                shop={shop}
                onBuy={() => setConfirm("item")}
                onEquip={equip}
                className="min-w-28"
              />
            </>
          )}
          {opened?.type === "bundle" && bundle && (
            <>
              {bundle.missing.length ? (
                <span className="flex items-baseline gap-1.5">
                  <Amount
                    value={bundle.full}
                    currency={bundle.currency}
                    strike
                    className="text-xs"
                  />
                  <Amount
                    value={bundle.price}
                    currency={bundle.currency}
                    className="text-lg"
                  />
                </span>
              ) : (
                <span className="text-sm font-semibold text-win">
                  Ya tenés toda la colección
                </span>
              )}
              {bundle.missing.length > 0 && (
                <Button
                  className="min-w-28"
                  disabled={
                    (bundle.currency === "vip" && !shop.vip) ||
                    (bundle.currency === "vip"
                      ? shop.coins.balance
                      : shop.points.balance) < bundle.price
                  }
                  onClick={() => setConfirm("bundle")}
                >
                  Comprar pack
                </Button>
              )}
            </>
          )}
        </SheetFooter>
      </SheetContent>

      <ConfirmDialog
        open={confirm === "item" && !!item}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Comprar «${item?.name ?? ""}»?`}
        description={
          p?.price != null && (
            <>
              Cuesta <Amount value={p.price} currency={p.currency} />. Te quedan{" "}
              <Amount value={p.balance - p.price} currency={p.currency} />.
            </>
          )
        }
        confirmLabel="Comprar"
        pending={false}
        error={null}
        onConfirm={buyItem}
      />
      <ConfirmDialog
        open={confirm === "bundle" && !!bundle}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Comprar el pack ${bundle?.name ?? ""}?`}
        description={
          bundle && (
            <>
              Te llevás {bundle.missing.length} artículos por{" "}
              <Amount value={bundle.price} currency={bundle.currency} /> en vez
              de <Amount value={bundle.full} currency={bundle.currency} />.
            </>
          )
        }
        confirmLabel="Comprar pack"
        pending={false}
        error={null}
        onConfirm={() => bundle && buyBundle(bundle)}
      />
    </Sheet>
  )
}

/** Perfil, miniperfil o la tarjeta del lobby con lo que se está mirando puesto. */
export function Preview({
  view,
  prev,
  shop,
  alias,
}: {
  view: View
  prev: Equipped
  shop: ShopDemo
  alias: string
}) {
  const frame = prev.frame ? shop.byId[prev.frame] : null
  const name = prev.name ? shop.byId[prev.name] : null
  const background = prev.background ? shop.byId[prev.background] : null
  const theme = prev.theme ? shop.byId[prev.theme] : null
  if (view === "mini")
    return (
      <div className="grid place-items-center rounded-lg border bg-muted/30 p-4">
        <MiniCard
          alias={alias}
          level={shop.level}
          frame={frame}
          name={name}
          background={background}
          sub="Así te ven al pasar el mouse"
        />
      </div>
    )
  if (view === "lobby")
    return (
      <div className="grid place-items-center rounded-lg border bg-muted/30 p-4">
        <div
          className={cn(
            "relative isolate flex aspect-[3/4] w-[190px] flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border p-3",
            background ? "border-white/15 text-white" : "bg-card"
          )}
        >
          <CardBackground
            src={background?.file ? COSMETICS_BASE + background.file : null}
          />
          <FramedAvatar alias={alias} frame={frame} size={88} />
          <span className="flex max-w-full items-center gap-1.5 text-sm font-semibold">
            <NameFx text={alias} effect={name} className="truncate" />
            {shop.vip && <VipBadge />}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-black/40 px-2 py-1 font-mono text-xs font-semibold tabular-nums">
            <LevelBadge level={shop.level} size={20} className="rounded-full" />
            1.420
          </span>
        </div>
      </div>
    )
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border bg-card p-4",
        theme?.css_class
      )}
    >
      <FramedAvatar alias={alias} frame={frame} size={96} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="flex items-center gap-2 text-lg font-semibold text-primary">
          <NameFx text={alias} effect={name} className="truncate" />
          {shop.vip && <VipBadge />}
        </span>
        <span className="text-xs text-muted-foreground">
          Nivel {shop.level} · Argentina
        </span>
        <Stickers
          size={32}
          items={prev.stickers.map((s) => shop.byId[s]!).filter(Boolean)}
        />
      </div>
    </div>
  )
}
