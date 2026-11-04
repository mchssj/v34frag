import { createFileRoute } from "@tanstack/react-router"

import { AccountSection } from "@/features/profile/pages/AccountSection"

export const Route = createFileRoute("/_app/profile/account")({
  component: AccountSection,
})
