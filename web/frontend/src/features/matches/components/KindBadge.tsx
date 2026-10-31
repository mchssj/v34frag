import { type MatchKind } from "../lib/search"
import { Badge } from "@/components/ui/badge"

export const KIND_LABEL: Record<MatchKind, string> = {
  mix: "Mix",
  pcw: "PCW",
  official: "Torneo",
}

// ---------- Tabla ----------

export function KindBadge({ kind }: { kind: MatchKind }) {
  return (
    <Badge variant="soft" shape="tag" size="sm" className="text-inherit">
      {KIND_LABEL[kind]}
    </Badge>
  )
}
