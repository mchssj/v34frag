import { useQuery } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { Schemas } from "@/api/client"
import { errorMessage } from "@/api/errors"
import { useMe } from "@/auth/queries"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { myProfileOptions } from "@/features/profile/api/queries"
import { useDebouncedValue } from "@/lib/useDebouncedValue"

import {
  adminAccountsOptions,
  adminConfigOptions,
  adminItemsOptions,
  adminUserItemsOptions,
  useAdminConfig,
  useAdminCoverClear,
  useAdminCustomClear,
  adminUserCustomOptions,
  useAdminGrant,
  useAdminItemGrant,
  useAdminItemRevoke,
  useAdminPatchItem,
} from "./api"
import { AdminCodesSection } from "./AdminCodesSection"
import { AvatarMedia, CardBackground, VipBadge } from "./cosmetics"
import { ItemPreviewDialog, ItemThumb, type PreviewItem } from "./ItemPreview"
import { COLLECTIONS, KINDS, type ItemKind, type PointsConfig } from "./types"

// Administración › Tienda (replanteo 113, contrato tienda.md): la configuración de los puntos, las cuentas
// (sumar o restar, regalar o quitar artículos, quitar la portada) y el catálogo (precios y activo). Solo admins.

const section = "flex flex-col gap-3 rounded-xl border bg-card p-5"
const PER = 20

export function AdminShopPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.4px]">Tienda</h1>
        <p className="max-w-[70ch] text-sm text-muted-foreground">
          Los puntos y las monedas VIP se calculan de los mixes: cambiar los
          valores cambia el saldo de todos. Lo que regalas, quitas o corriges
          queda en el historial de la cuenta, con el motivo.
        </p>
      </div>
      <ConfigSection />
      <AccountsSection />
      <CatalogSection />
      <AdminCodesSection />
    </div>
  )
}

// ---------- configuración ----------

type NumKey = Exclude<keyof PointsConfig, "code_vip_free">
const FIELDS: [NumKey, string, string][] = [
  ["per_mix", "Puntos por mix", "1"],
  ["per_win", "Extra por victoria", "1"],
  ["vip_multiplier", "Multiplicador de puntos para VIP", "0.1"],
  ["vip_per_mix", "Monedas VIP por mix", "1"],
  ["vip_per_win", "Monedas VIP extra por victoria", "1"],
  ["weekly_count", "Ofertas por semana", "1"],
  ["weekly_discount", "Descuento de las ofertas (%)", "1"],
  // Lo propio (bitácora 2026-11-13-avatar-y-fondo-propios): se cobra cada vez que se sube uno.
  ["custom_avatar_price", "Subir avatar animado (monedas VIP)", "1"],
  [
    "custom_bg_animated_price",
    "Subir fondo de miniperfil animado (monedas VIP)",
    "1",
  ],
  ["custom_bg_static_price", "Subir fondo de miniperfil fijo (puntos)", "1"],
  // Cuántos guarda cada cuenta (bitácora 2026-11-14-inventario-de-lo-propio).
  ["custom_max_avatar", "Avatares propios guardados por cuenta", "1"],
  [
    "custom_max_background",
    "Fondos de miniperfil propios guardados por cuenta",
    "1",
  ],
]

function ConfigSection() {
  const q = useQuery(adminConfigOptions)
  if (!q.data) return <section className={section}>Cargando...</section>
  return <ConfigForm key={JSON.stringify(q.data)} initial={q.data} />
}

