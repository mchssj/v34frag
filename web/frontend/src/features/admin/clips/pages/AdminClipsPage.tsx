import { useQuery } from "@tanstack/react-query"

import { AdminHeader, AdminTabs } from "../../components/ui"
import { clipReviewOptions } from "../api/queries"
import { ListTab } from "../components/ListTab"
import { ReviewTab } from "../components/ReviewTab"
import { RulesTab } from "../components/RulesTab"
import { CLIP_TABS } from "../lib/clips"

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
        subtitle="Las jugadas destacadas de cada mix: la lista para volver a grabar las que salieron mal, cuáles valen más y cuántas se muestran. Y los videos que se volvieron a grabar, que no salen en Discord hasta que digas que están bien."
      />
      <AdminTabs
        label="Secciones de Clips"
        value={tab}
        onChange={onTab}
        tabs={[
          { key: "list", label: "Clips" },
          { key: "review", label: "Para revisar", badge: review.data?.total },
          { key: "rules", label: "Reglas" },
        ]}
      />
      {tab === "list" ? (
        <ListTab />
      ) : tab === "review" ? (
        <ReviewTab />
      ) : (
        <RulesTab />
      )}
    </section>
  )
}
