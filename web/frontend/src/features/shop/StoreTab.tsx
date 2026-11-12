import { cn } from "cn"
import {
  ClockIcon,
  FrameIcon,
  HeartIcon,
  ImageIcon,
  LayersIcon,
  PaletteIcon,
  SearchIcon,
  SparklesIcon,
  StickerIcon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Carousel } from "@/components/brand/Carousel"
import { EmptyState } from "@/components/brand/EmptyState"
import { FilterChips } from "@/components/brand/FilterChips"
import { Segmented } from "@/components/brand/Segmented"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { FramedAvatar, MiniCard, VipBadge } from "./cosmetics"
import type { ShopDemo } from "./demo"
import { nextMonday, rarityOf, timeLeft, type Rarity } from "./economy"
import type { Opened } from "./ItemSheet"
import { BundleCard, ItemCard } from "./ItemCard"
import { GOLD, priceOf, SectionTitle, Thumb } from "./parts"
import {
  COLLECTIONS,
  KINDS,
  type CatalogItem,
  type ItemKind,
  type ShopItem,
} from "./types"

const KIND_ICON: Record<ItemKind, LucideIcon> = {
  frame: FrameIcon,
  background: ImageIcon,
  theme: PaletteIcon,
  name: TypeIcon,
  sticker: StickerIcon,
}
type Show = "all" | "buy" | "mine" | "wish" | "vip" | "free"
type Sort = "sort" | "cheap" | "exp" | "rarity" | "name"
const RARITY_ORDER: Rarity[] = ["vip", "legendaria", "epica", "rara", "comun"]

