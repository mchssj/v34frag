import { createFileRoute } from "@tanstack/react-router"

import { CardSection } from "@/features/card/pages/CardSection"

export const Route = createFileRoute("/_app/profile/card")({
  component: CardSection,
})