function ConfigForm({ initial }: { initial: PointsConfig }) {
  const [cfg, setCfg] = useState(initial)
  const [confirm, setConfirm] = useState(false)
  const save = useAdminConfig()
  const changed = FIELDS.filter(([k]) => cfg[k] !== initial[k])
  const vipFreeChanged = cfg.code_vip_free !== initial.code_vip_free
  return (
    <section className={section}>
      <h2 className="text-sm font-bold">Puntos y monedas VIP</h2>
      <p className="text-xs text-muted-foreground">
        Las monedas VIP se ganan solo en los mixes jugados siendo VIP y compran
        los artículos VIP. Si se vence el VIP, quedan congeladas.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
        {FIELDS.map(([k, label, step]) => (
          <div key={k} className="flex flex-col gap-1.5">
            <Label htmlFor={`cfg-${k}`}>{label}</Label>
            <Input
              id={`cfg-${k}`}
              type="number"
              step={step}
              value={cfg[k]}
              onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) })}
            />
          </div>
        ))}
      </div>
      {/* (replanteo 126, Daniel 2026-11-17) Lo VIP que se gana con un código, sin ser VIP. */}
      <div className="flex items-start gap-3 rounded-lg border p-3">
        <Switch
          id="cfg-code_vip_free"
          checked={cfg.code_vip_free}
          onCheckedChange={(v) => setCfg({ ...cfg, code_vip_free: v })}
        />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="cfg-code_vip_free">
            Lo VIP de un código se usa sin ser VIP
          </Label>
          <span className="text-xs text-muted-foreground">
            Un artículo VIP ganado en un sorteo se puede usar aunque la cuenta
            no sea VIP. Apagado, queda congelado hasta que lo sea, como lo
            comprado. Lo que se compra o regala un admin sigue la regla de
            siempre.
          </span>
        </div>
      </div>
      <div>
        <Button
          disabled={!changed.length && !vipFreeChanged}
          onClick={() => setConfirm(true)}
        >
          Guardar
        </Button>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cambiar los puntos?</DialogTitle>
            <DialogDescription>
              Lo que se gana por mix cambia el saldo de todas las cuentas,
              también por los mixes que ya jugaron. Los precios de lo propio
              valen para lo que se suba desde ahora.
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm">
            {changed.map(([k, label]) => (
              <li key={k}>
                {label}: {initial[k]} → <b>{cfg[k]}</b>
              </li>
            ))}
            {vipFreeChanged && (
              <li>
                Lo VIP de un código se usa sin ser VIP:{" "}
                <b>{cfg.code_vip_free ? "sí" : "no"}</b>. Cambia al instante
                para todo lo que ya se canjeó.
              </li>
            )}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <Button
              disabled={save.isPending}
              onClick={() =>
                save.mutate(
                  {
                    ...Object.fromEntries(changed.map(([k]) => [k, cfg[k]])),
                    ...(vipFreeChanged
                      ? { code_vip_free: cfg.code_vip_free }
                      : {}),
                  },
                  {
                    onSuccess: () => {
                      toast.success("Puntos guardados.")
                      setConfirm(false)
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  }
                )
              }
            >
              Cambiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

// ---------- cuentas ----------

type Account = Schemas["AdminAccountPoints"]

function AccountsSection() {
  const [q, setQ] = useState("")
  const [vip, setVip] = useState<"all" | "true" | "false">("all")
  const [sort, setSort] = useState<
    "balance" | "vip_balance" | "mixes" | "alias"
  >("balance")
  const [page, setPage] = useState(1)
  // El id: la fila se lee de la lista, que se recarga después de cada acción (el saldo queda al día).
  const [openId, setOpenId] = useState<string | null>(null)
  const term = useDebouncedValue(q.trim(), 300)
  const list = useQuery(
    adminAccountsOptions({
      page,
      per: PER,
      sort,
      order: sort === "alias" ? "asc" : "desc",
      ...(term ? { q: term } : {}),
      ...(vip !== "all" ? { vip } : {}),
    })
  )
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PER))
  const open = list.data?.items.find((a) => a.user.id === openId) ?? null
  return (
    <section className={section}>
      <h2 className="text-sm font-bold">Cuentas</h2>
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-[260px]"
          placeholder="Buscar alias o nick..."
          aria-label="Buscar cuenta"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
        <Select
          value={vip}
          onValueChange={(v) => (setVip(v as typeof vip), setPage(1))}
        >
          <SelectTrigger className="w-[140px]" aria-label="VIP">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="true">Solo VIP</SelectItem>
            <SelectItem value="false">Sin VIP</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(v) => (setSort(v as typeof sort), setPage(1))}
        >
          <SelectTrigger className="w-[170px]" aria-label="Ordenar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="balance">Más puntos</SelectItem>
            <SelectItem value="vip_balance">Más monedas VIP</SelectItem>
            <SelectItem value="mixes">Más mixes</SelectItem>
            <SelectItem value="alias">Alias</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead>Puntos</TableHead>
              <TableHead>Monedas VIP</TableHead>
              <TableHead>Ganados / regalos / gastados</TableHead>
              <TableHead>Mixes</TableHead>
              <TableHead>Artículos</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data?.items.map((a) => (
              <TableRow key={a.user.id}>
                <TableCell className="font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    {a.user.alias} {a.vip && <VipBadge />}
                  </span>
                  {!a.player && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      Sin ficha
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono font-bold text-primary">
                  {a.points.balance.toLocaleString("es")}
                </TableCell>
                <TableCell className="font-mono font-bold text-[#e8b53a]">
                  {a.vip_coins.balance.toLocaleString("es")}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {a.points.earned} / {a.points.granted} / {a.points.spent}
                </TableCell>
                <TableCell>{a.points.mixes}</TableCell>
                <TableCell>{a.items}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpenId(a.user.id)}
                  >
                    Gestionar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {list.isPending && (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      )}
      {list.isError && (
        <p className="text-sm text-destructive">{errorMessage(list.error)}</p>
      )}
      <Pager
        page={page}
        pages={pages}
        total={list.data?.total ?? 0}
        onPage={setPage}
      />
      {open && <AccountDialog account={open} onClose={() => setOpenId(null)} />}
    </section>
  )
}

