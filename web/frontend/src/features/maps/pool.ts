import type { MapEntry } from "./queries"

// Pool de mapas de un torneo o una PCW (`map_pool`; null = el pool por defecto). Reglas de
// map_pool_check: entre el BO más alto y 20 mapas, sin repetir, y solo disponibles (uno que se
// retiró después de guardarlo se conserva).

export const MAX_POOL = 20

const byPosition = (a: MapEntry, b: MapEntry) => a.position - b.position

/** El pool por defecto del veto, en el orden del catálogo. */
export function defaultPool(maps: MapEntry[]): string[] {
  return maps
    .filter((m) => m.active && m.veto_default)
    .sort(byPosition)
    .map((m) => m.name)
}

/** Mapas que se pueden marcar: los disponibles y los retirados que ya están en el pool. */
export function poolChoices(maps: MapEntry[], value: string[]): MapEntry[] {
  return maps.filter((m) => m.active || value.includes(m.name)).sort(byPosition)
}

/** Por qué el pool no sirve para ese BO, o null. */
export function poolError(
  value: string[] | null,
  maps: MapEntry[],
  minMaps: number
): string | null {
  const count = value === null ? defaultPool(maps).length : value.length
  if (count >= minMaps && count <= MAX_POOL) return null
  if (count > MAX_POOL) return `Hasta ${MAX_POOL} mapas.`
  return value === null
    ? `El pool por defecto tiene ${count} mapas y el BO${minMaps} necesita ${minMaps}. Elige los mapas.`
    : `Faltan mapas: con BO${minMaps} hacen falta al menos ${minMaps}.`
}
