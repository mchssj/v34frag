import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { currentUser, isAdmin, optionalUser, requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave, notFound } from '../lib/db';
import { AppError } from '../lib/errors';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  MedalActivate,
  MedalActivated,
  MedalDefinition,
  MedalDefinitionCreate,
  MedalDefinitionList,
  MedalDefinitionPatch,
  MedalPreview,
  MedalPreviewBody,
  MedalProgressList,
} from '../schemas/medals';
import { IdParam } from '../schemas/players';
import {
  DEF_FIELDS,
  defaultKey,
  defaultTitle,
  designOf,
  normalizeDesign,
  templateOf,
  type DefRow,
  type Template,
} from '../services/medals';
import { resolvePlayer } from '../services/players';

// Medallas configurables (replanteo 79, plan docs/bitacora/2026-11-04-medallas-configurables, sección 7): Administración
// › Medallas y el progreso de Logros. Las otorga el motor (pnpm medals:tick), el cierre de temporada o un admin a mano.

type C = Context<AppEnv>;
type Def = z.infer<typeof MedalDefinition>;

const toDef = (r: DefRow, holders: number): Def => ({
  ...(r as unknown as Omit<Def, 'holders' | 'design' | 'target'>),
  target: Number(r.target),
  holders,
  design: designOf(r, r.template === 'podio' ? Number(r.target) : null, 1),
});

async function readDefs(c: C, only?: { id?: string; active?: boolean }): Promise<Def[]> {
  let q = c.var.sb.from('medal_definitions').select(DEF_FIELDS).order('series', { nullsFirst: false }).order('series_order').order('key');
  if (only?.id) q = q.eq('id', only.id);
  if (only?.active) q = q.eq('status', 'active');
  const rows = mustHave(await q) as unknown as DefRow[];
  const counts = rows.length
    ? mustHave(await c.var.sb.from('medal_holders').select('definition_id, holders').in('definition_id', rows.map((r) => r.id)))
    : [];
  const by = new Map(counts.map((x) => [x.definition_id, x.holders ?? 0]));
  return rows.map((r) => toDef(r, by.get(r.id) ?? 0));
}

async function readDef(c: C, id: string): Promise<Def> {
  const [d] = await readDefs(c, { id });
  if (!d) throw notFound('esa medalla');
  return d;
}

function needTemplate(id: string): Template {
  const t = templateOf(id);
  if (!t) throw new AppError(400, 'VALIDATION_ERROR', 'Esa plantilla no existe.');
  return t;
}

/** Filtros de la plantilla; las de promedio pueden cambiar el mínimo de mixes. */
function filtersOf(t: Template, minMatches?: number, current?: Record<string, unknown>) {
  const f: Record<string, unknown> = { ...(current ?? t.filters) };
  if (t.aggregation === 'avg_min_matches' && minMatches !== undefined) f.min_matches = minMatches;
  return f;
}

/** Objetivos fijos: las de una sola vez y las manuales valen 1; el podio va del 1 al 3. */
function checkTarget(t: Template, target: number) {
  const bad = (m: string) => new AppError(400, 'VALIDATION_ERROR', m);
  if ((t.aggregation === 'once' || t.aggregation === 'manual' || t.aggregation === 'event_result') && target !== 1) throw bad('Esta medalla se gana una vez: el objetivo es 1.');
  if (t.id === 'podio' && ![1, 2, 3].includes(target)) throw bad('El podio es del puesto 1 al 3.');
  if (t.aggregation !== 'avg_min_matches' && !Number.isInteger(target)) throw bad('El objetivo tiene que ser un número entero.');
}

// ---------- rutas ----------

const publicList = createRoute({
  method: 'get', path: '/api/v1/medals/definitions', tags: ['Medallas'], middleware: [optionalUser] as const,
  summary: 'Medallas activas',
  description: 'Las medallas que se pueden ganar hoy, con su dibujo y cuántos la tienen. Sin sesión.',
  responses: { 200: { description: 'Medallas', ...json(MedalDefinitionList) }, ...errorResponses(401) },
});

