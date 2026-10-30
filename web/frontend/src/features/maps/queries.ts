import { queryOptions } from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"

// Catálogo de mapas (contrato partidas.md y admin.md, replanteo 30). Trae también los retirados:
// una sala vieja necesita la foto de un mapa que ya no se elige. Cada mapa tiene sus versiones de
// servidor (Inferno: de_inferno y de_inferno_classic) y una sola foto para todas.

export type MapEntry = Schemas["MapItem"]

export const mapKeys = {
  all: ["maps"] as const,
}

export const mapsOptions = queryOptions({
  queryKey: mapKeys.all,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/maps", {
          params: { query: { include_inactive: "true", per: 100 } },
          signal,
        })
      )
    ).items,
  staleTime: 10 * 60_000,
})

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
