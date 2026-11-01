import { z } from '@hono/zod-openapi';
import { AppError, fromPostgrest, type PostgrestLikeError } from './errors';

type Res = { data: unknown; error: PostgrestLikeError | null };

/** Resultado de supabase-js: los datos, o el error traducido. */
export const must = <R extends Res>(r: R): R['data'] => {
  if (r.error) throw fromPostgrest(r.error);
  return r.data;
};

/** Listados, inserts con .select() y RPC que siempre devuelven algo: sin error, hay datos. */
export const mustHave = <R extends Res>(r: R): NonNullable<R['data']> => {
  const d = must(r);
  if (d === null || d === undefined) throw new AppError(500, 'INTERNAL', 'Supabase no devolvió datos.');
  return d as NonNullable<R['data']>;
};

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `No existe ${what}.`);

// ---------- paginado ----------

export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({ description: 'Página, desde 1' }),
  per: z.coerce.number().int().min(1).max(100).default(20).openapi({ description: 'Elementos por página (máximo 100)' }),
});

/** Rango para .range(): de `from` a `to` inclusive. */
export const pageRange = ({ page, per }: { page: number; per: number }) => ({ from: (page - 1) * per, to: page * per - 1 });

// ---------- búsqueda ----------

/**
 * Normaliza el texto buscado como search_norm() de la base: minúsculas y sin tildes. Saca los caracteres que
 * PostgREST o LIKE interpretan (%, _, *, comas, paréntesis, barra invertida). Vacío = sin filtro.
 */
export function searchTerm(q: string | undefined): string | null {
  const v = (q ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[%_*,()\\"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return v ? v : null;
}

// ---------- nivel ----------

/** ELO desde el que empieza cada nivel (1 a 10), como la web vieja. */
export const LEVEL_FLOORS = [0, 501, 751, 901, 1051, 1201, 1351, 1531, 1751, 2001] as const;

/** Rango de ELO de un filtro de nivel (`10`, `7-9` o `1-6`): nivel 7 empieza en LEVEL_FLOORS[6] y el 10 en LEVEL_FLOORS[9]. */
export function levelBounds(level: '10' | '7-9' | '1-6' | undefined): { gte?: number; lt?: number } {
  if (level === '10') return { gte: LEVEL_FLOORS[9] };
  if (level === '7-9') return { gte: LEVEL_FLOORS[6], lt: LEVEL_FLOORS[9] };
  if (level === '1-6') return { lt: LEVEL_FLOORS[6] };
  return {};
}

export function levelOf(elo: number | null | undefined): number | null {
  if (elo === null || elo === undefined) return null;
  let level = 1;
  for (let i = 1; i < LEVEL_FLOORS.length; i++) if (elo >= LEVEL_FLOORS[i]!) level = i + 1;
  return level;
}
