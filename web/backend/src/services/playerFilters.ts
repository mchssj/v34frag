import { z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { boolParam } from '../lib/list';
import type { AppEnv } from '../lib/types';
import { requireVip } from './vip';

// Filtros avanzados del ranking de jugadores (replanteo 141, bitácora 2026-11-24-exportar-stats-y-buscador-vip): los mismos en
// el Histórico y en cada temporada. Son VIP; el texto, el nivel y el orden siguen siendo para todos.

const min = (max: number, description: string) => z.coerce.number().min(0).max(max).optional().openapi({ description });

export const playerFilterShape = {
  elo_min: z.coerce.number().int().min(0).optional().openapi({ description: 'VIP' }),
  elo_max: z.coerce.number().int().min(0).optional().openapi({ description: 'VIP. Inclusive' }),
  kd_min: min(20, 'VIP'),
  rating_min: min(20, 'VIP'),
  hs_min: min(100, 'VIP. Porcentaje, de todas sus partidas'),
  matches_min: z.coerce.number().int().min(0).optional().openapi({ description: 'VIP. Partidas terminadas (en una temporada, sus mixes)' }),
  active_days: z.coerce.number().int().min(1).max(365).optional().openapi({ description: 'VIP. Jugó en los últimos N días' }),
  map: z.string().trim().min(1).max(40).optional().openapi({ description: 'VIP. Mapa más jugado en mixes, sin el prefijo (`dust2_ob`)' }),
  country: z.string().trim().min(1).max(60).optional().openapi({ description: 'VIP. Un perfil privado no aparece' }),
  has_team: boolParam('VIP. Con o sin equipo oficial'),
  vip: boolParam('VIP. Solo los VIP, o solo los que no lo son'),
};
const Filters = z.object(playerFilterShape);
type Filters = z.infer<typeof Filters>;
const KEYS = Object.keys(playerFilterShape) as (keyof Filters)[];

/** Lo que se agrega a cada fila con un filtro avanzado. */
export const foundShape = {
  hs: z.number().nullable().openapi({ description: 'HS % de todas sus partidas. Solo viene con un filtro avanzado' }),
  last_played_at: z.string().nullable().openapi({ description: 'Su última partida. Solo viene con un filtro avanzado' }),
};
export const FOUND = 'hs, last_played_at';
export type FoundRow = { hs?: number | null; last_played_at?: string | null };
export const toFound = (r: FoundRow) => ({ hs: r.hs === null || r.hs === undefined ? null : Number(r.hs), last_played_at: r.last_played_at ?? null });

/** Si la consulta trae algún filtro avanzado; exige VIP (401 sin sesión, 403 sin VIP). */
export async function wantsPlayerFilters(c: Context<AppEnv>, p: Filters): Promise<boolean> {
  if (!KEYS.some((k) => p[k] !== undefined)) return false;
  await requireVip(c, 'Los filtros avanzados son para los VIP.');
  return true;
}

// Lo mínimo de un query builder de PostgREST que hace falta para filtrar.
interface Filterable<Q> {
  gte(column: string, value: unknown): Q;
  lte(column: string, value: unknown): Q;
  eq(column: string, value: unknown): Q;
}

/** `matches`: la columna de las partidas en esa vista. */
export function applyPlayerFilters<Q extends Filterable<Q>>(query: Q, p: Filters, matches: string): Q {
  let q = query;
  if (p.elo_min !== undefined) q = q.gte('elo', p.elo_min);
  if (p.elo_max !== undefined) q = q.lte('elo', p.elo_max);
  if (p.kd_min !== undefined) q = q.gte('kd', p.kd_min);
  if (p.rating_min !== undefined) q = q.gte('rating', p.rating_min);
  if (p.hs_min !== undefined) q = q.gte('hs', p.hs_min);
  if (p.matches_min !== undefined) q = q.gte(matches, p.matches_min);
  if (p.active_days !== undefined) q = q.gte('last_played_at', new Date(Date.now() - p.active_days * 86_400_000).toISOString());
  if (p.map) q = q.eq('fav_map', p.map.replace(/^(de|cs)_/i, '').toLowerCase());
  if (p.country) q = q.eq('country', p.country);
  if (p.has_team !== undefined) q = q.eq('has_team', p.has_team);
  if (p.vip !== undefined) q = q.eq('vip', p.vip);
  return q;
}
