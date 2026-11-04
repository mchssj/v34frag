import { Badge } from "@/components/ui/badge"

type MatchKind = "mix" | "pcw" | "official"

export const KIND_LABEL: Record<MatchKind, string> = {
  mix: "Mix",
  pcw: "PCW",
  official: "Torneo",
}

/** Tipo de partida (Mix, PCW, Torneo) en etiqueta suave. */
export function KindBadge({ kind }: { kind: MatchKind }) {
  return (
    <Badge variant="soft" shape="tag" size="sm" className="text-inherit">
      {KIND_LABEL[kind]}
    </Badge>
  )
}
