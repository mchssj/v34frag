import type { MapEntry } from "@/features/maps/queries"

// Borrador del catálogo de Administración › Mapas: lo que se manda entero con PUT /admin/maps.
// La foto no está acá: se sube o se quita aparte, al momento.

export type DraftMap = {
  name: string
  versions: string[]
  active: boolean
  mixes: boolean
  veto_default: boolean
}

export const MAP_NAME = /^[a-z0-9_]{2,40}$/
export const MAX_VERSIONS = 5
export const MIN_DEFAULT_POOL = 2
export const MAP_IMAGE_MAX_BYTES = 2 * 1024 * 1024
export const MAP_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

export function fromCatalog(maps: MapEntry[]): DraftMap[] {
  return [...maps]
    .sort((a, b) => a.position - b.position)
    .map((m) => ({
      name: m.name,
      versions: m.versions.length ? [...m.versions] : [m.name],
      active: m.active,
      mixes: m.mixes,
      veto_default: m.veto_default,
    }))
}

/** Un retirado nunca sale en Mixes ni en el pool por defecto. */
export const inMixes = (m: DraftMap) => m.active && m.mixes
export const inDefaultPool = (m: DraftMap) => m.active && m.veto_default

export function toBody(draft: DraftMap[]) {
  return {
    maps: draft.map((m) => ({
      name: m.name,
      versions: m.versions,
      active: m.active,
      mixes: inMixes(m),
      veto_default: inDefaultPool(m),
    })),
  }
}

/** Mapas que cambiaron (o se movieron) respecto de lo guardado. */
export function changedCount(draft: DraftMap[], saved: DraftMap[]): number {
  return draft.filter((m, i) => {
    const j = saved.findIndex((s) => s.name === m.name)
    return j !== i || JSON.stringify(saved[j]) !== JSON.stringify(m)
  }).length
}

export type CatalogStats = {
  mixes: number
  defaultPool: number
  noPhoto: number
  retired: number
}

export function catalogStats(
  draft: DraftMap[],
  hasPhoto: (name: string) => boolean
): CatalogStats {
  return {
    mixes: draft.filter(inMixes).length,
    defaultPool: draft.filter(inDefaultPool).length,
    noPhoto: draft.filter((m) => !hasPhoto(m.name)).length,
    retired: draft.filter((m) => !m.active).length,
  }
}

/** Por qué no se puede guardar, o null. */
export function saveError(draft: DraftMap[]): string | null {
  return draft.filter(inDefaultPool).length < MIN_DEFAULT_POOL
    ? `El pool por defecto necesita al menos ${MIN_DEFAULT_POOL} mapas.`
    : null
}

const taken = (draft: DraftMap[], v: string) =>
  draft.some((m) => m.versions.includes(v))

/** Error de una versión nueva para ese mapa, o null. */
export function versionError(
  draft: DraftMap[],
  map: DraftMap,
  v: string
): string | null {
  if (!MAP_NAME.test(v))
    return "Solo minúsculas, números y guion bajo (2 a 40)."
  if (taken(draft, v)) return "Esa versión ya es de un mapa."
  if (map.versions.length >= MAX_VERSIONS)
    return `Hasta ${MAX_VERSIONS} versiones por mapa.`
  return null
}

/** Error del nombre de un mapa nuevo, o null. */
export function newMapError(draft: DraftMap[], name: string): string | null {
  if (!MAP_NAME.test(name))
    return "Solo minúsculas, números y guion bajo (2 a 40)."
  if (taken(draft, name))
    return "Ese mapa ya está en el catálogo (o es una versión de otro)."
  return null
}

export function moveMap(draft: DraftMap[], i: number, d: -1 | 1): DraftMap[] {
  const j = i + d
  if (j < 0 || j >= draft.length) return draft
  const next = [...draft]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/** Retirar lo saca de Mixes y del pool por defecto; volver a ponerlo disponible no los prende. */
export function setActive(m: DraftMap, active: boolean): DraftMap {
  return active
    ? { ...m, active }
    : { ...m, active, mixes: false, veto_default: false }
}

/** Error de la foto elegida, o null. */
export function imageError(file: File): string | null {
  if (!MAP_IMAGE_TYPES.includes(file.type))
    return "Tiene que ser JPG, PNG o WebP."
  if (file.size > MAP_IMAGE_MAX_BYTES) return "La foto pesa más de 2 MB."
  return null
}
