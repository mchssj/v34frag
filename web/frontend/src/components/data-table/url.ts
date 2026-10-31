import type { ServerSort } from "./useServerTable"

// Página, tamaño y orden de una tabla guardados en la búsqueda de la URL (`page`, `per`, `sort`,
// `order`). Los valores por defecto quedan fuera de la URL, y cambiar el tamaño o el orden vuelve a
// la página 1.

type PagingSearch<P extends number> = { page?: number; per?: P }

/** Props de página de `useServerTable` desde la URL. */
export function urlPaging<P extends number>(
  search: PagingSearch<P>,
  onChange: (patch: PagingSearch<P>) => void,
  defaultPer: P
) {
  return {
    page: search.page ?? 1,
    per: search.per ?? defaultPer,
    onPage: (p: number) => onChange({ page: p === 1 ? undefined : p }),
    onPer: (n: number) =>
      onChange({
        per: n === defaultPer ? undefined : (n as P),
        page: undefined,
      }),
  }
}

type SortSearch<K extends string> = {
  sort?: K
  order?: "asc" | "desc"
  page?: number
}

/** Props de orden de `useServerTable` desde la URL (descendente por defecto). */
export function urlSorting<K extends string>(
  search: SortSearch<K>,
  onChange: (patch: SortSearch<K>) => void,
  /** Valor de `sort` que es el orden por defecto (se ve activo sin estar en la URL). */
  defaultSort?: K
) {
  const sort: ServerSort =
    search.sort && search.sort !== defaultSort
      ? { id: search.sort, desc: search.order !== "asc" }
      : undefined
  return {
    sort,
    defaultSort,
    onSort: (s: ServerSort) =>
      onChange({
        sort: s?.id as K | undefined,
        order: s && !s.desc ? "asc" : undefined,
        page: undefined,
      }),
  }
}
