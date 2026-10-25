import { queryOptions } from "@tanstack/react-query"

// Maestra de mapas: la gestiona el admin (nombre, activo y foto). Pendiente del backend
// (docs/PENDIENTES.md, sección 6). Mientras la API no la exponga, la lista viene vacía: Mixes
// oculta el select de mapas y el marcador de la sala sale liso. Al llegar el endpoint, solo cambia
// el queryFn (y MapEntry pasa a ser el tipo generado).

export type MapEntry = {
  name: string
  active: boolean
  image_url: string | null
}

export const mapKeys = {
  all: ["maps"] as const,
}

export const mapsOptions = queryOptions({
  queryKey: mapKeys.all,
  queryFn: async (): Promise<MapEntry[]> => [],
  staleTime: 10 * 60_000,
})

/** Mapas activos, por nombre, para los filtros. */
export function activeMapNames(maps: MapEntry[] | undefined): string[] {
  return (maps ?? [])
    .filter((m) => m.active)
    .map((m) => m.name)
    .sort((a, b) => a.localeCompare(b))
}

/** Foto del mapa en la maestra (sin distinguir mayúsculas), o null. */
export function mapImage(
  maps: MapEntry[] | undefined,
  name: string | null | undefined
): string | null {
  if (!name) return null
  const key = name.toLowerCase()
  return maps?.find((m) => m.name.toLowerCase() === key)?.image_url ?? null
}
