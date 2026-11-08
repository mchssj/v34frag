import { createFileRoute } from "@tanstack/react-router"

import { VipListCard } from "@/features/profile/components/VipListCard"
import { PrivacySection } from "@/features/profile/pages/PrivacySection"

export const Route = createFileRoute("/_app/profile/privacy")({
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <div className="flex flex-col gap-4">
      <PrivacySection />
      <VipListCard />
    </div>
  )
}
