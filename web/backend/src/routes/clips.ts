import { createRoute, type z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { isAdmin, optionalUser, requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave, notFound } from '../lib/db';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { STEAM64 } from '../schemas/claim';
import {
  Clip,
  ClipConfig,
  ClipConfigPatch,
  ClipList,
  ClipListQuery,
  ClipParam,
  ClipReviewList,
  ClipReviewQuery,
  CLIP_TYPES,
  type ClipVideo,
} from '../schemas/clips';
import { bearer, errorResponses, json } from '../schemas/common';
import { MatchParam } from '../schemas/matches';

// Clips automáticos (plan docs/bitacora/2026-10-22-clips-automaticos): las jugadas destacadas de una partida y la
// configuración de la escala y los topes. La base clasifica, ordena y aplica los topes (vista match_clip_list).

type C = Context<AppEnv>;
type Type = (typeof CLIP_TYPES)[number];
const CONFIG_COLUMNS = 'priorities, per_player, per_match, split_gap_seconds, pre_seconds, post_seconds, vip_per_match, updated_at, updated_by';
const LIST_COLUMNS =
  'id, position, type, priority, round, round_seconds, round_won, player_steamid, player_id, player_name, kills, kill_ticks, ' +
  'clutch_vs, clutch_start_tick, end_tick, tickrate, demo_status, video_status, video_key, video_seconds, video_drive_id, video_in_r2, ' +
  'vip, review';

/** La configuración con quién la cambió por última vez (su alias). */
async function readConfig(c: C) {
  const row = mustHave(await c.var.sb.from('clip_config').select(CONFIG_COLUMNS).eq('id', 1).single());
  const { updated_at, updated_by, priorities, ...v } = row;
  let author = null;
  if (updated_by) {
    const p = must(await c.var.sb.from('profiles').select('tag').eq('id', updated_by).maybeSingle());
    author = { id: updated_by, alias: p?.tag ?? null };
  }
  return { config: { ...v, priorities: priorities as Record<Type, number> }, updated_at, updated_by: author };
}

const list = createRoute({
  method: 'get', path: '/api/v1/matches/{id}/clips', tags: ['Partidas'], middleware: [optionalUser] as const,
  summary: 'Clips de una partida',
  description:
    'Las jugadas destacadas (ace, 4k, 3k y clutches ganados), ya ordenadas y con los topes por jugador y por partida aplicados. ' +
    'Con los ticks de la demo de cada kill. Sin sesión. Una partida sin clips (o anterior a los clips) responde la lista vacía.',
  request: { params: MatchParam, query: ClipListQuery },
  responses: { 200: { description: 'Clips', ...json(ClipList) }, ...errorResponses(400, 401, 404) },
});
const getConfig = createRoute({
  method: 'get', path: '/api/v1/admin/clips/config', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Configuración de los clips',
  description: 'La escala de prioridad de cada tipo, los topes por jugador y por partida, y los cortes del video (fase C).',
  responses: { 200: { description: 'Configuración', ...json(ClipConfig) }, ...errorResponses(401, 403) },
});
const patchConfig = createRoute({
  method: 'patch', path: '/api/v1/admin/clips/config', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar la configuración de los clips',
  description: 'Solo lo que cambia. Vale al instante para el listado de todas las partidas (las viejas también): los datos no se tocan.',
  request: { body: { required: true, ...json(ClipConfigPatch) } },
  responses: { 200: { description: 'Guardada', ...json(ClipConfig) }, ...errorResponses(400, 401, 403) },
});

const review = createRoute({
  method: 'get', path: '/api/v1/admin/clips/review', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Clips para revisar',
  description:
    'Los reprocesados que esperan el "Bien", del más viejo al más nuevo. `clip.video.status` dice si el video nuevo ya está ' +
    '(`done`, con `embed_url` de Drive para mirarlo) o todavía se graba.',
  request: { query: ClipReviewQuery },
  responses: { 200: { description: 'Para revisar', ...json(ClipReviewList) }, ...errorResponses(400, 401, 403) },
});
const reprocess = createRoute({
  method: 'post', path: '/api/v1/admin/clips/{id}/reprocess', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Reprocesar un clip',
  description:
    'El video actual se borra (de R2 y de Drive) y el bot lo vuelve a grabar y lo sube a Drive. No sale en Discord hasta el "Bien" ' +
    '(`/approve`); si ya había salido, se publica otra vez. Solo un clip de la lista, ya grabado (o fallido) y con la demo todavía en R2 ' +
    '(si no, `BUSINESS_RULE` con el motivo).',
  request: { params: ClipParam },
  responses: { 200: { description: 'En la cola', ...json(Clip) }, ...errorResponses(400, 401, 403, 404) },
});
const approve = createRoute({
  method: 'post', path: '/api/v1/admin/clips/{id}/approve', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Aprobar un clip reprocesado',
  description: 'El video nuevo quedó bien: sale en Discord y se muestra a todos. Solo un reprocesado con el video listo (si no, `BUSINESS_RULE`).',
  request: { params: ClipParam },
  responses: { 200: { description: 'Aprobado', ...json(Clip) }, ...errorResponses(400, 401, 403, 404) },
});

type Row = {
  id: string | null; position: number | null; type: string | null; priority: number | null; round: number | null;
  round_seconds: number | null; round_won: boolean | null; player_steamid: string | null; player_id: string | null;
  player_name: string | null; kills: number | null; kill_ticks: number[] | null; clutch_vs: number | null;
  clutch_start_tick: number | null; end_tick: number | null; tickrate: number | null; demo_status: string | null;
  video_status: string | null; video_key: string | null; video_seconds: number | null; video_drive_id: string | null;
  video_in_r2: boolean | null; vip: boolean | null; review: string | null;
};

// El video (fase C2, docs/bitacora/2026-10-23-clips-render-automatico): los primeros 15 días, el .mp4 del Worker de
// clips; siempre, el reproductor de Drive. Sin demo (none, missing, expired) la jugada nunca va a tener video.
// Un reprocesado sin aprobar (docs/bitacora/2026-10-28-clips-vip-y-reprocesar) se muestra en cola, sin video, salvo a un admin.
const toVideo = (r: Row, clipsBase: string | undefined, admin: boolean): z.infer<typeof ClipVideo> => {
  const hidden = r.review === 'pending' && !admin;
  const done = r.video_status === 'done' && !hidden;
  const status = hidden ? 'pending' : (r.video_status ?? (r.demo_status === 'uploaded' || r.demo_status === 'pending' ? 'pending' : 'unavailable'));
  return {
    status: status as z.infer<typeof ClipVideo>['status'],
    url: done && r.video_in_r2 && clipsBase && r.video_key?.startsWith('clips/') ? `${clipsBase}/clip/${r.video_key.slice(6)}` : null,
    embed_url: done && r.video_drive_id ? `https://drive.google.com/file/d/${encodeURIComponent(r.video_drive_id)}/preview` : null,
    seconds: done && r.video_seconds != null ? Number(r.video_seconds) : null,
  };
};

const toClip = (r: Row, aliases: Map<string, string>, clipsBase: string | undefined, admin: boolean): z.infer<typeof Clip> => {
  const ticks = r.kill_ticks ?? [];
  // Donde empieza la jugada: la primera kill o, si no hubo, el inicio del clutch.
  const first = ticks[0] ?? r.clutch_start_tick;
  return {
    id: r.id!,
    position: r.position!,
    type: r.type as Type,
    priority: r.priority!,
    round: r.round!,
    round_seconds: r.round_seconds ?? 0,
    round_won: !!r.round_won,
    player: r.player_id ? { id: r.player_id, alias: aliases.get(r.player_id) ?? r.player_name ?? '' } : null,
    game_nick: r.player_name ?? '',
    steam_id: !r.player_id && r.player_steamid && STEAM64.test(r.player_steamid) ? r.player_steamid : null,
    kills: r.kills ?? 0,
    kill_ticks: ticks,
    clutch_vs: r.clutch_vs,
    clutch_start_tick: r.clutch_start_tick,
    end_tick: r.end_tick,
    tickrate: r.tickrate,
    demo_seconds: r.tickrate && first != null ? Math.round((first / r.tickrate) * 10) / 10 : null,
    video: toVideo(r, clipsBase, admin),
    vip: !!r.vip,
    review: admin ? (r.review as 'pending' | 'approved' | null) : null,
  };
};

/** Las filas de match_clip_list a la respuesta, con el alias de cada ficha. */
async function toClips(c: C, rows: Row[], admin: boolean) {
  const linked = [...new Set(rows.map((r) => r.player_id).filter((x): x is string => !!x))];
  const aliases = linked.length
    ? new Map(mustHave(await c.var.sb.from('players').select('id, nick').in('id', linked)).map((x) => [x.id, x.nick]))
    : new Map<string, string>();
  return rows.map((r) => toClip(r, aliases, c.var.config.CLIPS_BASE_URL, admin));
}

async function existingClip(c: C, id: string) {
  if (!must(await c.var.sb.from('match_clips').select('id').eq('id', id).maybeSingle())) throw notFound('esa jugada');
}

async function readClip(c: C, id: string) {
  const row = must(await c.var.sb.from('match_clip_list').select(LIST_COLUMNS).eq('id', id).maybeSingle()) as Row | null;
  if (!row) throw notFound('esa jugada entre los clips');
  return (await toClips(c, [row], true))[0]!;
}

export const clips = createRouter()
  .openapi(list, async (c) => {
    const { id } = c.req.valid('param');
    const p = c.req.valid('query');
    const { sb } = c.var;
    const match = must(await sb.from('matches').select('id').eq('id', id).maybeSingle());
    if (!match) throw notFound('esa partida');
    let q = sb.from('match_clip_list').select(LIST_COLUMNS, { count: 'exact' }).eq('match_id', id);
    if (p.player) q = q.eq('player_id', p.player);
    if (p.type) q = q.eq('type', p.type);
    // Desempate por puesto (siempre ascendente): dos clips de la misma ronda quedan en el orden de la escala.
    const { rows, total } = await runList<Row, typeof q>(q, p, {}, 'position');
    return c.json(envelope(await toClips(c, rows, await isAdmin(c)), total, p), 200);
  })
  .openapi(getConfig, async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json(await readConfig(c), 200);
  })
  .openapi(patchConfig, async (c) => {
    const body = c.req.valid('json');
    const cur = (await readConfig(c)).config;
    const next = { ...cur, ...body, priorities: { ...cur.priorities, ...body.priorities } };
    must(
      await c.var.sb.rpc('clip_set_config', {
        p_priorities: next.priorities, p_per_player: next.per_player, p_per_match: next.per_match,
        p_split_gap_seconds: next.split_gap_seconds, p_pre_seconds: next.pre_seconds, p_post_seconds: next.post_seconds,
        p_vip_per_match: next.vip_per_match,
      }),
    );
    return c.json(await readConfig(c), 200);
  })
  .openapi(review, async (c) => {
    const p = c.req.valid('query');
    const sb = c.var.sb;
    const q = sb.from('match_clips').select('id, match_id, video_reprocess_count, video_reprocessed_at', { count: 'exact' }).eq('video_review', 'pending');
    type Pending = { id: string; match_id: string; video_reprocess_count: number; video_reprocessed_at: string | null };
    const { rows, total } = await runList<Pending, typeof q>(q, p, { reprocessed_at: 'video_reprocessed_at' });
    const ids = rows.map((r) => r.id);
    const [list, matches] = ids.length
      ? await Promise.all([
          sb.from('match_clip_list').select(LIST_COLUMNS).in('id', ids).then(mustHave),
          sb.from('matches').select('id, map, played_at').in('id', [...new Set(rows.map((r) => r.match_id))]).then(mustHave),
        ])
      : [[], []];
    const byId = new Map((await toClips(c, list as unknown as Row[], true)).map((x) => [x.id, x]));
    const byMatch = new Map(matches.map((m) => [m.id, m]));
    const items = rows.flatMap((r) => {
      const clip = byId.get(r.id);
      const m = byMatch.get(r.match_id);
      return clip && m
        ? [{ clip, match: { id: m.id, map: m.map, played_at: m.played_at }, reprocess_count: r.video_reprocess_count, reprocessed_at: r.video_reprocessed_at ?? '' }]
        : [];
    });
    return c.json(envelope(items, total, p), 200);
  })
  .openapi(reprocess, async (c) => {
    const { id } = c.req.valid('param');
    await existingClip(c, id);
    must(await c.var.sb.rpc('clip_reprocess', { p_clip: id }));
    return c.json(await readClip(c, id), 200);
  })
  .openapi(approve, async (c) => {
    const { id } = c.req.valid('param');
    await existingClip(c, id);
    must(await c.var.sb.rpc('clip_review_ok', { p_clip: id }));
    return c.json(await readClip(c, id), 200);
  });
