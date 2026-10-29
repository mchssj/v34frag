import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { VipBadge } from "./cosmetics"
import type { ShopDemo } from "./demo"
import { COLLECTIONS, KINDS, type PointsConfig } from "./types"

// Admin → Tienda: puntos (set_points_config), cuentas (admin_points_grant, admin_vip_grant…) y catálogo
// (admin_shop_item_update).
export function AdminShop({ shop }: { shop: ShopDemo }) {
  const [cfg, setCfg] = useState<PointsConfig>(shop.config)
  const [q, setQ] = useState("")
  const [page, setPage] = useState(0)
  const PER = 15
  const items = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return shop.items.filter(
      (i) => !qq || `${i.id} ${i.name} ${COLLECTIONS[i.collection] ?? ""}`.toLowerCase().includes(qq),
    )
  }, [shop.items, q])
  const pages = Math.max(1, Math.ceil(items.length / PER))

  const fields: [keyof PointsConfig, string, string][] = [
    ["per_mix", "Puntos por mix", "1"],
    ["per_win", "Extra por victoria", "1"],
    ["vip_multiplier", "Multiplicador VIP", "0.1"],
    ["weekly_count", "Ofertas por semana", "1"],
    ["weekly_discount", "Descuento de las ofertas (%)", "1"],
    ["vip_per_mix", "Monedas VIP por mix", "1"],
    ["vip_per_win", "Monedas VIP extra por victoria", "1"],
  ]

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-bold">Puntos y monedas VIP</h2>
        <p className="text-xs text-muted-foreground">
          Las monedas VIP se ganan solo en los mixes jugados siendo VIP y compran los artículos VIP. Si se
          vence el VIP, quedan congeladas.
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
          {fields.map(([k, label, step]) => (
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
        <div>
          <Button
            onClick={() => {
              shop.setConfig(cfg)
              toast.success("Puntos guardados. Cambia el saldo de todos.")
            }}
          >
            Guardar
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-bold">Cuentas: saldo, regalos y VIP</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Monedas VIP</TableHead>
                <TableHead>Ganados / regalos / gastados</TableHead>
                <TableHead>Mixes</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shop.accounts.map((a) => (
                <TableRow key={a.user_id}>
                  <TableCell className="font-semibold">
                    {a.alias} {a.vip && <VipBadge />}
                  </TableCell>
                  <TableCell className="font-bold text-primary">{a.balance.toLocaleString("es")}</TableCell>
                  <TableCell className="font-bold text-[#e8b53a]">
                    {a.vip_balance.toLocaleString("es")}
                  </TableCell>
                  <TableCell>
                    {a.earned} / {a.granted} / {a.spent}
                  </TableCell>
                  <TableCell>{a.mixes}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          shop.adminAccount(a.user_id, { granted: a.granted + 100 })
                          toast.success(`+100 puntos para ${a.alias} (motivo: premio de evento).`)
                        }}
                      >
                        +100
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          shop.adminAccount(a.user_id, { granted: a.granted - 100 })
                          toast.success(`−100 puntos para ${a.alias} (motivo: corrección).`)
                        }}
                      >
                        −100
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          shop.adminAccount(a.user_id, { vip_balance: a.vip_balance + 100 })
                          toast.success(`+100 monedas VIP para ${a.alias} (motivo: premio de evento).`)
                        }}
                      >
                        +100 VIP
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          shop.adminAccount(a.user_id, { items: a.items + 1 })
                          toast.success(`Le regalaste un artículo a ${a.alias}.`)
                        }}
                      >
                        Regalar artículo
                      </Button>
                      <Button
                        size="sm"
                        variant={a.vip ? "outline" : "default"}
                        onClick={() => {
                          shop.adminAccount(a.user_id, { vip: !a.vip })
                          toast.success(a.vip ? `Le quitaste el VIP a ${a.alias}.` : `${a.alias} es VIP por 1 mes.`)
                        }}
                      >
                        {a.vip ? "Quitar VIP" : "Dar VIP"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-bold">Catálogo: precios y artículos activos</h2>
        <Input
          placeholder="Buscar artículo..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(0)
          }}
          aria-label="Buscar artículo"
        />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artículo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Colección</TableHead>
                <TableHead>Para</TableHead>
                <TableHead>Precio (puntos o monedas VIP)</TableHead>
                <TableHead>Activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.slice(page * PER, (page + 1) * PER).map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-semibold">{i.name}</TableCell>
                  <TableCell>{KINDS[i.kind]}</TableCell>
                  <TableCell>{COLLECTIONS[i.collection] ?? i.collection}</TableCell>
                  <TableCell>{i.vip_only ? <VipBadge /> : "Todos"}</TableCell>
                  <TableCell>
                    {/* Lo normal, en puntos (admin_shop_item_update); lo VIP, en monedas VIP
                        (admin_shop_item_vip_price). El premio VIP no tiene precio. */}
                    <Input
                      type="number"
                      className="h-8 w-24"
                      disabled={i.vip_reward}
                      placeholder={i.vip_reward ? "Con el VIP" : "Sin venta"}
                      aria-label={i.vip_only ? "Precio en monedas VIP" : "Precio en puntos"}
                      defaultValue={(i.vip_only ? i.vip_price : i.price) ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        const price = v ? Number(v) : null
                        if (price === (i.vip_only ? i.vip_price : i.price)) return
                        shop.updateItem(i.id, i.vip_only ? { vip_price: price } : { price })
                        const unit = i.vip_only ? " monedas VIP" : " puntos"
                        toast.success(
                          `«${i.name}» ${price == null ? "salió de la venta" : `ahora cuesta ${price}${unit}`}.`,
                        )
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      size="sm"
                      checked={i.active}
                      onCheckedChange={(v) => shop.updateItem(i.id, { active: v })}
                      aria-label="Activo"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          Página {page + 1} de {pages} · {items.length} artículos
          <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            Siguiente
          </Button>
        </div>
      </section>
    </div>
  )
}
