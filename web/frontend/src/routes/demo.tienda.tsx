import { createFileRoute, notFound } from "@tanstack/react-router"
import { ChevronDownIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AdminShop } from "@/features/shop/AdminShop"
import { useShopDemo, type Awarded } from "@/features/shop/demo"
import { METALS } from "@/features/shop/economy"
import { ProfilePreview } from "@/features/shop/ProfilePreview"
import { ShopPage } from "@/features/shop/ShopPage"

// Ejemplo de la tienda sin API ni sesión (planes docs/bitacora/2026-11-11-economia-puntos y 2026-11-11-tienda),
// con las reglas de la economía. Solo en `pnpm dev`: en el build de producción la ruta no existe.
export const Route = createFileRoute("/demo/tienda")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoTienda,
})

const ALIAS = "v34|Pepon"
const VIEWS = {
  shop: "Tienda",
  profile: "Mi perfil",
  admin: "Administración",
} as const

function say(what: string, r: Awarded) {
  if (r.capped)
    return toast.warning(
      `${what}: llegaste al tope de partidas con premio de hoy.`
    )
  if (!r.points && !r.vip) return toast(`${what}: sin premio.`)
  toast.success(
    `${what}: ${[r.points && `+${r.points} puntos`, r.vip && `+${r.vip} monedas VIP`].filter(Boolean).join(" y ")}.`
  )
}

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
          onClick={() => say("Partida ganada", shop.playMatch(true))}
        >
          Ganar una partida
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => say("Partida perdida", shop.playMatch(false))}
        >
          Perder una partida
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              Otros premios <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Partidas</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() =>
                say("Partida oficial ganada", shop.playMatch(true, true))
              }
            >
              Ganar una oficial de torneo
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => say("Campeón del torneo", shop.tournament(true))}
            >
              Salir campeón de un torneo
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                say("Subcampeón del torneo", shop.tournament(false))
              }
            >
              Salir subcampeón
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Medallas</DropdownMenuLabel>
            {METALS.map((m) => (
              <DropdownMenuItem
                key={m}
                className="capitalize"
                onSelect={() => say(`Medalla de ${m}`, shop.earnMedal(m))}
              >
                Medalla de {m}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Temporada</DropdownMenuLabel>
            {[1, 2, 3, 7, 15].map((r) => (
              <DropdownMenuItem
                key={r}
                onSelect={() =>
                  say(`Temporada, puesto ${r}`, shop.closeSeason(r))
                }
              >
                Cerrar la temporada en el puesto {r}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Otros</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => say("Nivel nuevo", shop.levelUp())}
            >
              Subir de nivel
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => say("Misión", shop.completeMission(false))}
            >
              Completar una misión
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => say("Misión VIP", shop.completeMission(true))}
            >
              Completar una misión VIP
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => say("Primeros pasos", shop.firstStep())}
            >
              Un paso de Primeros pasos
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => say("Clip destacado", shop.featuredClip())}
            >
              Que destaquen un clip
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                shop.grant(500, "Regalo del admin")
                toast.success("+500 puntos de regalo.")
              }}
            >
              Regalo de 500 puntos
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                shop.grant(300, "Regalo VIP del admin", "vip")
                toast.success("+300 monedas VIP de regalo.")
              }}
            >
              Regalo de 300 monedas VIP
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            shop.nextDay()
            toast("Pasó un día: se renuevan las partidas con premio.")
          }}
        >
          Pasar al día siguiente
        </Button>
        <span className="inline-flex items-center gap-1.5">
          <Switch
            id="demo-vip"
            size="sm"
            checked={shop.vip}
            onCheckedChange={shop.setVip}
          />
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