function AccountDialog({
  account,
  onClose,
}: {
  account: Account
  onClose: () => void
}) {
  const id = account.user.id
  const [currency, setCurrency] = useState<"points" | "vip">("points")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [item, setItem] = useState("")
  const grant = useAdminGrant()
  const give = useAdminItemGrant()
  const revoke = useAdminItemRevoke()
  const cover = useAdminCoverClear()
  const clearCustom = useAdminCustomClear()
  const inventory = useQuery(adminUserItemsOptions(id))
  const custom = useQuery(adminUserCustomOptions(id)).data
  const n = Number(amount)
  const why = reason.trim()
  const done = (msg: string) => () => {
    toast.success(msg)
    setAmount("")
    setItem("")
  }
  const fail = (e: unknown) => toast.error(errorMessage(e))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{account.user.alias}</DialogTitle>
          <DialogDescription>
            {account.points.balance.toLocaleString("es")} puntos y{" "}
            {account.vip_coins.balance.toLocaleString("es")} monedas VIP. Cada
            acción avisa a la cuenta y guarda el motivo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="adm-reason">Motivo (obligatorio)</Label>
          <Input
            id="adm-reason"
            maxLength={200}
            placeholder="Por ejemplo: premio del torneo, corrección, trampa"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Select
            value={currency}
            onValueChange={(v) => setCurrency(v as typeof currency)}
          >
            <SelectTrigger className="w-[150px]" aria-label="Moneda">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="points">Puntos</SelectItem>
              <SelectItem value="vip">Monedas VIP</SelectItem>
            </SelectContent>
          </Select>
          <Input
            className="w-[140px]"
            type="number"
            placeholder="+500 o -100"
            aria-label="Cantidad"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button
            disabled={
              !why || !Number.isInteger(n) || n === 0 || grant.isPending
            }
            onClick={() =>
              grant.mutate(
                { id, body: { currency, amount: n, reason: why } },
                {
                  onSuccess: done(
                    `${n > 0 ? "Sumaste" : "Restaste"} ${Math.abs(n)} a ${account.user.alias}.`
                  ),
                  onError: fail,
                }
              )
            }
          >
            {n < 0 ? "Restar" : "Sumar"}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            className="flex-1"
            placeholder="Id del artículo (por ejemplo, marco-fuego)"
            aria-label="Artículo para regalar"
            value={item}
            onChange={(e) => setItem(e.target.value.trim())}
          />
          <Button
            variant="outline"
            disabled={!item || give.isPending}
            onClick={() =>
              give.mutate(
                { id, body: { item, ...(why ? { note: why } : {}) } },
                {
                  onSuccess: done(
                    `Le regalaste ${item} a ${account.user.alias}.`
                  ),
                  onError: fail,
                }
              )
            }
          >
            Regalar artículo
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase">
            Inventario
          </h3>
          {!inventory.data?.items.length ? (
            <p className="text-sm text-muted-foreground">
              {inventory.isPending ? "Cargando..." : "No tiene artículos."}
            </p>
          ) : (
            <ul className="max-h-[220px] divide-y overflow-y-auto text-sm">
              {inventory.data.items
                .flatMap((u) => (!u.item ? [] : [{ ...u, item: u.item }]))
                .map((u) => (
                  <li
                    key={u.item.id}
                    className="flex items-center gap-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {u.item.name}{" "}
                      <span className="text-xs text-muted-foreground">
                        · {KINDS[u.item.kind]}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {u.source === "grant"
                          ? "Regalo"
                          : `Compra: ${u.price_paid} ${u.currency === "vip" ? "monedas VIP" : "puntos"}`}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!why || revoke.isPending}
                      title={why ? undefined : "Escribe el motivo"}
                      onClick={() =>
                        revoke.mutate(
                          { id, item: u.item.id, reason: why },
                          {
                            onSuccess: done(`Le quitaste ${u.item.name}.`),
                            onError: fail,
                          }
                        )
                      }
                    >
                      Quitar
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </div>
        {!!(custom?.avatar.length || custom?.background.length) && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase">
              Lo que subió
            </h3>
            {/* Todo lo guardado, puesto o no (bitácora 2026-11-14-inventario-de-lo-propio). */}
            <ul className="flex flex-wrap gap-3">
              {[...custom.avatar, ...custom.background].map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  {m.kind === "avatar" ? (
                    <AvatarMedia
                      avatar={{ url: m.url, poster_url: m.poster_url }}
                      className="size-14 rounded-md border"
                    />
                  ) : (
                    <span className="relative isolate aspect-[1/2] w-[40px] overflow-hidden rounded-md border">
                      <CardBackground src={m.url} poster={m.poster_url} />
                    </span>
                  )}
                  <span className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      {m.kind === "avatar"
                        ? "Avatar"
                        : m.animated
                          ? "Fondo de miniperfil animado"
                          : "Fondo de miniperfil fijo"}
                      {m.equipped ? " · puesto" : ""}
                    </span>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={!why || clearCustom.isPending}
                      title={why ? undefined : "Escribe el motivo"}
                      onClick={() =>
                        clearCustom.mutate(
                          { id, cid: m.id, reason: why },
                          {
                            onSuccess: done(
                              m.kind === "avatar"
                                ? "Sacaste ese avatar."
                                : "Sacaste ese fondo de miniperfil."
                            ),
                            onError: fail,
                          }
                        )
                      }
                    >
                      Sacar
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            disabled={!account.cover_url || !why || cover.isPending}
            onClick={() =>
              cover.mutate(
                { id, reason: why },
                { onSuccess: done("Quitaste la portada."), onError: fail }
              )
            }
          >
            {account.cover_url ? "Quitar portada" : "Sin portada"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- catálogo ----------

function CatalogSection() {
  const [q, setQ] = useState("")
  const [kind, setKind] = useState<ItemKind | "all">("all")
  const [col, setCol] = useState("all")
  const [state, setState] = useState<"all" | "true" | "false">("all")
  const [page, setPage] = useState(1)
  const [previewing, setPreviewing] = useState<PreviewItem | null>(null)
  const [editing, setEditing] = useState<Schemas["AdminShopItem"] | null>(null)
  const term = useDebouncedValue(q.trim(), 300)
  const patch = useAdminPatchItem()
  // La vista previa se ve con la foto y el nick del admin.
  const me = useMe().data
  const profile = useQuery(myProfileOptions).data
  const alias = profile?.player?.nick ?? me?.tag ?? "Jugador"
  const photo =
    profile?.player?.photo_url ?? profile?.details.avatar_url ?? null
  const list = useQuery(
    adminItemsOptions({
      page,
      per: PER,
      sort: "sort",
      order: "asc",
      ...(term ? { q: term } : {}),
      ...(kind !== "all" ? { kind } : {}),
      ...(col !== "all" ? { collection: col } : {}),
      ...(state !== "all" ? { active: state } : {}),
    })
  )
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PER))
  const save = (id: string, body: Schemas["AdminShopItemPatch"], msg: string) =>
    patch.mutate(
      { id, body },
      {
        onSuccess: () => toast.success(msg),
        onError: (e) => toast.error(errorMessage(e)),
      }
    )
  return (
    <section className={section}>
      <h2 className="text-sm font-bold">
        Catálogo: precios y artículos activos
      </h2>
      <p className="text-xs text-muted-foreground">
        Un artículo inactivo no se ve en la tienda, pero quien lo tiene lo sigue
        usando. Precio vacío: no se vende. Toca un artículo para ver su vista
        previa y el lápiz para cambiarle el nombre, la descripción o para quién
        es (todos o solo VIP).
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-[260px]"
          placeholder="Buscar artículo..."
          aria-label="Buscar artículo"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
        <Select
          value={kind}
          onValueChange={(v) => (setKind(v as typeof kind), setPage(1))}
        >
          <SelectTrigger className="w-[150px]" aria-label="Tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {(Object.keys(KINDS) as ItemKind[]).map((k) => (
              <SelectItem key={k} value={k}>
                {KINDS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={col} onValueChange={(v) => (setCol(v), setPage(1))}>
          <SelectTrigger className="w-[190px]" aria-label="Colección">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las colecciones</SelectItem>
            {Object.entries(COLLECTIONS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={state}
          onValueChange={(v) => (setState(v as typeof state), setPage(1))}
        >
          <SelectTrigger className="w-[160px]" aria-label="Estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Activos e inactivos</SelectItem>
            <SelectItem value="true">Solo activos</SelectItem>
            <SelectItem value="false">Solo inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Artículo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Colección</TableHead>
              <TableHead>Para</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Lo tienen</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data?.items.map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  <button
                    type="button"
                    className="flex items-center gap-2.5 text-left hover:text-primary"
                    aria-label={`Vista previa de ${i.name}`}
                    onClick={() => setPreviewing(i)}
                  >
                    <ItemThumb item={i} />
                    <span className="font-semibold">
                      {i.name}
                      <span className="block font-mono text-[11px] font-normal text-muted-foreground">
                        {i.id}
                      </span>
                    </span>
                  </button>
                </TableCell>
                <TableCell>{KINDS[i.kind]}</TableCell>
                <TableCell>
                  {COLLECTIONS[i.collection] ?? i.collection}
                </TableCell>
                <TableCell>{i.vip_only ? <VipBadge /> : "Todos"}</TableCell>
                <TableCell>
                  {/* Lo de todos, en puntos; lo VIP, en monedas VIP. El premio VIP no tiene precio. */}
                  <Input
                    key={`${i.id}-${i.price}-${i.vip_price}`}
                    type="number"
                    className="h-8 w-28"
                    disabled={i.vip_reward}
                    placeholder={i.vip_reward ? "Con el VIP" : "No se vende"}
                    aria-label={
                      i.vip_only ? "Precio en monedas VIP" : "Precio en puntos"
                    }
                    defaultValue={(i.vip_only ? i.vip_price : i.price) ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      const price = v ? Number(v) : null
                      if (price === (i.vip_only ? i.vip_price : i.price)) return
                      const unit = i.vip_only ? " monedas VIP" : " puntos"
                      save(
                        i.id,
                        i.vip_only ? { vip_price: price } : { price },
                        `«${i.name}» ${price == null ? "salió de la venta" : `ahora cuesta ${price}${unit}`}.`
                      )
                    }}
                  />
                </TableCell>
                <TableCell>{i.owners}</TableCell>
                <TableCell>
                  <Switch
                    size="sm"
                    checked={i.active}
                    onCheckedChange={(v) =>
                      save(
                        i.id,
                        { active: v },
                        `«${i.name}» ${v ? "vuelve a la tienda" : "salió de la tienda"}.`
                      )
                    }
                    aria-label="Activo"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label={`Editar ${i.name}`}
                    title="Cambiar nombre, descripción y para quién es"
                    onClick={() => setEditing(i)}
                  >
                    <PencilIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {list.isPending && (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      )}
      {list.isError && (
        <p className="text-sm text-destructive">{errorMessage(list.error)}</p>
      )}
      <Pager
        page={page}
        pages={pages}
        total={list.data?.total ?? 0}
        onPage={setPage}
      />
      <ItemPreviewDialog
        item={previewing}
        onClose={() => setPreviewing(null)}
        alias={alias}
        photo={photo}
        level={null}
        price={
          previewing && (
            <span className="text-sm text-muted-foreground">
              Así se vería con tu foto y tu nick, sin lo demás que tengas
              puesto.
            </span>
          )
        }
      />
      <EditItemDialog item={editing} onClose={() => setEditing(null)} />
    </section>
  )
}

/** Cambiar el nombre y la descripción de un artículo (lo que se ve en la tienda). */
export function EditItemDialog({
  item,
  onClose,
}: {
  item: Schemas["AdminShopItem"] | null
  onClose: () => void
}) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      {item && <EditItemForm key={item.id} item={item} onClose={onClose} />}
    </Dialog>
  )
}

function EditItemForm({
  item,
  onClose,
}: {
  item: Schemas["AdminShopItem"]
  onClose: () => void
}) {
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description ?? "")
  const [vip, setVip] = useState(item.vip_only)
  // Al cambiar de grupo cambia la moneda: arranca con el precio de hoy.
  const [price, setPrice] = useState(
    String((item.vip_only ? item.vip_price : item.price) ?? "")
  )
  const patch = useAdminPatchItem()
  const n = name.trim()
  const d = description.trim()
  const switched = vip !== item.vip_only
  const p = price.trim() ? Number(price) : null
  const badPrice = switched && p !== null && !(Number.isInteger(p) && p >= 1)
  const body: Schemas["AdminShopItemPatch"] = {
    ...(n !== item.name ? { name: n } : {}),
    ...(d !== (item.description ?? "") ? { description: d || null } : {}),
    ...(switched
      ? { vip_only: vip, ...(vip ? { vip_price: p } : { price: p }) }
      : {}),
  }
  const changed = Object.keys(body).length > 0
  const submit = () =>
    patch.mutate(
      { id: item.id, body },
      {
        onSuccess: () => {
          toast.success(`«${n}» guardado.`)
          onClose()
        },
        onError: (e) => toast.error(errorMessage(e)),
      }
    )
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Editar artículo</DialogTitle>
        <DialogDescription>
          {KINDS[item.kind]} · <span className="font-mono">{item.id}</span>. El
          id y el archivo no cambian.
        </DialogDescription>
      </DialogHeader>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (n && changed && !badPrice) submit()
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-name">Nombre</Label>
          <Input
            id="item-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
          <span className="text-[11px] text-muted-foreground">
            {n.length}/60
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-desc">Descripción</Label>
          <Textarea
            id="item-desc"
            value={description}
            maxLength={200}
            rows={3}
            placeholder="Sin descripción"
            onChange={(e) => setDescription(e.target.value)}
          />
          <span className="text-[11px] text-muted-foreground">
            {d.length}/200. Vacía: no lleva descripción.
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-for">Para</Label>
          <Select
            value={vip ? "vip" : "all"}
            onValueChange={(v) => setVip(v === "vip")}
            disabled={item.vip_reward}
          >
            <SelectTrigger id="item-for" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos (se paga con puntos)</SelectItem>
              <SelectItem value="vip">
                Solo VIP (se paga con monedas VIP)
              </SelectItem>
            </SelectContent>
          </Select>
          {item.vip_reward && (
            <span className="text-[11px] text-muted-foreground">
              Viene con el VIP: sigue siendo VIP.
            </span>
          )}
        </div>
        {switched && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-price">
              {vip ? "Precio en monedas VIP" : "Precio en puntos"}
            </Label>
            <Input
              id="item-price"
              type="number"
              min={1}
              value={price}
              placeholder="No se vende"
              onChange={(e) => setPrice(e.target.value)}
            />
            <span className="text-[11px] text-muted-foreground">
              Cambia la moneda: el precio {vip ? "en puntos" : "en monedas VIP"}{" "}
              se borra. Vacío: no se vende.
            </span>
            {vip && item.owners > 0 && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                {item.owners === 1
                  ? "1 cuenta lo tiene."
                  : `${item.owners} cuentas lo tienen.`}{" "}
                Lo conservan, pero quien no sea VIP no lo puede usar hasta que
                lo sea.
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!n || !changed || badPrice || patch.isPending}
          >
            {patch.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function Pager({
  page,
  pages,
  total,
  onPage,
}: {
  page: number
  pages: number
  total: number
  onPage: (p: number) => void
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Button
        size="sm"
        variant="outline"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Anterior
      </Button>
      Página {page} de {pages} · {total}
      <Button
        size="sm"
        variant="outline"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Siguiente
      </Button>
    </div>
  )
}
