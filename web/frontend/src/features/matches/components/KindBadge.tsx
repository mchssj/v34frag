import { type MatchKind } from "../lib/search"

export const KIND_LABEL: Record<MatchKind, string> = {
  mix: "Mix",
  pcw: "PCW",
  official: "Torneo",
}

// ---------- Tabla ----------

export function KindBadge({ kind }: { kind: MatchKind }) {
  return (
    <span className="inline-flex h-5 w-fit items-center rounded-[4px] bg-secondary px-1.5 text-[11px] font-medium">
      {KIND_LABEL[kind]}
    </span>
  )
}
