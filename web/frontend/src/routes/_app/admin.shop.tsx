import { createFileRoute } from "@tanstack/react-router"

import { AdminShopPage } from "@/features/shop/AdminShopPage"

// Administración › Tienda (replanteo 113, bitácora 2026-11-11-tienda-de-puntos). Solo admins.
export const Route = createFileRoute("/_app/admin/shop")({
  component: AdminShopPage,
})
