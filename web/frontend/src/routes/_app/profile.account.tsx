import { createFileRoute } from "@tanstack/react-router"

import { AccountSection } from "@/features/profile/sections/AccountSection"

export const Route = createFileRoute("/_app/profile/account")({
  component: AccountSection,
})
