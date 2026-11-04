import { createRoute } from '@hono/zod-openapi';
import { requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave, notFound, searchTerm } from '../lib/db';
import { AppError } from '../lib/errors';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import { IdParam } from '../schemas/admin';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  AdminMedalList,
  AdminMedalQuery,
  MedalDeleted,
  MedalGrantBody,
  MedalGrantResult,
  MedalIdsBody,
  MedalPatchBody,
  MedalRecalc,
  MedalRule,
  MedalRuleList,
  MedalRuleParam,
  MedalRulePatch,
  AdminMedal,
} from '../schemas/medals';

// Administración › Medallas: dar a varios con temporada, corregir, quitar y ajustar las reglas de las automáticas
// (replanteo 72, docs/bitacora/2026-11-04-medallas-automaticas).

const FIELDS = 'id, title, icon, medal_key, source, created_at, rank, season:seasons(id, number, name), player:players!inner(id, nick, photo_url)';

type Row = {
  id: string; title: string; icon: string | null; medal_key: string | null; source: 'admin' | 'auto' | 'temporada';
  created_at: string; rank: number | null; season: { id: string; number: number; name: string } | null;
  player: { id: string; nick: string; photo_url: string | null };
};
const out = (r: Row) => ({ ...r, season: r.season ?? null, rank: r.rank ?? null });

const list = createRoute({
  method: 'get', path: '/api/v1/admin/medals', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Medallas otorgadas',
  description: 'Todas las medallas dadas, con filtros por temporada (`none` = de carrera), clave, origen y alias del jugador.',
  request: { query: AdminMedalQuery },
  responses: { 200: { description: 'Medallas', ...json(AdminMedalList) }, ...errorResponses(400, 401, 403) },
});

const grant = createRoute({
  method: 'post', path: '/api/v1/admin/medals', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Dar una medalla a varios jugadores',
  description: 'Saltea a los que ya la tienen en esa temporada (misma clave, o mismo título si no tiene clave). Cada jugador recibe el aviso.',
  request: { body: { required: true, ...json(MedalGrantBody) } },
  responses: { 201: { description: 'Resultado', ...json(MedalGrantResult) }, ...errorResponses(400, 401, 403) },
});

const patch = createRoute({
  method: 'patch', path: '/api/v1/admin/medals/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar el título o la temporada de una medalla',
  description: 'Solo las dadas a mano: las automáticas y las del cierre de temporada salen de los datos.',
  request: { params: IdParam, body: { required: true, ...json(MedalPatchBody) } },
  responses: { 200: { description: 'Medalla', ...json(AdminMedal) }, ...errorResponses(400, 401, 403, 404) },
});

const remove = createRoute({
  method: 'post', path: '/api/v1/admin/medals/delete', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Quitar varias medallas',
  description: 'Una automática vuelve a darse en el próximo mix del jugador si sigue cumpliendo la regla: para que no vuelva, desactivá la regla.',
  request: { body: { required: true, ...json(MedalIdsBody) } },
  responses: { 200: { description: 'Quitadas', ...json(MedalDeleted) }, ...errorResponses(400, 401, 403) },
});

const rules = createRoute({
  method: 'get', path: '/api/v1/admin/medal-rules', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Reglas de las medallas automáticas',
  responses: { 200: { description: 'Reglas', ...json(MedalRuleList) }, ...errorResponses(401, 403) },
});

const patchRule = createRoute({
  method: 'patch', path: '/api/v1/admin/medal-rules/{key}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar una regla',
  description: 'Umbral, mínimo de partidas, título o si está activa. Las ya dadas no cambian; para dar las nuevas, `POST /admin/medal-rules/recalculate`.',
  request: { params: MedalRuleParam, body: { required: true, ...json(MedalRulePatch) } },
  responses: { 200: { description: 'Regla', ...json(MedalRule) }, ...errorResponses(400, 401, 403, 404) },
});

const recalc = createRoute({
  method: 'post', path: '/api/v1/admin/medal-rules/recalculate', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Dar las automáticas que falten a todos',
  description: 'Recorre a todos los jugadores con las reglas actuales, sin avisos. Nunca quita.',
  responses: { 200: { description: 'Resultado', ...json(MedalRecalc) }, ...errorResponses(401, 403) },
});

export const adminMedals = createRouter()
  .openapi(list, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('player_medals').select(FIELDS, { count: 'exact' });
    if (p.season === 'none') q = q.is('season_id', null);
    else if (p.season) q = q.eq('season_id', p.season);
    if (p.medal_key) q = q.eq('medal_key', p.medal_key);
    if (p.source) q = q.eq('source', p.source);
    const term = searchTerm(p.q);
    if (term) q = q.ilike('player.nick', `%${term}%`);
    const { rows, total } = await runList<Row, typeof q>(q, p, {});
    return c.json(envelope(rows.map(out), total, p), 200);
  })
  .openapi(grant, async (c) => {
    const b = c.req.valid('json');
    const season = b.season_id ?? null;
    let have = c.var.sb.from('player_medals').select('player_id').in('player_id', b.player_ids);
    have = b.medal_key ? have.eq('medal_key', b.medal_key) : have.eq('title', b.title);
    have = season ? have.eq('season_id', season) : have.is('season_id', null);
    const already = new Set(mustHave(await have).map((r) => r.player_id));
    const ids = [...new Set(b.player_ids)];
    const rows = ids.filter((id) => !already.has(id)).map((id) => ({
      player_id: id, title: b.title, icon: b.icon, medal_key: b.medal_key ?? null, season_id: season, source: 'admin',
    }));
    if (rows.length) mustHave(await c.var.sb.from('player_medals').insert(rows).select('id'));
    return c.json({ given: rows.length, skipped: ids.filter((id) => already.has(id)) }, 201);
  })
  .openapi(patch, async (c) => {
    const { id } = c.req.valid('param');
    const cur = must(await c.var.sb.from('player_medals').select('source').eq('id', id).maybeSingle());
    if (!cur) throw notFound('esa medalla');
    if (cur.source !== 'admin') {
      throw new AppError(400, 'BUSINESS_RULE', 'Solo se cambian las medallas dadas a mano: las automáticas y las de temporada salen de los datos.');
    }
    const row = mustHave(await c.var.sb.from('player_medals').update(c.req.valid('json')).eq('id', id).select(FIELDS).single());
    return c.json(out(row as unknown as Row), 200);
  })
  .openapi(remove, async (c) => {
    const gone = mustHave(await c.var.sb.from('player_medals').delete().in('id', c.req.valid('json').ids).select('id'));
    return c.json({ deleted: gone.length }, 200);
  })
  .openapi(rules, async (c) => {
    const items = mustHave(await c.var.sb.from('medal_rules').select('*').order('metric').order('threshold'));
    return c.json({ items }, 200);
  })
  .openapi(patchRule, async (c) => {
    const row = must(await c.var.sb.from('medal_rules').update(c.req.valid('json')).eq('medal_key', c.req.valid('param').key)
      .select('*').maybeSingle());
    if (!row) throw notFound('esa regla');
    return c.json(row, 200);
  })
  .openapi(recalc, async (c) => {
    const given = must(await c.var.sb.rpc('admin_medals_recalculate'));
    return c.json({ given: given ?? 0 }, 200);
  });
