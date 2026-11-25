import { useQuery } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"

import { mapsOptions } from "@/features/maps/api/queries"
import { COUNTRIES } from "@/features/profile/lib/schemas"
import {
  SelectField,
  SliderField,
  SwitchField,
} from "@/features/search/components/fields"
import {
  FilterPanel,
  FilterPills,
  FilterToggle,
  SavedSearches,
} from "@/features/search/components/FilterPanel"
import { bareMap } from "@/features/search/lib/search"
import { ELO_MAX, playerChips, type PlayerFilters } from "../lib/filters"
import { savedRanking, type PlayerRankingSearch } from "../lib/search"

// Barra de arriba de las dos tablas del ranking de jugadores (temporada e Histórico), con los filtros avanzados (VIP, bitácora
// 2026-11-24-exportar-stats-y-buscador-vip).

type Patch = Partial<PlayerRankingSearch>

export function RankingToolbar({
  search,
  onChange,
  vip,
  total,
  seasonal = false,
  children,
}: {
  search: PlayerRankingSearch
  onChange: (patch: Patch) => void
  vip: boolean
  total: number | undefined
  /** En una temporada, las stats de la tabla son solo las de esa temporada. */
  seasonal?: boolean
  /** Los filtros para todos. */
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const chips = playerChips(search)
  // Cambiar un filtro vuelve a la primera página.
  const set = (p: Patch) => onChange({ ...p, page: undefined })
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        {children}
        <FilterToggle
          open={open}
          onOpen={setOpen}
          count={chips.length}
          vip={vip}
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {total === undefined
            ? ""
            : `${total} ${total === 1 ? "jugador" : "jugadores"}`}
        </span>
      </div>
      {open && (
        <FilterPanel
          vip={vip}
          lock="Los filtros avanzados y las búsquedas guardadas son para los VIP. Buscar, el nivel y el orden son para todos."
        >
          <Fields s={search} set={set} seasonal={seasonal} />
        </FilterPanel>
      )}
      <FilterPills
        chips={chips}
        vip={vip}
        onClear={(keys) =>
          set(Object.fromEntries(keys.map((k) => [k, undefined])))
        }
      />
      <SavedSearches
        kind="players"
        vip={vip}
        current={savedRanking.save(search)}
        onApply={(query) => onChange(savedRanking.apply(query))}
      />
    </>
  )
}

function Fields({
  s,
  set,
  seasonal,
}: {
  s: PlayerFilters
  set: (p: Patch) => void
  seasonal: boolean
}) {
  const maps = useQuery(mapsOptions).data ?? []
  const names = [...new Set(maps.map((m) => bareMap(m.name)))].sort()
  return (
    <>
      <SliderField
        label="Nivel"
        min={1}
        max={10}
        step={1}
        value={[s.lvMin ?? 1, s.lvMax ?? 10]}
        format={([a, b]) => `${a} a ${b}`}
        onCommit={([a, b]) =>
          set({
            lvMin: a === 1 ? undefined : a,
            lvMax: b === 10 ? undefined : b,
            // Reemplaza al nivel de los botones.
            level: undefined,
          })
        }
      />
      <SliderField
        label="ELO"
        min={0}
        max={ELO_MAX}
        step={50}
        value={[s.eloMin ?? 0, s.eloMax ?? ELO_MAX]}
        format={([a, b]) => `${a} a ${b === ELO_MAX ? "más" : b}`}
        onCommit={([a, b]) =>
          set({ eloMin: a || undefined, eloMax: b === ELO_MAX ? undefined : b })
        }
      />
      <SliderField
        label="K/D mínimo"
        min={0}
        max={2}
        step={0.05}
        value={[s.kd ?? 0]}
        format={([v]) => (v ? v.toFixed(2) : "cualquiera")}
        onCommit={([v]) => set({ kd: v || undefined })}
      />
      <SliderField
        label="Rating mínimo"
        min={0}
        max={2}
        step={0.05}
        value={[s.rt ?? 0]}
        format={([v]) => (v ? v.toFixed(2) : "cualquiera")}
        onCommit={([v]) => set({ rt: v || undefined })}
      />
      <SliderField
        label="HS % mínimo"
        min={0}
        max={75}
        step={1}
        value={[s.hs ?? 0]}
        format={([v]) => (v ? `${v} %` : "cualquiera")}
        onCommit={([v]) => set({ hs: v || undefined })}
      />
      <SliderField
        label={seasonal ? "Mixes de la temporada" : "Partidas jugadas"}
        min={0}
        max={200}
        step={5}
        value={[s.mx ?? 0]}
        format={([v]) => (v ? `${v} o más` : "cualquiera")}
        onCommit={([v]) => set({ mx: v || undefined })}
      />
      <SelectField
        label="Jugó en los últimos"
        value={s.act ? String(s.act) : undefined}
        options={[7, 30, 90].map((d) => ({
          value: String(d),
          label: `${d} días`,
        }))}
        onChange={(v) =>
          set({ act: v ? (Number(v) as 7 | 30 | 90) : undefined })
        }
      />
      <SelectField
        label="Mapa más jugado"
        value={s.fav}
        options={names.map((n) => ({ value: n, label: n }))}
        onChange={(v) => set({ fav: v })}
      />
      <SelectField
        label="País"
        value={s.ct}
        options={COUNTRIES.map((c) => ({ value: c, label: c }))}
        onChange={(v) => set({ ct: v })}
      />
      <SelectField
        label="Equipo"
        value={s.team}
        options={[
          { value: "with", label: "Con equipo" },
          { value: "without", label: "Sin equipo" },
        ]}
        onChange={(v) => set({ team: v as PlayerFilters["team"] })}
      />
      <SwitchField
        label="Solo VIP"
        checked={!!s.vip}
        onChange={(v) => set({ vip: v || undefined })}
      />
      {seasonal && (
        <p className="self-end text-xs text-pretty text-muted-foreground">
          El ELO, el K/D, el rating y los mixes son los de la temporada; el HS %
          y el mapa, de todas sus partidas.
        </p>
      )}
    </>
  )
}
