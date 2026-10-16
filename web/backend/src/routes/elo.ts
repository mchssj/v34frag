import { createRoute } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { isAdmin, optionalUser, requireAdmin, requireUser } from '../lib/auth';
import { must, searchTerm } from '../lib/db';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  EloConfig,
  EloConfigPut,
  EloPreview,
  EloSaved,
  EloValues,
  RecomputeBody,
  Recomputed,
  SimulateQuery,
  SimulationList,
} from '../schemas/elo';
import { ELO_DEFAULTS, preview, type EloConfig as Values } from '../services/elo';

// Configuración del ELO, vista previa, simulación y recálculo (plan docs/bitacora/2026-10-16-api-elo-config).
// El recálculo pide doble confirmación: el texto "estoy seguro" en `confirm`.

type C = Context<AppEnv>;
const COLUMNS = 'base, bonus_max, bonus_factor, elo_floor, start_elo, min_pct, full_pct, updated_at, updated_by';

async function readConfig(c: C) {
  const row = must(await c.var.sb.from('elo_config').select(COLUMNS).eq('id', 1).maybeSingle());
  if (!row) return { config: ELO_DEFAULTS, updated_at: null, updated_by: null as string | null };
  const { updated_at, updated_by, ...v } = row;
  return { config: { ...v, bonus_factor: Number(v.bonus_factor) } as Values, updated_at, updated_by };
}

/** Argumentos de elo_set_config y elo_simulate. */
const args = (v: Values) => ({
  p_base: v.base,
  p_bonus_max: v.bonus_max,
  p_bonus_factor: v.bonus_factor,
  p_floor: v.elo_floor,
  p_start_elo: v.start_elo,
  p_min_pct: v.min_pct,
  p_full_pct: v.full_pct,
});

const getConfig = createRoute({
  method: 'get', path: '/api/v1/elo/config', tags: ['ELO'], middleware: [optionalUser] as const,
  summary: 'Configuración del ELO',
  description: 'Los valores con los que se calcula el ELO de los mixes. Sin sesión. `updated_by` solo lo ve un admin.',
  responses: { 200: { description: 'Configuración', ...json(EloConfig) }, ...errorResponses(401) },
});
const putConfig = createRoute({
  method: 'put', path: '/api/v1/admin/elo/config', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar la configuración del ELO',
  description:
    'Vale para los mixes nuevos. Con `recompute: true` además recalcula todo el historial, y entonces pide `confirm: "estoy seguro"` ' +
    '(doble confirmación en el frontend).',
  request: { body: { required: true, ...json(EloConfigPut) } },
  responses: { 200: { description: 'Guardada', ...json(EloSaved) }, ...errorResponses(400, 401, 403) },
});
const recompute = createRoute({
  method: 'post', path: '/api/v1/admin/elo/recompute', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Recalcular el ELO de todos',
  description:
    'Vuelve a aplicar todos los mixes (y los ajustes manuales) en orden, con la configuración actual. ' +
    'Pide `confirm: "estoy seguro"` (doble confirmación en el frontend).',
  request: { body: { required: true, ...json(RecomputeBody) } },
  responses: { 200: { description: 'Recalculado', ...json(Recomputed) }, ...errorResponses(400, 401, 403) },
});
const previewRoute = createRoute({
  method: 'post', path: '/api/v1/admin/elo/preview', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Vista previa de una configuración',
  description: 'Ejemplos con los valores enviados (equipos parejos, rating alto y bajo, jugador nuevo, participación). No guarda nada ni toca la base.',
  request: { body: { required: true, ...json(EloValues) } },
  responses: { 200: { description: 'Ejemplos', ...json(EloPreview) }, ...errorResponses(400, 401, 403) },
});
const simulate = createRoute({
  method: 'post', path: '/api/v1/admin/elo/simulate', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Simular el recálculo',
  description:
    'Cómo quedaría cada jugador si se recalcula todo con los valores enviados. No guarda nada. ' +
    'Cada página vuelve a simular (con la cantidad de mixes de hoy, menos de un segundo).',
  request: { query: SimulateQuery, body: { required: true, ...json(EloValues) } },
  responses: { 200: { description: 'Jugadores', ...json(SimulationList) }, ...errorResponses(400, 401, 403) },
});

export const elo = createRouter()
  .openapi(getConfig, async (c) => {
    const r = await readConfig(c);
    let updatedBy = null;
    if (r.updated_by && (await isAdmin(c))) {
      const p = must(await c.var.sb.from('profiles').select('tag').eq('id', r.updated_by).maybeSingle());
      updatedBy = { id: r.updated_by, alias: p?.tag ?? null };
    }
    c.header('Cache-Control', 'no-store');
    return c.json({ config: r.config, updated_at: r.updated_at, updated_by: updatedBy }, 200);
  })
  .openapi(putConfig, async (c) => {
    const b = c.req.valid('json');
    const n = must(await c.var.sb.rpc('elo_set_config', { ...args(b.config), p_recompute: b.recompute }));
    return c.json({ config: (await readConfig(c)).config, recomputed: b.recompute ? (n ?? 0) : null }, 200);
  })
  .openapi(recompute, async (c) => {
    const n = must(await c.var.sb.rpc('elo_recompute_all'));
    return c.json({ recomputed: n ?? 0 }, 200);
  })
  .openapi(previewRoute, (c) => c.json(preview(c.req.valid('json')), 200))
  .openapi(simulate, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.rpc('elo_simulate', args(c.req.valid('json')), { count: 'exact' });
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    if (p.changed !== undefined) q = q.eq('changed', p.changed);
    type Row = { steam_id: string; player_id: string | null; name: string | null; elo_before: number | null; elo_after: number | null;
                 delta: number; matches_before: number; matches_after: number; changed: boolean };
    const { rows, total } = await runList<Row, typeof q>(q, p, {}, 'steam_id');
    return c.json(
      envelope(
        rows.map((r) => ({
          steam_id: r.steam_id, player_id: r.player_id, name: r.name, elo_before: r.elo_before, elo_after: r.elo_after,
          delta: r.delta, matches_before: r.matches_before, matches_after: r.matches_after, changed: r.changed,
        })),
        total,
        p,
      ),
      200,
    );
  });
