import { createFileRoute } from "@tanstack/react-router"

import { ShopPage } from "@/features/shop/ShopPage"

// Tienda de cosméticos con puntos y monedas VIP (replanteo 113, bitácora 2026-11-11-tienda-de-puntos).
export const Route = createFileRoute("/_app/shop")({
  component: ShopPage,
})
