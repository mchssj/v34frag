import type { MapEntry } from "../types"

/** Mapas del select de Mixes: disponibles y marcados para Mixes, en el orden del catálogo. */
export function mixMapNames(maps: MapEntry[] | undefined): string[] {
  return (maps ?? [])
    .filter((m) => m.active && m.mixes)
    .sort((a, b) => a.position - b.position)
    .map((m) => m.name)
}

// La base guarda el mapa de la partida sin el prefijo (ingest_match: "de_mirage_rc1" -> "mirage_rc1")
// y el catálogo lo tiene completo, así que se comparan sin él.
const mapKey = (name: string) => name.toLowerCase().replace(/^(de|cs)_/, "")

/**
 * Mapa del catálogo de un mapa jugado: lo busca entre las versiones de cada mapa, sin distinguir
 * mayúsculas ni el prefijo de_/cs_.
 */
export function mapEntryOf(
  maps: MapEntry[] | undefined,
  name: string | null | undefined
): MapEntry | null {
  if (!name) return null
  const key = mapKey(name)
  return (
    maps?.find((m) => [m.name, ...m.versions].some((v) => mapKey(v) === key)) ??
    null
  )
}

/** Foto del mapa jugado (la del mapa del catálogo, para todas sus versiones). */
export function mapImage(
  maps: MapEntry[] | undefined,
  name: string | null | undefined
): string | null {
  return mapEntryOf(maps, name)?.image_url ?? null
}
