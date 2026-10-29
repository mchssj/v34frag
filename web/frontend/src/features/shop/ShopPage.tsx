import { cn } from "cn"
import { CrownIcon, HistoryIcon, SearchIcon, SparklesIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

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

import { FramedAvatar, NameFx, Stickers, VipBadge } from "./cosmetics"
import { nextMonday, type ShopDemo } from "./demo"
import {
  COLLECTIONS,
  COSMETICS_BASE,
  KINDS,
  type CatalogItem,
  type ItemKind,
  type ShopItem,
} from "./types"

const fmt = (n: number) => `${n.toLocaleString("es")} pts`
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
      if (show === "buy")
        return !c.vip_only && !shop.owned.includes(c.id) && c.price != null && shop.points.balance >= c.price
      if (show === "mine") return shop.canUse(c)
      if (show === "vip") return c.vip_only
      if (show === "free") return !c.vip_only
      return true
    })
    if (sort === "cheap") l.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9))
    if (sort === "exp") l.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    if (sort === "name") l.sort((a, b) => a.name.localeCompare(b.name, "es"))
    return l
  }, [shop, kind, col, q, show, sort])

  const weekly = shop.catalog.filter((c) => c.weekly)
  const vipCount = shop.items.filter((i) => i.vip_only).length

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

  if (shop.loading)
    return <p className="text-sm text-muted-foreground">Cargando la tienda...</p>

  const theme = prev.theme ? shop.byId[prev.theme] : null
  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera: vista previa y saldo */}
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="grid md:grid-cols-[1.4fr_1fr]">
          <div
            className={cn(
              "flex items-center gap-5 border-b bg-muted/40 p-5 md:border-r md:border-b-0",
              theme?.css_class,
            )}
          >
            <FramedAvatar
              alias={alias}
              frame={prev.frame ? shop.byId[prev.frame] : null}
              size={136}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-2xl font-black text-primary">
                <NameFx text={alias} effect={prev.name ? shop.byId[prev.name] : null} />
                {shop.vip && <VipBadge />}
              </div>
              <p className="text-xs text-muted-foreground">
                {trying
                  ? `Probando: ${shop.byId[trying]?.name} · tocalo de nuevo para sacarlo`
                  : "Así te ves con lo que tenés puesto"}
              </p>
              <Stickers
                className="mt-2"
                size={48}
                items={prev.stickers.map((s) => shop.byId[s]).filter(Boolean)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 p-5">
            <div className="text-3xl font-black text-primary">{fmt(shop.points.balance)}</div>
            <p className="text-xs text-muted-foreground">
              Ganaste {fmt(shop.points.earned)} en {shop.points.mixes} mixes
              {shop.points.granted ? ` · regalos ${fmt(shop.points.granted)}` : ""} ·
              gastaste {fmt(shop.points.spent)}
            </p>
            <p className="text-xs text-muted-foreground">
              Ganás {shop.config.per_mix} puntos por cada mix terminado y {shop.config.per_win} más
              si ganás. Los VIP ganan ×{String(shop.config.vip_multiplier).replace(".", ",")}.
            </p>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setHistOpen(true)}>
                <HistoryIcon /> Historial
              </Button>
            </div>
          </div>
        </div>
        <div
          className={cn(
            "flex flex-wrap items-center gap-3 border-t px-5 py-3 text-sm",
            "bg-gradient-to-r from-[#f7d76a]/15 to-transparent",
          )}
        >
          <CrownIcon className="size-4 text-[#e8b53a]" />
          {shop.vip ? (
            <>
              <b className="text-[#e8b53a]">Sos VIP</b>
              <span className="text-muted-foreground">
                Tenés los {vipCount} artículos VIP sin gastar puntos y ganás ×
                {String(shop.config.vip_multiplier).replace(".", ",")} puntos por mix.
              </span>
            </>
          ) : (
            <>
              <b className="text-[#e8b53a]">Hacete VIP</b>
              <span className="text-muted-foreground">
                {vipCount} artículos animados (Series míticas, Arsenal y más) sin gastar puntos, ×
                {String(shop.config.vip_multiplier).replace(".", ",")} puntos por mix y clips extra.
              </span>
            </>
          )}
        </div>
      </section>

      {/* Ofertas de la semana */}
      {weekly.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <SparklesIcon className="size-4 text-primary" /> Ofertas de la semana · −
            {shop.config.weekly_discount}% hasta el{" "}
            {nextMonday().toLocaleDateString("es", { day: "numeric", month: "long" })}
          </h2>
          <Grid>
            {weekly.map((c) => (
              <ItemCard
                key={c.id}
                c={c}
                shop={shop}
                alias={alias}
                perMix={perMix}
                trying={trying === c.id}
                onTry={() => tryOn(c.id)}
                onBuy={() => setBuying(c)}
                onEquip={(on) => equip(c, on)}
              />
            ))}
          </Grid>
        </section>
      )}

      {/* Catálogo */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(KINDS) as ItemKind[]).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={kind === k ? "default" : "outline"}
              onClick={() => {
                setKind(k)
                setCol("")
              }}
            >
              {KINDS[k]} ({shop.catalog.filter((c) => c.kind === k).length})
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["", ...Object.keys(COLLECTIONS)].map((k) => {
            const n = shop.catalog.filter((c) => c.kind === kind && (!k || c.collection === k)).length
            if (k && !n) return null
            return (
              <Button
                key={k || "all"}
                size="xs"
                variant={col === k ? "secondary" : "ghost"}
                onClick={() => setCol(k)}
              >
                {k ? COLLECTIONS[k] : "Todas"} · {n}
              </Button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2">
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
        </div>
        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {show === "buy"
              ? "Con tu saldo todavía no te alcanza para nada de acá: ¡jugá unos mixes!"
              : "Nada coincide con el filtro."}
          </p>
        ) : (
          <Grid>
            {list.map((c) => (
              <ItemCard
                key={c.id}
                c={c}
                shop={shop}
                alias={alias}
                perMix={perMix}
                trying={trying === c.id}
                onTry={() => tryOn(c.id)}
                onBuy={() => setBuying(c)}
                onEquip={(on) => equip(c, on)}
              />
            ))}
          </Grid>
        )}
      </section>

      <Dialog open={!!buying} onOpenChange={(o) => !o && setBuying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Comprar «{buying?.name}»?</DialogTitle>
            <DialogDescription>
              Cuesta {buying?.price != null && fmt(buying.price)}
              {buying?.weekly ? " (oferta de la semana)" : ""}. Te quedan{" "}
              {buying?.price != null && fmt(shop.points.balance - buying.price)}.
            </DialogDescription>
          </DialogHeader>
          {buying && <Vis i={buying} shop={shop} alias={alias} />}
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
            <DialogTitle>Historial de puntos</DialogTitle>
            <DialogDescription>Mixes, regalos y compras, lo más nuevo primero.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-[50vh] divide-y overflow-y-auto text-sm">
            {shop.history.map((h, k) => (
              <li key={k} className="flex items-center gap-3 py-2">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">
                  {new Date(h.at).toLocaleDateString("es", { day: "numeric", month: "short" })}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {h.kind === "mix" ? "Mix: " : h.kind === "grant" ? "Regalo: " : "Compra: "}
                  {h.label}
                  {h.vip ? " (×VIP)" : ""}
                </span>
                <b className={h.points >= 0 ? "text-emerald-500" : "text-destructive"}>
                  {h.points > 0 ? "+" : ""}
                  {h.points}
                </b>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">{children}</div>
  )
}

function Vis({ i, shop, alias }: { i: ShopItem; shop: ShopDemo; alias: string }) {
  return (
    <div className="grid h-[150px] place-items-center bg-muted/40">
      {i.kind === "frame" && <FramedAvatar alias={alias} frame={i} size={120} />}
      {i.kind === "sticker" && (
        <img src={COSMETICS_BASE + (i.file ?? "")} alt="" loading="lazy" className="size-24" />
      )}
      {i.kind === "theme" && (
        <div className={cn("w-4/5 rounded-lg border bg-card p-3", i.css_class)}>
          <b className="text-primary">Perfil</b>
          <small className="block text-muted-foreground">Así se ve el color</small>
          <i className="mt-2 block h-2 rounded bg-primary" />
        </div>
      )}
      {i.kind === "name" && (
        <NameFx text={alias} effect={i} className="text-2xl font-black text-primary" />
      )}
      {shop.loading && null}
    </div>
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
  const short = c.price != null && shop.points.balance < c.price
  return (
    <div
      onClick={onTry}
      className={cn(
        "flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card transition hover:-translate-y-0.5 hover:border-primary",
        eq && "border-primary ring-2 ring-primary",
        c.vip_only && !usable && "opacity-60",
      )}
    >
      <Vis i={c} shop={shop} alias={alias} />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex flex-wrap items-center gap-1">
          <b className="text-sm">{c.name}</b>
          {c.vip_only && <VipBadge />}
          {c.animated && (
            <span className="rounded bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
              Animado
            </span>
          )}
        </div>
        <p className="min-h-8 text-xs text-muted-foreground">{c.description}</p>
        <span className="self-start rounded bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
          {COLLECTIONS[c.collection] ?? c.collection}
        </span>
        <div className="mt-auto flex flex-col gap-2 pt-2">
          {c.vip_only ? (
            <span className="text-sm font-bold text-[#e8b53a]">
              {usable ? "Incluido con tu VIP" : "Solo VIP"}
            </span>
          ) : owned ? (
            <span className="text-sm font-bold text-emerald-500">✓ Lo tenés</span>
          ) : c.price == null ? (
            <span className="text-sm text-muted-foreground">No está a la venta</span>
          ) : (
            <span className="text-sm">
              {c.weekly && c.base_price !== c.price && (
                <s className="mr-1 text-muted-foreground">{fmt(c.base_price!)}</s>
              )}
              <b className="text-primary">{fmt(c.price)}</b>
              {short && (
                <span className="block text-[11px] text-muted-foreground">
                  Te faltan {fmt(c.price - shop.points.balance)} (≈{" "}
                  {Math.ceil((c.price - shop.points.balance) / perMix)} mixes)
                </span>
              )}
            </span>
          )}
          <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
            {usable ? (
              <Button size="sm" variant={eq ? "outline" : "default"} onClick={() => onEquip(!eq)}>
                {eq ? "Sacar" : "Equipar"}
              </Button>
            ) : (
              !c.vip_only &&
              c.price != null && (
                <Button size="sm" disabled={short} onClick={onBuy}>
                  Comprar
                </Button>
              )
            )}
            <Button size="sm" variant="outline" onClick={onTry}>
              {trying ? "Probando" : "Probar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
