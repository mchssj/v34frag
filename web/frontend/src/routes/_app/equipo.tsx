import { createFileRoute } from "@tanstack/react-router"

import { StaffPage } from "@/features/staff/StaffPage"

// La página del Equipo (replanteo 87, bitácora 2026-11-07-pagina-equipo). _app ya exige sesión.
export const Route = createFileRoute("/_app/equipo")({
  component: StaffPage,
})
