import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AdminShop } from "@/features/shop/AdminShop"
import { useShopDemo } from "@/features/shop/demo"
import { ProfilePreview } from "@/features/shop/ProfilePreview"
import { ShopPage } from "@/features/shop/ShopPage"

// Ejemplo de la tienda sin API ni sesión (docs/bitacora/2026-10-29-tienda-web en kyan/pruebas), con las
// reglas de la base. Solo en `pnpm dev`: en el build de producción la ruta no existe.
export const Route = createFileRoute("/demo/tienda")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoTienda,
})

const ALIAS = "v34|Pepon"
const VIEWS = { shop: "Tienda", profile: "Mi perfil", admin: "Administración" } as const

function DemoTienda() {
  const shop = useShopDemo()
  const [view, setView] = useState<keyof typeof VIEWS>("shop")
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
        <span className="mr-2 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => toast.success(`Mix ganado: +${shop.playMix(true)} puntos.`)}
        >
          Ganar un mix
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => toast.success(`Mix perdido: +${shop.playMix(false)} puntos.`)}
        >
          Perder un mix
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            shop.grant(500, "Premio del admin")
            toast.success("+500 puntos de regalo.")
          }}
        >
          Regalo de 500
        </Button>
        <span className="inline-flex items-center gap-1.5">
          <Switch id="demo-vip" size="sm" checked={shop.vip} onCheckedChange={shop.setVip} />
          <Label htmlFor="demo-vip" className="text-xs">
            Ser VIP
          </Label>
        </span>
        <Button size="sm" variant="ghost" onClick={shop.reset}>
          Reiniciar
        </Button>
        <span className="ml-auto inline-flex rounded-lg border p-0.5">
          {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={view === v ? "secondary" : "ghost"}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {VIEWS[v]}
            </Button>
          ))}
        </span>
      </div>
      {view === "shop" && <ShopPage shop={shop} alias={ALIAS} />}
      {view === "profile" && <ProfilePreview shop={shop} alias={ALIAS} />}
      {view === "admin" && <AdminShop shop={shop} />}
    </div>
  )
}