const adminList = createRoute({
  method: 'get', path: '/api/v1/admin/medals/definitions', tags: ['Medallas'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Todas las medallas (admin)',
  description: 'Borradores, activas y archivadas, con cuántos la tienen y desde cuándo hay datos.',
  responses: { 200: { description: 'Medallas', ...json(MedalDefinitionList) }, ...errorResponses(401, 403) },
});

const create = createRoute({
  method: 'post', path: '/api/v1/admin/medals/definitions', tags: ['Medallas'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Crear una medalla (borrador)',
  description:
    'Plantilla del manifiesto, objetivo y dibujo. La métrica, la agregación y los filtros salen de la plantilla. Queda en borrador hasta ' +
    'activarla. La clave es la plantilla y el objetivo (409 si ya existe).',
  request: { body: { required: true, ...json(MedalDefinitionCreate) } },
  responses: { 201: { description: 'Creada', ...json(MedalDefinition) }, ...errorResponses(400, 401, 403, 409) },
});

const patch = createRoute({
  method: 'patch', path: '/api/v1/admin/medals/definitions/{id}', tags: ['Medallas'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Editar una medalla',
  description: 'El dibujo, el título y la descripción se cambian siempre; el objetivo y el mínimo de mixes, solo en un borrador.',
  request: { params: IdParam, body: { required: true, ...json(MedalDefinitionPatch) } },
  responses: { 200: { description: 'Medalla', ...json(MedalDefinition) }, ...errorResponses(400, 401, 403, 404, 409) },
});

const remove = createRoute({
  method: 'delete', path: '/api/v1/admin/medals/definitions/{id}', tags: ['Medallas'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Borrar un borrador',
  description: 'Solo los borradores. Una medalla activa se archiva.',
  request: { params: IdParam },
  responses: { 204: { description: 'Borrada' }, ...errorResponses(400, 401, 403, 404) },
});

const activate = createRoute({
  method: 'post', path: '/api/v1/admin/medals/definitions/{id}/activate', tags: ['Medallas'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Activar una medalla',
  description: 'Desde ahora el motor la revisa después de cada mix. Con `retroactive`, se la da ya a quienes la cumplen (con aviso).',
  request: { params: IdParam, body: { required: true, ...json(MedalActivate) } },
  responses: { 200: { description: 'Activada', ...json(MedalActivated) }, ...errorResponses(400, 401, 403, 404) },
});

const archive = createRoute({
  method: 'post', path: '/api/v1/admin/medals/definitions/{id}/archive', tags: ['Medallas'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Archivar una medalla',
  description: 'Deja de otorgarse; quien la tiene la conserva. Una medalla de un tramo de temporada no se archiva.',
  request: { params: IdParam },
  responses: { 200: { description: 'Archivada', ...json(MedalDefinition) }, ...errorResponses(400, 401, 403, 404) },
});

const preview = createRoute({
  method: 'post', path: '/api/v1/admin/medals/preview', tags: ['Medallas'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Quiénes la recibirían hoy',
  description: 'Cuántos jugadores ya cumplen esa plantilla y ese objetivo, sin otorgar nada. `null` en las de temporada y las manuales.',
  request: { body: { required: true, ...json(MedalPreviewBody) } },
  responses: { 200: { description: 'Cantidad', ...json(MedalPreview) }, ...errorResponses(400, 401, 403) },
});

const progress = createRoute({
  method: 'get', path: '/api/v1/players/{id}/medals/progress', tags: ['Jugadores'], middleware: [optionalUser] as const,
  summary: 'Progreso en las medallas',
  description:
    'Cada medalla activa del motor con lo que lleva el jugador y si ya la ganó. El progreso solo lo ven el dueño de la ficha y el admin: ' +
    'los demás (y sin sesión) ven solo las ganadas (`hidden`). Acepta el id o el nick. Las de temporada y las manuales están en `/players/{id}/medals`.',
  request: { params: IdParam },
  responses: { 200: { description: 'Progreso', ...json(MedalProgressList) }, ...errorResponses(401, 404) },
});

export const medals = createRouter()
  .openapi(publicList, async (c) => c.json({ items: await readDefs(c, { active: true }) }, 200))
  .openapi(adminList, async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json({ items: await readDefs(c) }, 200);
  })
  .openapi(preview, async (c) => {
    const b = c.req.valid('json');
    const t = needTemplate(b.template);
    checkTarget(t, b.target);
    const n = must(
      await c.var.sb.rpc('medal_preview' as never, {
        p_metric: t.metric, p_aggregation: t.aggregation, p_filters: filtersOf(t, b.min_matches), p_target: b.target,
      } as never),
    ) as number | null;
    return c.json({ players: n ?? null }, 200);
  })
  .openapi(create, async (c) => {
    const b = c.req.valid('json');
    const t = needTemplate(b.template);
    // (replanteo 114) Campeón y finalista de torneo ya existen y las da la base: se editan, no se crean otras.
    if (t.aggregation === 'event_result') throw new AppError(400, 'BUSINESS_RULE', 'Esta medalla la da el torneo y ya existe: editala desde la lista.');
    checkTarget(t, b.target);
    const row = {
      key: defaultKey(t, b.target),
      template: t.id,
      scope: t.scope,
      title: b.title ?? defaultTitle(t, b.target),
      description: b.description ?? null,
      design: normalizeDesign(t, b.design),
      metric: t.metric,
      aggregation: t.aggregation,
      filters: filtersOf(t, b.min_matches),
      target: b.target,
      series: t.steps.length > 1 ? t.id : null,
      series_order: t.steps.length > 1 ? Math.max(1, [...t.steps, b.target].sort((x, y) => x - y).indexOf(b.target) + 1) : null,
      data_since: t.dataSince,
      created_by: c.var.user.id,
      updated_by: c.var.user.id,
    };
    const inserted = mustHave(await c.var.sb.from('medal_definitions').insert(row as never).select('id').single());
    return c.json(await readDef(c, inserted.id), 201);
  })
  .openapi(patch, async (c) => {
    const { id } = c.req.valid('param');
    const b = c.req.valid('json');
    const cur = await readDef(c, id);
    const t = needTemplate(cur.template);
    const draft = cur.status === 'draft';
    if (!draft && ((b.target !== undefined && b.target !== cur.target) || b.min_matches !== undefined)) {
      throw new AppError(400, 'BUSINESS_RULE', 'La condición y el objetivo solo se cambian en un borrador: archiva esta medalla y crea otra.');
    }
    const target = b.target ?? cur.target;
    checkTarget(t, target);
    const upd: Record<string, unknown> = { updated_by: c.var.user.id };
    if (b.title !== undefined) upd.title = b.title;
    if (b.description !== undefined) upd.description = b.description;
    if (b.design) {
      const raw = (mustHave(await c.var.sb.from('medal_definitions').select('design').eq('id', id).single()) as { design: Record<string, string> }).design;
      upd.design = normalizeDesign(t, b.design, raw);
    }
    if (draft && b.target !== undefined) {
      upd.target = target;
      upd.key = defaultKey(t, target);
      if (b.title === undefined && cur.title === defaultTitle(t, cur.target)) upd.title = defaultTitle(t, target);
    }
    if (draft && b.min_matches !== undefined) upd.filters = filtersOf(t, b.min_matches, cur.filters);
    must(await c.var.sb.from('medal_definitions').update(upd as never).eq('id', id));
    return c.json(await readDef(c, id), 200);
  })
  .openapi(remove, async (c) => {
    const { id } = c.req.valid('param');
    const cur = await readDef(c, id);
    if (cur.status !== 'draft') throw new AppError(400, 'BUSINESS_RULE', 'Solo se borra un borrador: una medalla activa se archiva.');
    must(await c.var.sb.from('medal_definitions').delete().eq('id', id));
    return c.body(null, 204);
  })
  .openapi(activate, async (c) => {
    const { id } = c.req.valid('param');
    await readDef(c, id);
    const r = mustHave(
      await c.var.sb.rpc('medal_activate' as never, { p_id: id, p_retro: c.req.valid('json').retroactive } as never),
    ) as { awarded: number };
    return c.json({ definition: await readDef(c, id), awarded: r.awarded ?? 0 }, 200);
  })
  .openapi(archive, async (c) => {
    const { id } = c.req.valid('param');
    await readDef(c, id);
    must(await c.var.sb.rpc('medal_archive' as never, { p_id: id } as never));
    return c.json(await readDef(c, id), 200);
  })
  .openapi(progress, async (c) => {
    const sb = c.var.sb;
    const id = await resolvePlayer(sb, c.req.valid('param').id);
    const [player, defs, values, earned, since] = await Promise.all([
      sb.from('players').select('user_id').eq('id', id).maybeSingle().then(must),
      sb.from('medal_definitions').select(DEF_FIELDS).eq('status', 'active').then(mustHave),
      sb.rpc('medal_progress' as never, { p_player: id } as never).then(mustHave),
      sb.from('player_medals').select('definition_id, created_at').eq('player_id', id).eq('source', 'auto').then(mustHave),
      sb.rpc('medal_stats_since' as never).then(must),
    ]);
    if (!player) throw notFound('ese jugador');
    const user = currentUser(c);
    // El progreso de las bloqueadas solo lo ve el dueño de la ficha (y el admin); los demás, solo las ganadas.
    const hidden = !(user && (user.id === player.user_id || (await isAdmin(c))));
    const value = new Map((values as { definition_id: string; value: number }[]).map((v) => [v.definition_id, Number(v.value)]));
    const got = new Map(earned.map((e) => [e.definition_id!, e.created_at]));
    const items = (defs as unknown as DefRow[])
      .filter((d) => d.scope === 'player' && !['season_rank', 'manual', 'event_result'].includes(d.aggregation))
      .map((d) => ({
        design: designOf(d),
        series: d.series,
        series_order: d.series_order,
        target: Number(d.target),
        value: value.get(d.id) ?? 0,
        data_since: d.data_since,
        earned_at: got.get(d.id) ?? null,
      }))
      .filter((x) => !hidden || x.earned_at !== null)
      .map((x) => (hidden ? { ...x, value: x.target } : x));
    return c.json({ items, hidden, stats_since: (since as string | null) ?? null }, 200);
  });
