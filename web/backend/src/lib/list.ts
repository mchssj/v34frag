import { z } from '@hono/zod-openapi';
import { must } from './db';
import type { PostgrestLikeError } from './errors';

// Convención de todos los listados (plan docs/bitacora/2026-10-15-get-paginacion-filtros):
//   ?page=1&per=20&sort=<campo>&order=asc|desc + filtros propios de cada endpoint.
// La base pagina, filtra y ordena; la respuesta es siempre { items, total, page, per, sort, order }.

export type Order = 'asc' | 'desc';

/**
 * Esquema de la consulta de un listado: page, per, sort (lista cerrada) y order, con sus valores por defecto.
 * Se extiende con los filtros del endpoint.
 */
export function listQuery<const S extends readonly [string, ...string[]]>(sorts: S, def: { sort: S[number]; order: Order }, maxPer = 100) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1).openapi({ description: 'Página, desde 1' }),
    per: z.coerce.number().int().min(1).max(maxPer).default(20).openapi({ description: `Elementos por página (máximo ${maxPer})` }),
    sort: z.enum(sorts).default(def.sort as S[number]).openapi({ description: `Campo de orden: ${sorts.map((s) => `\`${s}\``).join(', ')}` }),
    order: z.enum(['asc', 'desc']).default(def.order).openapi({ description: '`asc` o `desc`' }),
  });
}

/** Sobre de la respuesta de un listado. */
export const Envelope = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().openapi({ description: 'Total con los filtros aplicados' }),
    page: z.number().int(),
    per: z.number().int(),
    sort: z.string(),
    order: z.enum(['asc', 'desc']),
  });

/** Filtro booleano por query string: "true" o "false". */
export const boolParam = (description: string) =>
  z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional()
    .openapi({ type: 'string', enum: ['true', 'false'], description });

/** Fecha u hora ISO 8601 para filtros `from` y `to`. */
export const dateParam = (description: string) =>
  z.union([z.iso.datetime({ offset: true }), z.iso.date()]).optional().openapi({ description });

type Params = { page: number; per: number; sort: string; order: Order };

// Lo mínimo de un query builder de PostgREST que hace falta para ordenar y paginar.
interface Orderable<Q> {
  order(column: string, opts: { ascending: boolean; nullsFirst?: boolean }): Q;
  range(from: number, to: number): PromiseLike<{ data: unknown; error: PostgrestLikeError | null; count: number | null }>;
}

/**
 * Ordena (con desempate estable) y pagina una consulta hecha con `{ count: 'exact' }`.
 * `columns` traduce cada valor de `sort` a una o más columnas; los nulos van al final.
 */
export async function runList<Row, Q extends Orderable<Q>>(
  query: Q,
  p: Params,
  columns: Record<string, string | string[]>,
  tiebreak: string | null = 'id',
): Promise<{ rows: Row[]; total: number }> {
  let q = query;
  const asc = p.order === 'asc';
  for (const spec of ([] as string[]).concat(columns[p.sort] ?? p.sort)) {
    // `col:desc` / `col:asc`: dirección fija, sin importar `order` (desempates que no se invierten).
    const [col, fixed] = spec.split(':') as [string, string?];
    q = q.order(col, { ascending: fixed ? fixed === 'asc' : asc, nullsFirst: false });
  }
  if (tiebreak) q = q.order(tiebreak, { ascending: true });
  const from = (p.page - 1) * p.per;
  const res = await q.range(from, from + p.per - 1);
  if (res.error) must({ data: null, error: res.error });
  return { rows: (res.data ?? []) as Row[], total: res.count ?? 0 };
}

export const envelope = <T>(items: T[], total: number, p: Params) => ({
  items,
  total,
  page: p.page,
  per: p.per,
  sort: p.sort,
  order: p.order,
});
