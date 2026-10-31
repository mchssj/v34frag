import { createFileRoute } from "@tanstack/react-router"

import { RegisterFlow } from "@/features/auth/pages/RegisterFlow"

export const Route = createFileRoute("/_auth/register")({
  component: RegisterFlow,
})
