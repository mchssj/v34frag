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
import {
  METALS,
  SOURCE_LABEL,
  type EconomyConfig,
  type SourceRule,
} from "./economy"
import { COLLECTIONS, KINDS } from "./types"

// Administración › Tienda: la economía (points_config), las cuentas (admin_points_grant, admin_vip_grant…) y el
// catálogo (admin_shop_item_update).
export function AdminShop({ shop }: { shop: ShopDemo }) {
  const [cfg, setCfg] = useState<EconomyConfig>(shop.config)
  const [q, setQ] = useState("")
  const [page, setPage] = useState(0)
  const PER = 15
  const items = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return shop.items.filter(
      (i) =>
        !qq ||
        `${i.id} ${i.name} ${COLLECTIONS[i.collection] ?? ""}`
          .toLowerCase()
          .includes(qq)
    )
  }, [shop.items, q])
  const pages = Math.max(1, Math.ceil(items.length / PER))
  const setRule = (
    k: keyof EconomyConfig["rules"],
    patch: Partial<SourceRule>
  ) =>
    setCfg({
      ...cfg,
      rules: { ...cfg.rules, [k]: { ...cfg.rules[k], ...patch } },
    })
  const n = (v: string) => Math.max(0, Math.round(Number(v) || 0))

  const general: [keyof EconomyConfig, string][] = [
    ["daily_match_cap", "Partidas por día con premio"],
    ["weekly_count", "Ofertas por semana"],
    ["weekly_discount", "Descuento de las ofertas (%)"],
    ["bundle_discount", "Descuento de los packs (%)"],
  ]

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-bold">Puntos y monedas VIP</h2>
          <p className="text-xs text-muted-foreground">
            Cada premio se anota una vez en el registro. Un cambio rige desde
            ahora: no le mueve el saldo a nadie hacia atrás. Las monedas VIP se
            dan solo si la cuenta es VIP en ese momento. Las PCW no dan premio.
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
          {general.map(([k, label]) => (
            <div key={k} className="flex flex-col gap-1.5">
              <Label htmlFor={`cfg-${k}`}>{label}</Label>
              <Input
                id={`cfg-${k}`}
                type="number"
                value={cfg[k] as number}
                onChange={(e) => setCfg({ ...cfg, [k]: n(e.target.value) })}
              />
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origen</TableHead>
                <TableHead>Puntos</TableHead>
                <TableHead>Monedas VIP</TableHead>
                <TableHead>Activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(Object.keys(cfg.rules) as (keyof EconomyConfig["rules"])[]).map(
                (k) => (
                  <TableRow key={k}>
                    <TableCell className="font-medium">
                      {SOURCE_LABEL[k]}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="h-8 w-24"
                        aria-label={`Puntos: ${SOURCE_LABEL[k]}`}
                        value={cfg.rules[k].points}
                        onChange={(e) =>
                          setRule(k, { points: n(e.target.value) })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="h-8 w-24"
                        aria-label={`Monedas VIP: ${SOURCE_LABEL[k]}`}
                        value={cfg.rules[k].vip}
                        onChange={(e) => setRule(k, { vip: n(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        size="sm"
                        checked={cfg.rules[k].enabled}
                        onCheckedChange={(v) => setRule(k, { enabled: v })}
                        aria-label={`Activo: ${SOURCE_LABEL[k]}`}
                      />
                    </TableCell>
                  </TableRow>
                )
              )}
              {(["champion", "runnerUp"] as const).map((k) => (
                <TableRow key={k}>
                  <TableCell className="font-medium">
                    {k === "champion"
                      ? "Campeón de torneo"
                      : "Subcampeón de torneo"}
                  </TableCell>
                  {(["points", "vip"] as const).map((f) => (
                    <TableCell key={f}>
                      <Input
                        type="number"
                        className="h-8 w-24"
                        aria-label={`${f === "points" ? "Puntos" : "Monedas VIP"}: ${k}`}
                        value={cfg.tournament[k][f]}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            tournament: {
                              ...cfg.tournament,
                              [k]: {
                                ...cfg.tournament[k],
                                [f]: n(e.target.value),
                              },
                            },
                          })
                        }
                      />
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              ))}
              {METALS.map((m) => (
                <TableRow key={m}>
                  <TableCell className="font-medium capitalize">
                    Medalla de {m}
                  </TableCell>
                  {(["points", "vip"] as const).map((f) => (
                    <TableCell key={f}>
                      <Input
                        type="number"
                        className="h-8 w-24"
                        aria-label={`${f === "points" ? "Puntos" : "Monedas VIP"}: medalla de ${m}`}
                        value={cfg.medal[m][f]}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            medal: {
                              ...cfg.medal,
                              [m]: { ...cfg.medal[m], [f]: n(e.target.value) },
                            },
                          })
                        }
                      />
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              ))}
              {cfg.season.map((s, k) => (
                <TableRow key={s.upTo}>
                  <TableCell className="font-medium">
                    Temporada: puesto{" "}
                    {k === 0 ? 1 : cfg.season[k - 1]!.upTo + 1}
                    {s.upTo !== (k === 0 ? 1 : cfg.season[k - 1]!.upTo + 1)
                      ? ` al ${s.upTo}`
                      : ""}
                  </TableCell>
                  {(["points", "vip"] as const).map((f) => (
                    <TableCell key={f}>
                      <Input
                        type="number"
                        className="h-8 w-24"
                        aria-label={`${f === "points" ? "Puntos" : "Monedas VIP"}: temporada hasta el puesto ${s.upTo}`}
                        value={s[f]}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            season: cfg.season.map((x, j) =>
                              j === k ? { ...x, [f]: n(e.target.value) } : x
                            ),
                          })
                        }
                      />
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div>
          <Button
            onClick={() => {
              shop.setConfig(cfg)
              toast.success("Configuración guardada. Rige desde ahora.")
            }}
          >
            Guardar
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-bold">Cuentas: saldo y regalos</h2>
        <p className="text-xs text-muted-foreground">
          El VIP se da y se quita en Administración › Usuarios. Acá solo se ve
          si la cuenta es VIP.
        </p>
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
                  <TableCell className="font-bold text-primary">
                    {a.balance.toLocaleString("es")}
                  </TableCell>
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
                          shop.adminAccount(a.user_id, {
                            granted: a.granted + 100,
                          })
                          toast.success(
                            `+100 puntos para ${a.alias} (motivo: premio de evento).`
                          )
                        }}
                      >
                        +100
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          shop.adminAccount(a.user_id, {
                            granted: a.granted - 100,
                          })
                          toast.success(
                            `−100 puntos para ${a.alias} (motivo: corrección).`
                          )
                        }}
                      >
                        −100
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          shop.adminAccount(a.user_id, {
                            vip_balance: a.vip_balance + 100,
                          })
                          toast.success(
                            `+100 monedas VIP para ${a.alias} (motivo: premio de evento).`
                          )
                        }}
                      >
                        +100 VIP
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          shop.adminAccount(a.user_id, { items: a.items + 1 })
                          toast.success(
                            `Le regalaste un artículo a ${a.alias}.`
                          )
                        }}
                      >
                        Regalar artículo
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
        <h2 className="text-sm font-bold">
          Catálogo: precios y artículos activos
        </h2>
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
                  <TableCell>
                    {COLLECTIONS[i.collection] ?? i.collection}
                  </TableCell>
                  <TableCell>{i.vip_only ? <VipBadge /> : "Todos"}</TableCell>
                  <TableCell>
                    {/* Lo normal, en puntos (admin_shop_item_update); lo VIP, en monedas VIP
                        (admin_shop_item_vip_price). El premio VIP no tiene precio. */}
                    <Input
                      type="number"
                      className="h-8 w-24"
                      disabled={i.vip_reward}
                      placeholder={i.vip_reward ? "Con el VIP" : "Sin venta"}
                      aria-label={
                        i.vip_only
                          ? "Precio en monedas VIP"
                          : "Precio en puntos"
                      }
                      defaultValue={(i.vip_only ? i.vip_price : i.price) ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        const price = v ? Number(v) : null
                        if (price === (i.vip_only ? i.vip_price : i.price))
                          return
                        shop.updateItem(
                          i.id,
                          i.vip_only ? { vip_price: price } : { price }
                        )
                        const unit = i.vip_only ? " monedas VIP" : " puntos"
                        toast.success(
                          `«${i.name}» ${price == null ? "salió de la venta" : `ahora cuesta ${price}${unit}`}.`
                        )
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      size="sm"
                      checked={i.active}
                      onCheckedChange={(v) =>
                        shop.updateItem(i.id, { active: v })
                      }
                      aria-label="Activo"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          Página {page + 1} de {pages} · {items.length} artículos
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages - 1}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      </section>
    </div>
  )
}
