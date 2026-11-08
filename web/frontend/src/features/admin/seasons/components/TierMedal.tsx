import { useQuery } from "@tanstack/react-query"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Medal } from "@/features/medals/Medal"
import { isProposal } from "@/features/medals/templates"
import { activeMedalsOptions } from "../../medals/api/queries"

// Medalla de un tramo de temporada (replanteo 79, plan sección 8): una definición de temporada en lugar de un emoji.
// La etiqueta de la vista previa dice el número de la temporada (S1, S2…).

export function TierMedal({
  definition,
  season,
  index,
  onChange,
}: {
  definition: string | null | undefined
  season: number
  index: number
  onChange: (definition: string | null) => void
}) {
  const defs = useQuery(activeMedalsOptions)
  const options = (defs.data ?? []).filter(
    (d) => d.aggregation === "season_rank"
  )
  const cur = options.find((d) => d.key === definition)

  return (
    <div className="flex items-center gap-2">
      {cur ? (
        <Medal
          look={{ ...cur.design, label: `S${season}` }}
          size={36}
          title={cur.title}
        />
      ) : (
        <span aria-hidden className="size-9 rounded-lg border border-dashed" />
      )}
      <Select
        value={definition ?? undefined}
        onValueChange={(v) => onChange(v)}
      >
        <SelectTrigger
          size="sm"
          aria-label={`Cambiar la medalla del tramo ${index + 1}`}
          className="w-[210px]"
        >
          <SelectValue placeholder="Cambiar medalla" />
        </SelectTrigger>
        <SelectContent>
          {options.map((d) => (
            <SelectItem key={d.id} value={d.key}>
              {d.title}
              {isProposal(d.design) ? " (sin diseño propio)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
