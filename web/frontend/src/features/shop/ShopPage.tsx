import { cn } from "cn"
import {
  CoinsIcon,
  HistoryIcon,
  LockIcon,
  PackageIcon,
  StoreIcon,
  TrendingUpIcon,
} from "lucide-react"
import { useState } from "react"

import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { VipBadge } from "./cosmetics"
import type { ShopDemo } from "./demo"
import { EarnTab, LedgerTab } from "./EarnTab"
import { InventoryTab } from "./InventoryTab"
import { ItemSheet, type Opened } from "./ItemSheet"
import { GOLD, num } from "./parts"
import { StoreTab } from "./StoreTab"

// Tienda (plan docs/bitacora/2026-11-11-tienda): billetera, tienda, inventario de la cuenta, cómo se gana y el
// historial. Mismo lenguaje que Ranking; el dorado queda solo para lo VIP.

type Tab = "store" | "inventory" | "earn" | "ledger"

export function ShopPage({ shop, alias }: { shop: ShopDemo; alias: string }) {
  const [tab, setTab] = useState<Tab>("store")
  const [opened, setOpened] = useState<Opened>(null)

  if (shop.loading)
    return (
      <p className="text-sm text-muted-foreground">Cargando la tienda...</p>
    )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-[-0.4px]">Tienda</h1>
          <p className="max-w-[62ch] text-sm text-pretty text-muted-foreground">
            Jugando, con medallas, misiones y torneos ganás puntos. Gastalos en
            marcos, fondos, temas, efectos para tu nombre y stickers, y armá tu
            perfil.
          </p>
        </div>
        <Wallet shop={shop} onEarn={() => setTab("earn")} />
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="gap-5"
      >
        <TabsList
          variant="line"
          className="w-full justify-start gap-4 overflow-x-auto overflow-y-hidden border-b px-0 pb-[5px]"
        >
          <TabsTrigger value="store" className="flex-none">
            <StoreIcon /> Tienda
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex-none">
            <PackageIcon /> Inventario
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {shop.owned.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="earn" className="flex-none">
            <TrendingUpIcon /> Cómo ganar
          </TabsTrigger>
          <TabsTrigger value="ledger" className="flex-none">
            <HistoryIcon /> Historial
          </TabsTrigger>
        </TabsList>
        <TabsContent value="store">
          <StoreTab shop={shop} alias={alias} open={setOpened} />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryTab
            shop={shop}
            alias={alias}
            open={setOpened}
            goShop={() => setTab("store")}
          />
        </TabsContent>
        <TabsContent value="earn">
          <EarnTab shop={shop} />
        </TabsContent>
        <TabsContent value="ledger">
          <LedgerTab shop={shop} />
        </TabsContent>
      </Tabs>

      <ItemSheet
        opened={opened}
        onOpen={setOpened}
        onClose={() => setOpened(null)}
        shop={shop}
        alias={alias}
      />
    </div>
  )
}

/** Saldos de las dos monedas y las partidas con premio que quedan hoy. */
function Wallet({ shop, onEarn }: { shop: ShopDemo; onEarn: () => void }) {
  const cap = shop.config.daily_match_cap
  return (
    <Card
      variant="outline"
      className="flex flex-wrap items-stretch divide-x bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)] max-sm:w-full"
    >
      <div className="flex flex-col gap-0.5 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CoinsIcon className="size-3.5 text-primary" /> Puntos
        </span>
        <span className="font-mono text-[22px] leading-none font-semibold tracking-[-0.5px] text-primary tabular-nums">
          {num(shop.points.balance)}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <VipBadge className="h-3.5" /> Monedas VIP
          {!shop.vip && <LockIcon aria-label="Congeladas" className="size-3" />}
        </span>
        <span
          className={cn(
            "font-mono text-[22px] leading-none font-semibold tracking-[-0.5px] tabular-nums",
            GOLD,
            !shop.vip && "opacity-50"
          )}
        >
          {num(shop.coins.balance)}
        </span>
      </div>
      <button
        type="button"
        onClick={onEarn}
        className="flex min-w-[140px] flex-1 flex-col justify-center gap-1.5 px-4 py-2.5 text-left transition-colors hover:bg-muted"
      >
        <span className="text-xs text-muted-foreground">
          Partidas con premio hoy{" "}
          <b className="font-mono text-foreground tabular-nums">
            {shop.matchesToday}/{cap}
          </b>
        </span>
        <Progress value={(shop.matchesToday / cap) * 100} />
      </button>
    </Card>
  )
}
