import { useQuery } from "@tanstack/react-query"

import { AdminHeader, AdminTabs } from "../ui"
import { clipReviewOptions } from "./queries"
import { ReviewTab } from "./ReviewTab"
import { RulesTab } from "./RulesTab"

export const CLIP_TABS = ["review", "rules"] as const
export type ClipTab = (typeof CLIP_TABS)[number]

export function AdminClipsPage({
  tab,
  onTab,
}: {
  tab: ClipTab
  onTab: (t: ClipTab) => void
}) {
  const review = useQuery(clipReviewOptions)
  return (
    <section className="flex flex-col gap-5">
      <AdminHeader
        title="Clips"
        subtitle="Las jugadas destacadas de cada mix: cuáles valen más y cuántas se muestran. Y los videos que se volvieron a grabar, que no salen en Discord hasta que digas que están bien."
      />
      <AdminTabs
        label="Secciones de Clips"
        value={tab}
        onChange={onTab}
        tabs={[
          { key: "review", label: "Para revisar", badge: review.data?.total },
          { key: "rules", label: "Reglas" },
        ]}
      />
      {tab === "review" ? <ReviewTab /> : <RulesTab />}
    </section>
  )
}
