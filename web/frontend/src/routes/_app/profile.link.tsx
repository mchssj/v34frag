import { createFileRoute } from "@tanstack/react-router"

import { LinkSection } from "@/features/profile/sections/LinkSection"

export const Route = createFileRoute("/_app/profile/link")({
  component: LinkSection,
})