export function StoreTab({
  shop,
  alias,
  open,
}: {
  shop: ShopDemo
  alias: string
  open: (o: Opened) => void
}) {
  const [kind, setKind] = useState<ItemKind>("frame")
  const [col, setCol] = useState<string | undefined>(undefined)
  const [q, setQ] = useState("")
  const [show, setShow] = useState<Show>("all")
  const [sort, setSort] = useState<Sort>("sort")

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase()
    const l = shop.catalog.filter((c) => {
      if (c.kind !== kind || (col && c.collection !== col)) return false
      if (
        qq &&
        !`${c.name} ${c.description ?? ""} ${COLLECTIONS[c.collection] ?? ""}`
          .toLowerCase()
          .includes(qq)
      )
        return false
      if (show === "buy") {
        const p = priceOf(c, shop)
        return (
          !c.vip_reward &&
          (!c.vip_only || shop.vip) &&
          !shop.owned.includes(c.id) &&
          p.price != null &&
          p.balance >= p.price
        )
      }
      if (show === "mine") return shop.canUse(c) || shop.owned.includes(c.id)
      if (show === "wish") return shop.wish.includes(c.id)
      if (show === "vip") return c.vip_only
      if (show === "free") return !c.vip_only
      return true
    })
    const cost = (c: CatalogItem) => priceOf(c, shop).price
    if (sort === "cheap") l.sort((a, b) => (cost(a) ?? 1e9) - (cost(b) ?? 1e9))
    if (sort === "exp") l.sort((a, b) => (cost(b) ?? 0) - (cost(a) ?? 0))
    if (sort === "rarity")
      l.sort(
        (a, b) =>
          RARITY_ORDER.indexOf(rarityOf(a)) - RARITY_ORDER.indexOf(rarityOf(b))
      )
    if (sort === "name") l.sort((a, b) => a.name.localeCompare(b.name, "es"))
    return l
  }, [shop, kind, col, q, show, sort])

  const weekly = shop.catalog.filter((c) => c.weekly)
  const wished = shop.wish
    .map((id) => shop.catalogById[id])
    .filter((c): c is CatalogItem => !!c)
  const ends = nextMonday()

  function equip(c: ShopItem, on: boolean) {
    const err = shop.equip(c.id, on)
    if (err) toast.error(err)
    else
      toast.success(on ? `Te pusiste «${c.name}».` : `Te sacaste «${c.name}».`)
  }
  const card = (c: CatalogItem) => (
    <ItemCard
      key={c.id}
      c={c}
      shop={shop}
      alias={alias}
      onOpen={() => open({ type: "item", id: c.id })}
      onBuy={() => open({ type: "item", id: c.id })}
      onEquip={(on) => equip(c, on)}
    />
  )
  const goKind = (k: ItemKind) => {
    setKind(k)
    setCol(undefined)
    document
      .getElementById("catalogo")
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="flex flex-col gap-7">
      <Hero shop={shop} alias={alias} open={open} goKind={goKind} />

      {weekly.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle
            icon={<SparklesIcon aria-hidden className="size-4 text-primary" />}
            title={`Ofertas de la semana · −${shop.config.weekly_discount}%`}
            aside={<Countdown to={ends} />}
          />
          <Grid>{weekly.map(card)}</Grid>
        </section>
      )}

      {shop.weeklyBundles.length > 0 && (
        <Carousel
          label="Packs de la semana"
          as="ul"
          title={
            <SectionTitle
              icon={<LayersIcon aria-hidden className="size-4 text-primary" />}
              title={`Packs · −${shop.config.bundle_discount}% sobre lo que te falta`}
            />
          }
        >
          {shop.weeklyBundles.map((b) => (
            <li key={b.id}>
              <BundleCard
                b={b}
                shop={shop}
                alias={alias}
                onOpen={() => open({ type: "bundle", id: b.id })}
              />
            </li>
          ))}
        </Carousel>
      )}

      {wished.length > 0 && (
        <Carousel
          label="Tu lista de deseos"
          as="ul"
          title={
            <SectionTitle
              icon={<HeartIcon aria-hidden className="size-4 text-rose-500" />}
              title="Tu lista de deseos"
            />
          }
        >
          {wished.map((c) => (
            <li key={c.id} className="w-[220px]">
              {card(c)}
            </li>
          ))}
        </Carousel>
      )}

      <Card
        variant="outline"
        id="catalogo"
        className="scroll-mt-16 overflow-hidden bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]"
      >
        <div className="flex flex-col gap-3 border-b p-3">
          <Segmented
            label="Tipo de artículo"
            value={kind}
            onChange={(k) => {
              setKind(k)
              setCol(undefined)
            }}
            options={(Object.keys(KINDS) as ItemKind[]).map((k) => ({
              value: k,
              icon: KIND_ICON[k],
              label: (
                <>
                  {KINDS[k]}
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {shop.catalog.filter((c) => c.kind === k).length}
                  </span>
                </>
              ),
              ariaLabel: KINDS[k],
            }))}
            className="self-start"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar artículo..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Buscar artículo"
              />
            </div>
            <Select value={show} onValueChange={(v) => setShow(v as Show)}>
              <SelectTrigger className="w-[170px]" aria-label="Mostrar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo</SelectItem>
                <SelectItem value="buy">Me alcanza</SelectItem>
                <SelectItem value="mine">Lo que tengo</SelectItem>
                <SelectItem value="wish">Lista de deseos</SelectItem>
                <SelectItem value="vip">Solo VIP</SelectItem>
                <SelectItem value="free">Para todos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="w-[150px]" aria-label="Ordenar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sort">Destacados</SelectItem>
                <SelectItem value="rarity">Rareza</SelectItem>
                <SelectItem value="cheap">Más baratos</SelectItem>
                <SelectItem value="exp">Más caros</SelectItem>
                <SelectItem value="name">Nombre</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-muted-foreground">
              {list.length} artículos
            </span>
          </div>
          <FilterChips
            label="Colección"
            size="sm"
            value={col}
            onChange={setCol}
            options={[
              { value: undefined, label: "Todas" },
              ...Object.keys(COLLECTIONS)
                .filter((k) =>
                  shop.catalog.some(
                    (c) => c.kind === kind && c.collection === k
                  )
                )
                .map((k) => ({ value: k, label: COLLECTIONS[k]! })),
            ]}
          />
        </div>
        <div className="p-3 sm:p-4">
          {list.length === 0 ? (
            <EmptyState
              icon={show === "wish" ? HeartIcon : SearchIcon}
              title={emptyTitle(show)}
            >
              {show === "buy"
                ? "Jugá unos mixes o completá misiones para sumar puntos."
                : show === "wish"
                  ? "Tocá el corazón de un artículo para guardarlo acá."
                  : "Probá con otra colección o sacá la búsqueda."}
            </EmptyState>
          ) : (
            <Grid>{list.map(card)}</Grid>
          )}
        </div>
      </Card>
    </div>
  )
}

function emptyTitle(show: Show) {
  if (show === "buy") return "Todavía no te alcanza para nada de acá"
  if (show === "wish") return "Tu lista de deseos está vacía"
  if (show === "mine") return "No tenés nada de este tipo"
  return "Nada coincide con el filtro"
}

export function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      {children}
    </div>
  )
}

function Countdown({ to }: { to: Date }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground tabular-nums">
      <ClockIcon className="size-3.5" /> Terminan en {timeLeft(to)}
    </span>
  )
}

// ---------- Portada ----------
// Tres destacados que rotan solos (salvo con movimiento reducido): lo nuevo, el pack de la semana y el VIP.

