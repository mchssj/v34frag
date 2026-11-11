import { createFileRoute } from "@tanstack/react-router"

import { WidgetPage } from "@/features/widget/WidgetPage"

// Widget para OBS (bitácora 2026-11-10-widget-streamers-en-main): fuera de _app, sin barra ni menú y con el
// fondo transparente, porque va encima del juego. Público: OBS no inicia sesión.
export const Route = createFileRoute("/widget")({
  component: WidgetPage,
})
