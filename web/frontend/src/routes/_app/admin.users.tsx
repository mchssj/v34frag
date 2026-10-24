import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/admin/users")({
  component: AdminUsersPage,
})

function AdminUsersPage() {
  return <Placeholder title="Usuarios y moderación" />
}
