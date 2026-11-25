import {
  DateField,
  PlayerField,
  SelectField,
  SliderField,
  SwitchField,
} from "@/features/search/components/fields"
import { FilterPanel } from "@/features/search/components/FilterPanel"
import { DIFF_MAX, type MatchesSearch } from "../lib/search"

/** Filtros avanzados de Partidas (VIP). */
export function MatchAdvancedFilters({
  s,
  vip,
  set,
}: {
  s: MatchesSearch
  vip: boolean
  set: (patch: Partial<MatchesSearch>) => void
}) {
  return (
    <FilterPanel
      vip={vip}
      lock="Los filtros avanzados y las búsquedas guardadas son para los VIP. El tipo, la búsqueda y el mapa son para todos."
    >
      <PlayerField
        label="Jugador"
        value={s.player}
        taken={[s.with, s.vs]}
        onChange={(player) =>
          set(player ? { player } : { player, with: undefined, vs: undefined })
        }
      />
      <PlayerField
        label="Con (mismo bando)"
        value={s.with}
        disabled={!s.player}
        placeholder={s.player ? "Elegir jugador" : "Elige primero el jugador"}
        taken={[s.player, s.vs]}
        onChange={(v) => set({ with: v })}
      />
      <PlayerField
        label="Contra (otro bando)"
        value={s.vs}
        disabled={!s.player}
        placeholder={s.player ? "Elegir jugador" : "Elige primero el jugador"}
        taken={[s.player, s.with]}
        onChange={(v) => set({ vs: v })}
      />
      <SelectField
        label="Orden"
        anyLabel="Las más nuevas"
        value={s.sort}
        options={[
          { value: "close", label: "Las más parejas" },
          { value: "mvp", label: "Mejor MVP" },
        ]}
        onChange={(v) => set({ sort: v as MatchesSearch["sort"] })}
      />
      <DateField
        label="Desde"
        value={s.from}
        onChange={(v) => set({ from: v })}
      />
      <DateField label="Hasta" value={s.to} onChange={(v) => set({ to: v })} />
      <SliderField
        label="Diferencia de rondas"
        min={1}
        max={DIFF_MAX}
        step={1}
        value={[s.diff ?? DIFF_MAX]}
        format={([v]) => (v === DIFF_MAX ? "cualquiera" : `hasta ${v}`)}
        onCommit={([v]) => set({ diff: v === DIFF_MAX ? undefined : v })}
      />
      <SwitchField
        label="Solo con demo"
        checked={!!s.demo}
        onChange={(v) => set({ demo: v || undefined })}
      />
    </FilterPanel>
  )
}
