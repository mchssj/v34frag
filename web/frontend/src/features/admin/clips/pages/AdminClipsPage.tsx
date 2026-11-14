import { useQuery } from "@tanstack/react-query"

import { canManageClips } from "@/auth/permissions"
import { useMe } from "@/auth/queries"

import { AdminHeader, AdminTabs } from "../../components/ui"
import { clipReviewOptions } from "../api/queries"
import { ListTab } from "../components/ListTab"
import { ReviewTab } from "../components/ReviewTab"
import { RulesTab } from "../components/RulesTab"
import { CLIP_TABS, SUPPORT_REPROCESS_MAX } from "../lib/clips"

export type ClipTab = (typeof CLIP_TABS)[number]

export function AdminClipsPage({
  tab,
  onTab,
}: {
  tab: ClipTab
  onTab: (t: ClipTab) => void
}) {
  // Soporte y moderador (replanteo 117; Daniel, 2026-11-14): la lista para reprocesar y Para revisar. Las reglas,
  // rechazar varios y recuperar son del admin.
  const admin = canManageClips(useMe().data?.role ?? "user")
  const review = useQuery(clipReviewOptions)
  const shown: ClipTab = tab === "rules" && !admin ? "list" : tab
  return (
    <section className="flex flex-col gap-5">
      <AdminHeader
        title="Clips"
        subtitle={
          admin
            ? "Las jugadas destacadas de cada mix: la lista para volver a grabar las que salieron mal, cuáles valen más y cuántas se muestran. Y los videos que se volvieron a grabar, que no salen en Discord hasta que digas que están bien."
            : `Las jugadas destacadas de cada mix. Si una salió mal, vuelve a grabarla con Reprocesar (hasta ${SUPPORT_REPROCESS_MAX} a la vez). El video nuevo no sale en Discord hasta que alguien lo revise en Para revisar.`
        }
      />
      <AdminTabs
        label="Secciones de Clips"
        value={shown}
        onChange={onTab}
        tabs={[
          { key: "list", label: "Clips" },
          { key: "review", label: "Para revisar", badge: review.data?.total },
          ...(admin ? [{ key: "rules" as const, label: "Reglas" }] : []),
        ]}
      />
      {shown === "list" ? (
        <ListTab reviewer={admin} />
      ) : shown === "review" ? (
        <ReviewTab />
      ) : (
        <RulesTab />
      )}
    </section>
  )
}
