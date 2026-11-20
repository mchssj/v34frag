import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { ShopPage } from "@/features/shop/ShopPage"

// Inventario: lo que tienes de la tienda, aparte de lo que se vende (bitácora 2026-11-20-inventario).
// ?canjear=true abre la ventana de canjear un código, como en la tienda.
const search = z.object({ canjear: z.boolean().optional().catch(undefined) })

export const Route = createFileRoute("/_app/inventory")({
  validateSearch: search,
  component: InventoryRoute,
})

function InventoryRoute() {
  const { canjear } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ShopPage
      mode="inventory"
      redeemOpen={!!canjear}
      onRedeemOpen={(open) =>
        void navigate({
          search: (prev) => ({ ...prev, canjear: open || undefined }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  )
}
