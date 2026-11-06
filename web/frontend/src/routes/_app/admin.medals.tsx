import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { AdminMedalsPage } from "@/features/admin/medals/pages/AdminMedalsPage"

export const Route = createFileRoute("/_app/admin/medals")({
  validateSearch: z.object({
    edit: z
      .union([z.literal("new"), z.uuid()])
      .optional()
      .catch(undefined),
  }),
  component: AdminMedalsRoute,
})

function AdminMedalsRoute() {
  const { edit } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AdminMedalsPage
      edit={edit}
      onEdit={(id) => void navigate({ search: { edit: id } })}
    />
  )
}
