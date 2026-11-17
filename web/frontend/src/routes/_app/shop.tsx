import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { ShopPage } from "@/features/shop/ShopPage"

// Tienda de cosméticos con puntos y monedas VIP (replanteo 113, bitácora 2026-11-11-tienda-de-puntos).
// ?canjear=true abre la ventana de canjear un código (replanteo 126): el código nunca va en la URL.
const search = z.object({ canjear: z.boolean().optional().catch(undefined) })

export const Route = createFileRoute("/_app/shop")({
  validateSearch: search,
  component: ShopRoute,
})

function ShopRoute() {
  const { canjear } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ShopPage
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