function Hero({
  shop,
  alias,
  open,
  goKind,
}: {
  shop: ShopDemo
  alias: string
  open: (o: Opened) => void
  goKind: (k: ItemKind) => void
}) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const pack = shop.weeklyBundles[0]
  const gold = shop.byId["marco-vip-oro"]
  const showcase = shop.byId["fondo-serie-luna-roja"] ?? shop.byId["fondo-neon"]
  const slides = [
    {
      key: "fondos",
      eyebrow: "Nuevo",
      title: "Fondos de miniperfil",
      text: "24 fondos animados para tu tarjeta del lobby: humo, radar, neón, mapas y 12 exclusivos VIP.",
      cta: "Ver fondos",
      onClick: () => goKind("background"),
      art: (
        <MiniCard
          className="w-[320px] max-w-full shadow-2xl"
          alias={alias}
          level={shop.level}
          frame={shop.visible.frame ? shop.byId[shop.visible.frame] : null}
          name={shop.visible.name ? shop.byId[shop.visible.name] : null}
          background={showcase}
        />
      ),
      tint: "from-violet-500/25",
    },
    ...(pack
      ? [
          {
            key: "pack",
            eyebrow: "Pack de la semana",
            title: `Pack ${pack.name}`,
            text: `${pack.items.length} artículos de ${COLLECTIONS[pack.collection] ?? pack.collection} con −${shop.config.bundle_discount}% sobre lo que te falta.`,
            cta: "Ver pack",
            onClick: () => open({ type: "bundle", id: pack.id }),
            art: (
              <div className="grid w-[260px] grid-cols-2 gap-1.5">
                {pack.items.slice(0, 4).map((x) => (
                  <Thumb
                    key={x.id}
                    i={x}
                    alias={alias}
                    className="rounded-lg border bg-card/80"
                  />
                ))}
              </div>
            ),
            tint: "from-primary/25",
          },
        ]
      : []),
    ...(gold
      ? [
          {
            key: "vip",
            eyebrow: "VIP",
            title: "Marco Oro VIP",
            text: "Viene con el VIP. Además ganás monedas VIP en cada partida para comprar las series, el arsenal y los fondos exclusivos.",
            cta: shop.vip ? "Ponérmelo" : "Ver el marco",
            onClick: () => open({ type: "item", id: gold.id }),
            art: <FramedAvatar alias={alias} frame={gold} size={170} />,
            tint: "from-[#e8b53a]/25",
          },
        ]
      : []),
  ]
  const n = slides.length
  useEffect(() => {
    if (
      paused ||
      n < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return
    const t = setInterval(() => setI((x) => (x + 1) % n), 7000)
    return () => clearInterval(t)
  }, [paused, n])
  const s = slides[i % n]!
  return (
    <Card
      variant="outline"
      radius="hero"
      className="relative overflow-hidden bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carrusel"
      aria-label="Destacados"
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-r to-transparent transition-colors",
          s.tint
        )}
      />
      <div className="relative grid min-h-[230px] grid-cols-[minmax(0,1fr)] items-center gap-6 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:p-8">
        <div
          className="flex max-w-[52ch] flex-col items-start gap-2.5"
          aria-live="polite"
        >
          <span
            className={cn(
              "font-mono text-xs font-semibold tracking-[1px] uppercase",
              s.key === "vip" ? GOLD : "text-primary"
            )}
          >
            {s.key === "vip" && (
              <VipBadge className="mr-1.5 h-4 align-[-3px]" />
            )}
            {s.eyebrow}
          </span>
          <h2 className="text-[clamp(24px,3vw,34px)] leading-[1.1] font-bold tracking-[-1px] text-balance">
            {s.title}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">{s.text}</p>
          <Button className="mt-1" onClick={s.onClick}>
            {s.cta}
          </Button>
        </div>
        <div className="grid min-w-0 place-items-center max-md:pb-4">
          {s.art}
        </div>
      </div>
      {n > 1 && (
        <div className="absolute bottom-3 left-6 flex gap-1.5 md:left-8">
          {slides.map((x, k) => (
            <button
              key={x.key}
              type="button"
              aria-label={`Ver destacado ${k + 1}: ${x.title}`}
              aria-current={k === i % n}
              onClick={() => setI(k)}
              className={cn(
                "h-1.5 rounded-full bg-foreground/20 transition-all",
                k === i % n ? "w-6 bg-primary" : "w-1.5 hover:bg-foreground/40"
              )}
            />
          ))}
        </div>
      )}
    </Card>
  )
}
