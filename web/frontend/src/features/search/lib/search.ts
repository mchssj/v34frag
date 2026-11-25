// Piezas comunes de los filtros avanzados (VIP) del ranking y de Partidas.

/** La base guarda el mapa sin el prefijo (`de_cache` → `cache`). */
export const bareMap = (name: string) => name.replace(/^(de|cs)_/i, "")

/** Una píldora por filtro activo y las claves que hay que borrar para sacarla. */
export type Chip<K extends string> = { label: string; clear: K[] }

/** Los filtros de una URL, sin página ni valores vacíos: lo que se guarda como búsqueda. */
export function savable(search: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(search).filter(
      ([k, v]) => k !== "page" && k !== "per" && v !== undefined
    )
  ) as Record<string, string | number | boolean>
}
