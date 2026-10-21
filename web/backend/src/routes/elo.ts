import { createRoute } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { isAdmin, optionalUser, requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave, notFound, searchTerm } from '../lib/db';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  AdjustBody,
  AdjustmentIdParam,
  AdjustResult,
  AdminAdjustmentList,
  AdminAdjustmentQuery,
  EloConfig,
  EloConfigPut,
  EloPreview,
  EloSaved,
  EloValues,
  PlayerAdjustmentList,
  PlayerAdjustmentQuery,
  UndoBody,
} from '../schemas/elo';
import { IdParam } from '../schemas/players';
import { ELO_DEFAULTS, preview, type EloConfig as Values } from '../services/elo';

// Configuración del ELO y vista previa (plan docs/bitacora/2026-10-16-api-elo-config) y ajustes manuales de hasta 10 fichas
// (plan docs/bitacora/2026-10-21-ajustes-elo-admin). Desde la web ya no se recalcula ni se simula el historial.

type C = Context<AppEnv>;
const COLUMNS = 'base, bonus_max, bonus_factor, elo_floor, start_elo, min_pct, full_pct, updated_at, updated_by';

async function readConfig(c: C) {
  const row = must(await c.var.sb.from('elo_config').select(COLUMNS).eq('id', 1).maybeSingle());
  if (!row) return { config: ELO_DEFAULTS, updated_at: null, updated_by: null as string | null };
  const { updated_at, updated_by, ...v } = row;
  return { config: { ...v, bonus_factor: Number(v.bonus_factor) } as Values, updated_at, updated_by };
}

/** Argumentos de elo_set_config. */
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
  description: 'Vale para los mixes nuevos: no recalcula el historial. Para corregir a jugadores puntuales, `POST /admin/elo/adjustments`.',
  request: { body: { required: true, ...json(EloConfigPut) } },
  responses: { 200: { description: 'Guardada', ...json(EloSaved) }, ...errorResponses(400, 401, 403) },
});
const previewRoute = createRoute({
  method: 'post', path: '/api/v1/admin/elo/preview', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Vista previa de una configuración',
  description: 'Ejemplos con los valores enviados (equipos parejos, rating alto y bajo, jugador nuevo, participación). No guarda nada ni toca la base.',
  request: { body: { required: true, ...json(EloValues) } },
  responses: { 200: { description: 'Ejemplos', ...json(EloPreview) }, ...errorResponses(400, 401, 403) },
});
const adjustments = createRoute({
  method: 'get', path: '/api/v1/admin/elo/adjustments', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Ajustes manuales de ELO',
  description: 'Todos los ajustes, con la ficha, el cambio, el motivo y quién lo hizo.',
  request: { query: AdminAdjustmentQuery },
  responses: { 200: { description: 'Ajustes', ...json(AdminAdjustmentList) }, ...errorResponses(400, 401, 403) },
});
const adjust = createRoute({
  method: 'post', path: '/api/v1/admin/elo/adjustments', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Ajustar el ELO',
  description:
    'Suma o resta (`delta`) o fija (`set_elo`) el ELO de 1 a 10 fichas, con un motivo que el jugador ve en su perfil. Cuenta desde ahora ' +
    'y respeta el ELO mínimo. Solo mueve el ELO y el pico (no partidas ni stats). Un recálculo automático lo vuelve a aplicar en su fecha.',
  request: { body: { required: true, ...json(AdjustBody) } },
  responses: { 201: { description: 'ELO antes y después de cada ficha', ...json(AdjustResult) }, ...errorResponses(400, 401, 403) },
});
const undo = createRoute({
  method: 'delete', path: '/api/v1/admin/elo/adjustments/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Deshacer un ajuste',
  description:
    'Lo borra y resta su cambio. Si es un "fijar", o después hubo un cierre o comienzo de temporada o un "fijar" de la misma ficha, ' +
    'recalcula el ELO de todos para que quede como si no hubiera existido. Pide `confirm: "estoy seguro"`.',
  request: { params: AdjustmentIdParam, body: { required: true, ...json(UndoBody) } },
  responses: { 204: { description: 'Deshecho' }, ...errorResponses(400, 401, 403, 404) },
});
const playerAdjustments = createRoute({
  method: 'get', path: '/api/v1/players/{id}/elo-adjustments', tags: ['Jugadores'], middleware: [optionalUser] as const,
  summary: 'Ajustes de ELO de un jugador',
  description: 'Los ajustes manuales que le hizo un admin: cambio, valor fijado, motivo y fecha. Sin sesión.',
  request: { params: IdParam, query: PlayerAdjustmentQuery },
  responses: { 200: { description: 'Ajustes', ...json(PlayerAdjustmentList) }, ...errorResponses(400, 401) },
});

