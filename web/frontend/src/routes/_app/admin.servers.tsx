import { createFileRoute } from "@tanstack/react-router"

import { Placeholder } from "@/features/shell/Placeholder"

export const Route = createFileRoute("/_app/admin/servers")({
  component: AdminServersPage,
})

function AdminServersPage() {
  return <Placeholder title="Servidores y ELO" />
}
