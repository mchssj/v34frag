import { cn } from "cn"
import {
  BadgePercentIcon,
  CheckIcon,
  CoinsIcon,
  FrameIcon,
  HistoryIcon,
  ImageIcon,
  LockIcon,
  PaletteIcon,
  SearchIcon,
  SparklesIcon,
  StickerIcon,
  TypeIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { Eyebrow } from "@/components/brand/SectionHeading"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { FramedAvatar, MiniCard, NameFx, Stickers, VipBadge } from "./cosmetics"
import { nextMonday, type ShopDemo } from "./demo"
import {
  COLLECTIONS,
  COSMETICS_BASE,
  KINDS,
  type CatalogItem,
  type ItemKind,
  type ShopItem,
} from "./types"

// Mismo lenguaje que Ranking: título text-2xl, tarjetas bg-card con borde y sombra suave, selector
// segmentado sobre bg-muted y números en mono. El dorado queda solo para lo VIP.
const card = "rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]"
const gold = "text-[#e8b53a]"
const seg =
  "inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-[calc(var(--radius)-4px)] px-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
const segOn = "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/.1)]"

const KIND_ICON: Record<ItemKind, LucideIcon> = {
  frame: FrameIcon,
  sticker: StickerIcon,
  theme: PaletteIcon,
  name: TypeIcon,
  background: ImageIcon,
}

const num = (n: number) => n.toLocaleString("es")
const fmt = (n: number) => `${num(n)} pts`
const fmtVip = (n: number) => `${num(n)} monedas VIP`

// Lo que cuesta comprarlo hoy: lo normal en puntos, lo VIP en monedas VIP (shop_buy).
function priceOf(c: CatalogItem, shop: ShopDemo) {
  const vip = c.vip_only
  return {
    price: vip ? c.vip_price : c.price,
    balance: vip ? shop.points.vip_coins.balance : shop.points.balance,
    fmt: vip ? fmtVip : fmt,
    unit: vip ? "VIP" : "pts",
  }
}
type Show = "all" | "buy" | "mine" | "vip" | "free"
type Sort = "sort" | "cheap" | "exp" | "name"

export function ShopPage({ shop, alias }: { shop: ShopDemo; alias: string }) {
  const [kind, setKind] = useState<ItemKind>("frame")
  const [col, setCol] = useState("")
  const [q, setQ] = useState("")
  const [show, setShow] = useState<Show>("all")
  const [sort, setSort] = useState<Sort>("sort")
  const [trying, setTrying] = useState<string | null>(null)
  const [buying, setBuying] = useState<CatalogItem | null>(null)
  const [histOpen, setHistOpen] = useState(false)

  const perMix = Math.max(
    1,
    Math.round(shop.config.per_mix * (shop.vip ? shop.config.vip_multiplier : 1)),
  )

  // Vista previa: lo equipado, con lo que se está probando encima.
  const prev = useMemo(() => {
    const e = { ...shop.visible, stickers: [...shop.visible.stickers] }
    const t = trying ? shop.byId[trying] : null
    if (t) {
      if (t.kind === "sticker") {
        if (!e.stickers.includes(t.id)) e.stickers = [...e.stickers, t.id].slice(-3)
      } else e[t.kind] = t.id
    }
    return e
  }, [shop.visible, shop.byId, trying])

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase()
    const l = shop.catalog.filter((c) => {
      if (c.kind !== kind || (col && c.collection !== col)) return false
      if (qq && !`${c.name} ${c.description ?? ""} ${COLLECTIONS[c.collection] ?? ""}`.toLowerCase().includes(qq))
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
      if (show === "mine") return shop.canUse(c)
      if (show === "vip") return c.vip_only
      if (show === "free") return !c.vip_only
      return true
    })
    const cost = (c: CatalogItem) => priceOf(c, shop).price
    if (sort === "cheap") l.sort((a, b) => (cost(a) ?? 1e9) - (cost(b) ?? 1e9))
    if (sort === "exp") l.sort((a, b) => (cost(b) ?? 0) - (cost(a) ?? 0))
    if (sort === "name") l.sort((a, b) => a.name.localeCompare(b.name, "es"))
    return l
  }, [shop, kind, col, q, show, sort])

  const weekly = shop.catalog.filter((c) => c.weekly)
  const vipCount = shop.items.filter((i) => i.vip_only && !i.vip_reward).length
  const coins = shop.points.vip_coins

  function equip(i: ShopItem, on: boolean) {
    const err = shop.equip(i.id, on)
    if (err) toast.error(err)
    else toast.success(on ? `Te pusiste «${i.name}».` : `Te sacaste «${i.name}».`)
    setTrying(null)
  }
  function confirmBuy() {
    if (!buying) return
    const err = shop.buy(buying.id)
    if (err) toast.error(err)
    else {
      toast.success(`¡Compraste ${buying.name}!`, {
        action: { label: "Ponérmelo", onClick: () => shop.equip(buying.id, true) },
      })
      setTrying(null)
    }
    setBuying(null)
  }
  const tryOn = (id: string) => {
    setTrying((t) => (t === id ? null : id))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const cardProps = (c: CatalogItem) => ({
    c,
    shop,
    alias,
    perMix,
    trying: trying === c.id,
    onTry: () => tryOn(c.id),
    onBuy: () => setBuying(c),
    onEquip: (on: boolean) => equip(c, on),
  })

  if (shop.loading)
    return <p className="text-sm text-muted-foreground">Cargando la tienda...</p>

  const theme = prev.theme ? shop.byId[prev.theme] : null
  const tryingItem = trying ? shop.byId[trying] : null
  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado, como el de Ranking */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-[-0.4px]">Tienda</h1>
          <p className="max-w-[62ch] text-sm text-pretty text-muted-foreground">
            Cada mix que jugás te da puntos. Gastalos en marcos, stickers, temas, efectos para tu nombre
            y fondos de miniperfil. Probate lo que quieras antes de comprarlo.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setHistOpen(true)}>
          <HistoryIcon /> Historial
        </Button>
      </div>

      {/* Vista previa y saldos */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className={cn(card, "flex flex-col gap-4 p-5", theme?.css_class)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Eyebrow>Vista previa</Eyebrow>
            {tryingItem ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary/12 pr-1 pl-2.5 text-xs font-semibold text-primary">
                Probando: {tryingItem.name}
                <button
                  type="button"
                  aria-label="Dejar de probar"
                  className="grid size-5 place-items-center rounded hover:bg-primary/15"
                  onClick={() => setTrying(null)}
                >
                  <XIcon className="size-3.5" />
                </button>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Lo que tenés puesto</span>
            )}
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex min-w-0 items-center gap-4">
              <FramedAvatar
                alias={alias}
                frame={prev.frame ? shop.byId[prev.frame] : null}
                size={120}
              />
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex items-center gap-2 text-xl font-semibold tracking-[-0.3px] text-primary">
                  <NameFx
                    className="truncate"
                    text={alias}
                    effect={prev.name ? shop.byId[prev.name] : null}
                  />
                  {shop.vip && <VipBadge />}
                </div>
                <Stickers
                  size={40}
                  items={prev.stickers.map((s) => shop.byId[s]).filter(Boolean)}
                />
              </div>
            </div>
            <MiniCard
              className="ml-auto"
              alias={alias}
              level={7}
              frame={prev.frame ? shop.byId[prev.frame] : null}
              name={prev.name ? shop.byId[prev.name] : null}
              background={prev.background ? shop.byId[prev.background] : null}
              sub="Así te ven en el lobby"
            />
          </div>
        </div>

        <div className={cn(card, "flex flex-col divide-y")}>
          <Wallet
            label="Puntos"
            icon={<CoinsIcon className="size-3.5" />}
            value={num(shop.points.balance)}
            valueClass="text-primary"
            detail={
              <>
                {fmt(shop.points.earned)} en {shop.points.mixes} mixes
                {shop.points.granted ? ` · regalos ${fmt(shop.points.granted)}` : ""}
                {shop.points.spent ? ` · gastaste ${fmt(shop.points.spent)}` : ""}
              </>
            }
          />
          <Wallet
            label="Monedas VIP"
            icon={<VipBadge className="h-4" />}
            value={num(coins.balance)}
            valueClass={gold}
            dim={!shop.vip}
            tag={
              !shop.vip && (
                <span className="inline-flex items-center gap-1 rounded-[4px] bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-[.03em] text-muted-foreground uppercase">
                  <LockIcon className="size-3" /> Congeladas
                </span>
              )
            }
            detail={
              shop.vip ? (
                <>
                  {num(coins.earned)} en {coins.mixes} mixes siendo VIP
                  {coins.granted ? ` · regalos ${num(coins.granted)}` : ""}
                  {coins.spent ? ` · gastaste ${num(coins.spent)}` : ""}
                </>
              ) : (
                "Vuelven a funcionar cuando seas VIP otra vez."
              )
            }
          />
          <dl className="grid grid-cols-2 gap-3 p-5 text-xs">
            <div>
              <dt className="text-muted-foreground">Por mix</dt>
              <dd className="font-mono font-semibold tabular-nums">
                +{perMix} pts{shop.vip && <span className={gold}> · +{shop.config.vip_per_mix} VIP</span>}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Si ganás</dt>
              <dd className="font-mono font-semibold tabular-nums">
                +{shop.config.per_win} pts
                {shop.vip && <span className={gold}> · +{shop.config.vip_per_win} VIP</span>}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* VIP */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-sm",
          "border-[color-mix(in_oklch,#e8b53a_35%,var(--border))] bg-[linear-gradient(90deg,color-mix(in_oklch,#e8b53a_10%,var(--card)),var(--card)_70%)]",
        )}
      >
        <VipBadge className="h-7" />
        <b className={gold}>{shop.vip ? "Sos VIP" : "Hacete VIP"}</b>
        <span className="text-muted-foreground">
          {shop.vip
            ? `Tenés el Marco Oro VIP y ganás monedas VIP en cada mix para comprar los ${vipCount} artículos VIP.`
            : `El Marco Oro VIP al instante y monedas VIP en cada mix para comprar ${vipCount} artículos animados: Series míticas, Arsenal, fondos y más.`}
        </span>
      </div>

      {/* Ofertas de la semana */}
      {weekly.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <SparklesIcon aria-hidden className="size-4 text-primary" /> Ofertas de la semana
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              −{shop.config.weekly_discount}% · hasta el{" "}
              {nextMonday().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>
          <Grid>
            {weekly.map((c) => (
              <ItemCard key={c.id} {...cardProps(c)} />
            ))}
          </Grid>
        </section>
      )}

      {/* Catálogo */}
      <section className={cn(card, "overflow-hidden")}>
        <div className="flex flex-col gap-3 border-b p-3">
          <nav
            aria-label="Tipo de artículo"
            className="flex gap-0.5 self-start overflow-x-auto rounded-lg bg-muted p-[3px]"
          >
            {(Object.keys(KINDS) as ItemKind[]).map((k) => {
              const Icon = KIND_ICON[k]
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  className={cn(seg, kind === k && segOn)}
                  onClick={() => {
                    setKind(k)
                    setCol("")
                  }}
                >
                  <Icon aria-hidden className="size-3.5" />
                  {KINDS[k]}
                  <span className="font-mono text-[11px] font-medium text-muted-foreground tabular-nums">
                    {shop.catalog.filter((c) => c.kind === k).length}
                  </span>
                </button>
              )
            })}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-8"
                placeholder="Buscar artículo..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Buscar artículo"
              />
            </div>
            <Select value={show} onValueChange={(v) => setShow(v as Show)}>
              <SelectTrigger className="w-[160px]" aria-label="Mostrar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo</SelectItem>
                <SelectItem value="buy">Puedo comprar</SelectItem>
                <SelectItem value="mine">Lo mío</SelectItem>
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
                <SelectItem value="cheap">Más baratos</SelectItem>
                <SelectItem value="exp">Más caros</SelectItem>
                <SelectItem value="name">Nombre</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-muted-foreground">{list.length} artículos</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {["", ...Object.keys(COLLECTIONS)].map((k) => {
              const n = shop.catalog.filter((c) => c.kind === kind && (!k || c.collection === k)).length
              if (k && !n) return null
              return (
                <Button
                  key={k || "all"}
                  size="xs"
                  variant={col === k ? "secondary" : "ghost"}
                  aria-pressed={col === k}
                  onClick={() => setCol(k)}
                >
                  {k ? COLLECTIONS[k] : "Todas"}
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{n}</span>
                </Button>
              )
            })}
          </div>
        </div>
        <div className="p-3 sm:p-4">
          {list.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              {show === "buy"
                ? "Con tu saldo todavía no te alcanza para nada de acá: ¡jugá unos mixes!"
                : "Nada coincide con el filtro."}
            </p>
          ) : (
            <Grid>
              {list.map((c) => (
                <ItemCard key={c.id} {...cardProps(c)} />
              ))}
            </Grid>
          )}
        </div>
      </section>

      <Dialog open={!!buying} onOpenChange={(o) => !o && setBuying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Comprar «{buying?.name}»?</DialogTitle>
            <DialogDescription>
              {buying &&
                (() => {
                  const p = priceOf(buying, shop)
                  if (p.price == null) return null
                  return (
                    <>
                      Cuesta {p.fmt(p.price)}
                      {buying.weekly && !buying.vip_only ? " (oferta de la semana)" : ""}. Te quedan{" "}
                      {p.fmt(p.balance - p.price)}.
                    </>
                  )
                })()}
            </DialogDescription>
          </DialogHeader>
          {buying && (
            <div className="overflow-hidden rounded-lg border">
              <Vis i={buying} shop={shop} alias={alias} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuying(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmBuy}>Comprar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={histOpen} onOpenChange={setHistOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historial</DialogTitle>
            <DialogDescription>
              Mixes, regalos y compras, lo más nuevo primero. Las monedas VIP van en dorado.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[50vh] divide-y overflow-y-auto text-sm">
            {shop.history.map((h, k) => (
              <li key={k} className="flex items-center gap-3 py-2">
                <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                  {new Date(h.at).toLocaleDateString("es", { day: "2-digit", month: "short" })}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted-foreground">
                    {h.kind === "mix" ? "Mix · " : h.kind === "grant" ? "Regalo · " : "Compra · "}
                  </span>
                  {h.label}
                </span>
                <b
                  className={cn(
                    "font-mono tabular-nums",
                    h.currency === "vip" ? gold : h.points >= 0 ? "text-emerald-500" : "text-destructive",
                  )}
                >
                  {h.points > 0 ? "+" : ""}
                  {h.points} {h.currency === "vip" ? "VIP" : "pts"}
                </b>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Wallet({
  label,
  icon,
  value,
  valueClass,
  detail,
  tag,
  dim,
}: {
  label: string
  icon: ReactNode
  value: string
  valueClass: string
  detail: ReactNode
  tag?: ReactNode
  dim?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon}
          {label}
        </span>
        {tag}
      </div>
      <span
        className={cn(
          "font-mono text-[32px] leading-none font-bold tracking-[-1px] tabular-nums",
          valueClass,
          dim && "opacity-50",
        )}
      >
        {value}
      </span>
      <span className="text-xs text-pretty text-muted-foreground">{detail}</span>
    </div>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">{children}</div>
  )
}

function Vis({ i, shop, alias }: { i: ShopItem; shop: ShopDemo; alias: string }) {
  return (
    <div className="grid h-[150px] place-items-center bg-[radial-gradient(120%_90%_at_50%_0%,color-mix(in_oklch,var(--foreground)_7%,transparent),transparent_70%)] bg-muted/40">
      {i.kind === "frame" && <FramedAvatar alias={alias} frame={i} size={120} />}
      {i.kind === "sticker" && (
        <img src={COSMETICS_BASE + (i.file ?? "")} alt="" loading="lazy" className="size-24" />
      )}
      {i.kind === "theme" && (
        <div className={cn("w-4/5 rounded-lg border bg-card p-3", i.css_class)}>
          <b className="text-sm text-primary">Perfil</b>
          <small className="block text-xs text-muted-foreground">Así se ve el color</small>
          <i className="mt-2 block h-1.5 rounded bg-primary" />
        </div>
      )}
      {i.kind === "name" && (
        <NameFx text={alias} effect={i} className="text-2xl font-bold text-primary" />
      )}
      {i.kind === "background" && (
        <MiniCard
          className="h-full max-w-none rounded-none border-0"
          avatar={72}
          alias={alias}
          level={7}
          frame={shop.visible.frame ? shop.byId[shop.visible.frame] : null}
          name={shop.visible.name ? shop.byId[shop.visible.name] : null}
          background={i}
        />
      )}
    </div>
  )
}

function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] items-center gap-1 rounded-[4px] px-1.5 text-[10px] font-bold tracking-[.03em] uppercase",
        className,
      )}
    >
      {children}
    </span>
  )
}

function ItemCard({
  c,
  shop,
  alias,
  perMix,
  trying,
  onTry,
  onBuy,
  onEquip,
}: {
  c: CatalogItem
  shop: ShopDemo
  alias: string
  perMix: number
  trying: boolean
  onTry: () => void
  onBuy: () => void
  onEquip: (on: boolean) => void
}) {
  const owned = shop.owned.includes(c.id)
  const usable = shop.canUse(c)
  const eq =
    c.kind === "sticker" ? shop.visible.stickers.includes(c.id) : shop.visible[c.kind] === c.id
  const p = priceOf(c, shop)
  const short = p.price != null && p.balance < p.price
  const vipLocked = c.vip_only && !shop.vip
  const onSale = !c.vip_only && c.weekly && c.base_price !== c.price
  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)] transition-colors",
        "hover:border-[color-mix(in_oklch,var(--primary)_45%,var(--border))]",
        c.vip_only && "border-[color-mix(in_oklch,#e8b53a_30%,var(--border))]",
        (eq || trying) && "border-primary ring-1 ring-primary",
      )}
    >
      <button
        type="button"
        onClick={onTry}
        aria-label={trying ? `Dejar de probar ${c.name}` : `Probar ${c.name}`}
        className="relative block w-full text-left"
      >
        <Vis i={c} shop={shop} alias={alias} />
        <span className="absolute top-2 left-2 flex gap-1">
          {onSale && (
            <Chip className="bg-primary text-primary-foreground">
              <BadgePercentIcon className="size-3" />−{shop.config.weekly_discount}%
            </Chip>
          )}
          {eq && (
            <Chip className="bg-background/90 text-foreground">
              <CheckIcon className="size-3" />
              Puesto
            </Chip>
          )}
        </span>
        {c.vip_only && <VipBadge className="absolute top-2 right-2 h-6" />}
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold">{c.name}</h3>
          {c.animated && (
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground uppercase">Animado</span>
          )}
        </div>
        <p className="line-clamp-2 min-h-8 text-xs text-muted-foreground">{c.description}</p>
        <span className="text-[11px] text-muted-foreground/80">{COLLECTIONS[c.collection] ?? c.collection}</span>
        <div className="mt-auto flex flex-col gap-2 border-t pt-2.5">
          <div className="min-h-9">
            {c.vip_reward ? (
              <span className={cn("text-xs font-semibold", gold)}>
                {usable ? "Incluido con tu VIP" : "Viene con el VIP"}
              </span>
            ) : owned ? (
              <span className="flex flex-col text-xs font-semibold text-emerald-500">
                <span className="inline-flex items-center gap-1">
                  <CheckIcon className="size-3.5" /> En tu inventario
                </span>
                {vipLocked && (
                  <span className="font-normal text-muted-foreground">Congelado: se usa siendo VIP</span>
                )}
              </span>
            ) : p.price == null ? (
              <span className="text-xs text-muted-foreground">No está a la venta</span>
            ) : (
              <span className="flex flex-col">
                <span className="flex items-baseline gap-1.5">
                  {onSale && (
                    <s className="font-mono text-xs text-muted-foreground tabular-nums">{num(c.base_price!)}</s>
                  )}
                  <b
                    className={cn(
                      "font-mono text-base tabular-nums",
                      c.vip_only ? gold : "text-primary",
                    )}
                  >
                    {num(p.price)}
                  </b>
                  <span className="text-[11px] text-muted-foreground">{p.unit}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {vipLocked
                    ? "Se compra siendo VIP"
                    : short
                      ? `Te faltan ${num(p.price - p.balance)} · ≈ ${Math.ceil(
                          (p.price - p.balance) /
                            (c.vip_only ? Math.max(1, shop.config.vip_per_mix) : perMix),
                        )} mixes`
                      : ""}
                </span>
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            {usable ? (
              <Button
                size="sm"
                className="flex-1"
                variant={eq ? "outline" : "default"}
                onClick={() => onEquip(!eq)}
              >
                {eq ? "Sacar" : "Equipar"}
              </Button>
            ) : (
              !owned &&
              !c.vip_reward &&
              p.price != null && (
                <Button size="sm" className="flex-1" disabled={short || vipLocked} onClick={onBuy}>
                  {vipLocked && <LockIcon />}
                  Comprar
                </Button>
              )
            )}
            <Button size="sm" variant={trying ? "secondary" : "ghost"} onClick={onTry}>
              {trying ? "Probando" : "Probar"}
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}
