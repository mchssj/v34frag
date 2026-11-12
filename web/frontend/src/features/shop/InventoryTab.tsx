import { cn } from "cn"
import {
  FrameIcon,
  ImageIcon,
  LockIcon,
  MonitorIcon,
  PackageOpenIcon,
  PaletteIcon,
  PlusIcon,
  StickerIcon,
  TypeIcon,
  UserIcon,
  UsersIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/brand/EmptyState"
import { Segmented } from "@/components/brand/Segmented"
import { StatTile } from "@/components/brand/StatTile"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

import type { ShopDemo } from "./demo"
import { RARITY, rarityOf } from "./economy"
import { Preview, type Opened } from "./ItemSheet"
import { collectionName, num, Thumb } from "./parts"
import { KINDS, type CatalogItem, type ItemKind } from "./types"

// Inventario de la cuenta: lo puesto (ranuras), lo que tiene y cuánto le falta de cada colección.

type Slot = { kind: ItemKind; index?: number }
const SLOTS: { slot: Slot; label: string; icon: LucideIcon }[] = [
  { slot: { kind: "frame" }, label: "Marco", icon: FrameIcon },
  { slot: { kind: "background" }, label: "Fondo", icon: ImageIcon },
  { slot: { kind: "theme" }, label: "Tema", icon: PaletteIcon },
  { slot: { kind: "name" }, label: "Nombre", icon: TypeIcon },
  {
    slot: { kind: "sticker", index: 0 },
    label: "Sticker 1",
    icon: StickerIcon,
  },
  {
    slot: { kind: "sticker", index: 1 },
    label: "Sticker 2",
    icon: StickerIcon,
  },
  {
    slot: { kind: "sticker", index: 2 },
    label: "Sticker 3",
    icon: StickerIcon,
  },
]
const same = (a: Slot, b: Slot) => a.kind === b.kind && a.index === b.index

export function InventoryTab({
  shop,
  alias,
  open,
  goShop,
}: {
  shop: ShopDemo
  alias: string
  open: (o: Opened) => void
  goShop: () => void
}) {
  const [view, setView] = useState<"profile" | "mini" | "lobby">("profile")
  const [slot, setSlot] = useState<Slot>({ kind: "frame" })

  // Lo que tiene: lo comprado o regalado, más el premio VIP mientras sea VIP.
  const mine = useMemo(
    () =>
      shop.catalog.filter(
        (c) => shop.owned.includes(c.id) || (c.vip_reward && shop.vip)
      ),
    [shop.catalog, shop.owned, shop.vip]
  )
  const ofKind = mine.filter((c) => c.kind === slot.kind)
  const frozen = mine.filter(
    (c) => c.vip_only && !c.vip_reward && !shop.vip
  ).length
  const value = mine.reduce((s, c) => s + (c.base_price ?? 0), 0)
  const complete = shop.bundles.filter((b) => !b.missing.length).length
  const started = shop.bundles
    .filter((b) => b.missing.length && b.missing.length < b.items.length)
    .sort(
      (a, b) =>
        a.missing.length / a.items.length - b.missing.length / b.items.length
    )
    .slice(0, 6)

  const current = (s: Slot) =>
    s.kind === "sticker"
      ? (shop.visible.stickers[s.index ?? 0] ?? null)
      : shop.visible[s.kind]

  function put(c: CatalogItem) {
    if (slot.kind === "sticker") {
      // Reemplaza el sticker de la ranura elegida y deja los otros en su lugar.
      const s = [...shop.visible.stickers.filter((x) => x !== c.id)]
      s.splice(slot.index ?? 0, s[slot.index ?? 0] ? 1 : 0, c.id)
      for (const x of shop.visible.stickers) shop.equip(x, false)
      for (const x of s.slice(0, 3)) shop.equip(x, true)
    } else {
      const err = shop.equip(c.id, true)
      if (err) return void toast.error(err)
    }
    toast.success(`Te pusiste «${c.name}».`)
  }
  function clear(s: Slot) {
    const id = current(s)
    if (!id) return
    shop.equip(id, false)
    toast.success(`Te sacaste «${shop.byId[id]?.name ?? id}».`)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Artículos"
          value={`${mine.length}/${shop.catalog.length}`}
        />
        <StatTile
          label="Colecciones completas"
          value={`${complete}/${shop.bundles.length}`}
        />
        <StatTile label="Valor del inventario" value={`${num(value)} pts`} />
        <StatTile
          label="VIP congelados"
          value={frozen}
          valueClassName={frozen ? "text-muted-foreground" : undefined}
        >
          <span className="text-[11px] text-muted-foreground">
            {frozen ? "Vuelven al ser VIP otra vez" : "Nada congelado"}
          </span>
        </StatTile>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Cómo te ven y las ranuras */}
        <Card
          variant="outline"
          className="flex flex-col gap-4 bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/.04)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Lo que tenés puesto</h2>
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
          <Preview view={view} prev={shop.visible} shop={shop} alias={alias} />
          <ul
            className="grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-4 xl:grid-cols-7"
            aria-label="Ranuras"
          >
            {SLOTS.map(({ slot: s, label, icon: Icon }) => {
              const id = current(s)
              const it = id ? shop.byId[id] : null
              const on = same(s, slot)
              return (
                <li key={label} className="relative">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSlot(s)}
                    className={cn(
                      "flex w-full flex-col overflow-hidden rounded-lg border text-left transition-colors hover:border-primary/60",
                      on && "border-primary ring-1 ring-primary"
                    )}
                  >
                    {it ? (
                      <Thumb i={it} alias={alias} small className="h-16" />
                    ) : (
                      <span className="grid h-16 place-items-center bg-muted/40 text-muted-foreground">
                        <PlusIcon className="size-4" />
                      </span>
                    )}
                    <span className="flex items-center gap-1 truncate px-1.5 py-1 text-[11px] text-muted-foreground">
                      <Icon className="size-3 shrink-0" />
                      {label}
                    </span>
                  </button>
                  {it && (
                    <button
                      type="button"
                      aria-label={`Sacar ${it.name}`}
                      onClick={() => clear(s)}
                      className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-background/90 text-muted-foreground hover:text-foreground"
                    >
                      <XIcon className="size-3" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>

        {/* Lo que tiene para la ranura elegida */}
        <Card
          variant="outline"
          className="flex min-h-[320px] flex-col bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]"
        >
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <h2 className="text-sm font-semibold">
              Tus {KINDS[slot.kind].toLowerCase()}{" "}
              <span className="font-mono text-xs font-normal text-muted-foreground">
                {ofKind.length}
              </span>
            </h2>
            <Button size="sm" variant="ghost" onClick={goShop}>
              Conseguir más
            </Button>
          </div>
          {ofKind.length === 0 ? (
            <EmptyState
              icon={PackageOpenIcon}
              title={`Todavía no tenés ${KINDS[slot.kind].toLowerCase()}`}
            >
              Pasá por la tienda: con lo que ganás jugando ya te alcanza para el
              primero.
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 p-4">
              {ofKind.map((c) => {
                const usable = shop.canUse(c)
                const on =
                  slot.kind === "sticker"
                    ? shop.visible.stickers.includes(c.id)
                    : current(slot) === c.id
                const r = RARITY[rarityOf(c)]
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={!usable}
                      onClick={() => put(c)}
                      onDoubleClick={() => open({ type: "item", id: c.id })}
                      className={cn(
                        "relative flex w-full flex-col overflow-hidden rounded-lg border text-left transition-colors hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50",
                        on && "border-primary ring-1 ring-primary"
                      )}
                    >
                      <Thumb i={c} alias={alias} />
                      <i className={cn("h-0.5", r.bar)} />
                      <span className="flex items-center justify-between gap-1 px-2 py-1.5">
                        <span className="truncate text-xs font-medium">
                          {c.name}
                        </span>
                        {!usable && (
                          <LockIcon className="size-3 shrink-0 text-muted-foreground" />
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {started.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">
            Colecciones a medio camino
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {started.map((b) => {
              const have = b.items.length - b.missing.length
              return (
                <li key={b.id}>
                  <Card
                    variant="outline"
                    asChild
                    className="flex w-full items-center gap-3 bg-card p-3 text-left shadow-[0_1px_2px_rgb(0_0_0/.04)] transition-colors hover:bg-muted"
                  >
                    <button
                      type="button"
                      onClick={() => open({ type: "bundle", id: b.id })}
                    >
                      <Thumb
                        i={b.items[0]!}
                        alias={alias}
                        small
                        className="w-14 shrink-0 rounded-md"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className="flex items-baseline justify-between gap-2">
                          <b className="truncate text-sm font-semibold">
                            {b.name}
                          </b>
                          <span className="font-mono text-xs text-muted-foreground tabular-nums">
                            {have}/{b.items.length}
                          </span>
                        </span>
                        <Progress value={(have / b.items.length) * 100} />
                        <span className="text-[11px] text-muted-foreground">
                          {collectionName(b.collection)}
                        </span>
                      </span>
                    </button>
                  </Card>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
