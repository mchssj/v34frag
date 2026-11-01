import { createFileRoute } from "@tanstack/react-router"

import { RegisterFlow } from "@/features/auth/register/RegisterFlow"

export const Route = createFileRoute("/_auth/register")({
  component: RegisterFlow,
})