type AdjRow = { id: number | null; delta: number | null; set_elo: number | null; reason: string | null; applied_at: string | null };
const adjustment = (r: AdjRow) => ({
  id: r.id!,
  kind: r.set_elo === null ? ('delta' as const) : ('set' as const),
  delta: r.delta ?? 0,
  set_elo: r.set_elo,
  reason: r.reason ?? '',
  applied_at: r.applied_at!,
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
    must(await c.var.sb.rpc('elo_set_config', { ...args(c.req.valid('json').config), p_recompute: false }));
    return c.json({ config: (await readConfig(c)).config }, 200);
  })
  .openapi(previewRoute, (c) => c.json(preview(c.req.valid('json')), 200))
  .openapi(adjustments, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb
      .from('admin_elo_adjustment_list')
      .select('id, player_id, nick, steam_id, delta, set_elo, reason, applied_at, created_by, created_by_alias', { count: 'exact' });
    if (p.player) q = q.eq('player_id', p.player);
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    if (p.from) q = q.gte('applied_at', p.from);
    if (p.to) q = q.lte('applied_at', p.to);
    type Row = AdjRow & {
      player_id: string | null; nick: string | null; steam_id: string | null; created_by: string | null; created_by_alias: string | null;
    };
    const { rows, total } = await runList<Row, typeof q>(q, p, {});
    return c.json(
      envelope(
        rows.map((r) => ({
          ...adjustment(r),
          player: r.player_id ? { id: r.player_id, alias: r.nick ?? '' } : null,
          steam_id: r.steam_id ?? '',
          created_by: r.created_by ? { id: r.created_by, alias: r.created_by_alias } : null,
        })),
        total,
        p,
      ),
      200,
    );
  })
  .openapi(adjust, async (c) => {
    const b = c.req.valid('json');
    // La función no tiene valores por defecto: el modo que no se usa va en null.
    const rows = mustHave(
      await c.var.sb.rpc('elo_adjust_players', {
        p_players: b.player_ids, p_delta: (b.delta ?? null) as number, p_set_elo: (b.set_elo ?? null) as number, p_reason: b.reason,
      }),
    );
    return c.json(
      {
        items: rows.map((r) => ({
          adjustment_id: r.adjustment_id ?? null,
          player: { id: r.player_id, alias: r.nick ?? '' },
          elo_before: r.elo_before,
          elo_after: r.elo_after,
        })),
      },
      201,
    );
  })
  .openapi(undo, async (c) => {
    const { id } = c.req.valid('param');
    const row = must(await c.var.sb.from('elo_adjustments').select('id').eq('id', id).maybeSingle());
    if (!row) throw notFound('ese ajuste');
    must(await c.var.sb.rpc('elo_remove_adjustment', { p_id: id }));
    return c.body(null, 204);
  })
  .openapi(playerAdjustments, async (c) => {
    const { id } = c.req.valid('param');
    const p = c.req.valid('query');
    const q = c.var.sb.from('player_elo_adjustment_list').select('id, delta, set_elo, reason, applied_at', { count: 'exact' }).eq('player_id', id);
    const { rows, total } = await runList<AdjRow, typeof q>(q, p, {});
    return c.json(envelope(rows.map(adjustment), total, p), 200);
  });
