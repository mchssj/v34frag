import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

import { usePcwApi } from "@/features/pcw/api/usePcwApi"
import { PcwPage } from "@/features/pcw/pages/PcwPage"
import { VipDialog } from "@/features/vip/VipDialog"

// PCW (bitácora 2026-11-08-pcw-real): el tablón con ofertas, Mis PCW y la sala de la serie.
// ?sala=<id>: la sala de una PCW con los dos listos.
export const Route = createFileRoute("/_app/pcw")({
  validateSearch: (s: Record<string, unknown>): { sala?: string } =>
    typeof s.sala === "string" ? { sala: s.sala } : {},
  component: PcwRoute,
})

function PcwRoute() {
  const [vip, setVip] = useState(false)
  const model = usePcwApi(() => setVip(true))
  const { sala } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <>
      <PcwPage
        model={model}
        room={sala}
        onRoom={(id) => {
          void navigate({ search: id ? { sala: id } : {} })
          window.scrollTo({ top: 0 })
        }}
      />
      <VipDialog open={vip} onOpenChange={setVip} />
    </>
  )
}
