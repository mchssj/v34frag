import { createFileRoute } from "@tanstack/react-router"

import { LinkSection } from "@/features/profile/pages/LinkSection"

export const Route = createFileRoute("/_app/profile/link")({
  component: LinkSection,
})
