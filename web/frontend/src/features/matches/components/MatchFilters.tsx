import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { SearchIcon, UserCheckIcon } from "lucide-react"
import { useEffect, useState } from "react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Toggle } from "@/components/ui/toggle"
import { mapsOptions } from "@/features/maps/api/queries"
import type { MapEntry } from "@/features/maps/types"
import { Soon } from "@/features/teams/components/ui"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { KINDS, type MatchesSearch } from "../lib/search"
import { KIND_LABEL } from "./KindBadge"

// Listado /matches: mixes, PCW y torneos juntos (bitácora 2026-10-30-partidas-unificadas). Los
// filtros, la página y el tamaño viven en la URL. Los mixes en juego salen de /mixes, porque
// /matches no los trae.

export type Patch = Partial<MatchesSearch>

// ---------- Filtros ----------

const ALL_MAPS = "__all"

/** Mapas del select: los activos del catálogo, en su orden. */
function mapNames(maps: MapEntry[] | undefined): string[] {
  return (maps ?? [])
    .filter((m) => m.active)
    .sort((a, b) => a.position - b.position)
    .map((m) => m.name)
}

export function Filters({
  search,
  onChange,
}: {
  search: MatchesSearch
  onChange: (patch: Patch) => void
}) {
  const [q, setQ] = useState(search.q ?? "")
  const debounced = useDebouncedValue(q, 300)
  const maps = mapNames(useQuery(mapsOptions).data)

  // El texto escrito pasa a la URL con debounce; si la URL cambia por otro lado, se sincroniza.
  useEffect(() => {
    if ((debounced.trim() || undefined) !== search.q)
      onChange({ q: debounced.trim() || undefined, page: undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia el texto
  }, [debounced])
  const [urlQ, setUrlQ] = useState(search.q)
  if (search.q !== urlQ) {
    setUrlQ(search.q)
    if ((q.trim() || undefined) !== search.q) setQ(search.q ?? "")
  }

  const dashed =
    "h-8 gap-1.5 border border-dashed px-2.5 text-[13px] font-normal hover:bg-accent data-[state=on]:bg-accent"

  return (
    <div className="flex flex-wrap items-center gap-2 border-b p-3">
      <div role="group" aria-label="Tipo" className="flex flex-wrap gap-1">
        {[undefined, ...KINDS].map((k) => (
          <button
            key={k ?? "all"}
            type="button"
            aria-pressed={search.kind === k}
            onClick={() => onChange({ kind: k, page: undefined })}
            className={cn(
              "h-7 rounded-full border px-2.5 text-xs font-medium transition-colors",
              search.kind === k
                ? "border-foreground bg-foreground text-background"
                : "hover:bg-muted"
            )}
          >
            {k ? KIND_LABEL[k] : "Todas"}
          </button>
        ))}
      </div>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <InputGroup className="max-w-[300px] min-w-[200px] flex-1">
        <InputGroupAddon>
          <SearchIcon aria-hidden className="size-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          // Los nicks llegan con el pedido E18 (hoy /matches busca en equipos, bandos y torneo).
          placeholder="Equipo, bando o torneo"
          aria-label="Buscar partidas"
          className="text-[13px]"
        />
      </InputGroup>
      {/* Sale del catálogo de mapas; si viene vacío, no hay select. */}
      {maps.length > 0 && (
        <Select
          value={search.map ?? ALL_MAPS}
          onValueChange={(v) =>
            onChange({ map: v === ALL_MAPS ? undefined : v, page: undefined })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label="Mapa"
            className="h-8 text-[13px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_MAPS}>Todos los mapas</SelectItem>
            {maps.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {/* Pedidos E15 (mine) y E14 (varios estados): hasta entonces, deshabilitados. */}
      <Soon label="Solo donde jugué · Próximamente">
        <Toggle disabled className={dashed}>
          <UserCheckIcon aria-hidden className="size-3.5" />
          Solo donde jugué
        </Toggle>
      </Soon>
      <Soon label="Ocultar canceladas · Próximamente">
        <Toggle disabled className={dashed}>
          Ocultar canceladas
        </Toggle>
      </Soon>
    </div>
  )
}
