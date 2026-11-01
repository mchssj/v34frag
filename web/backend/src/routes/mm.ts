import { createRoute, z } from '@hono/zod-openapi';
import type { Context, MiddlewareHandler } from 'hono';
import { requireAdmin, requireModerator, requireUser } from '../lib/auth';
import { must, mustHave } from '../lib/db';
import { AppError } from '../lib/errors';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { readAudio, storageError, SOUND_MAX_BYTES } from '../lib/uploads';
import { bearer, errorResponses, json } from '../schemas/common';
import { demoUrl } from '../services/matches';
import { LIST_COLUMNS, toVideo, type ClipRow } from './clips';

// Matchmaking (plan docs/bitacora/2026-10-28-matchmaking). Las reglas las valida la base: acá solo se valida la forma
// del pedido y se devuelve el estado nuevo. El estado es mm_my_state() y lo consume el frontend tal cual.

type C = Context<AppEnv>;

const Any = z.any().openapi('MmJson', { description: 'Respuesta de mm_my_state() o de la función de administración' });
const Id = z.string().uuid();
const IdParam = z.object({ id: Id });
const PlayerBody = z.object({ player_id: Id });
const AudioForm = z.object({ file: z.instanceof(File).openapi({ type: 'string', format: 'binary' }) });
const multipart = (schema: z.ZodTypeAny) => ({ required: true, content: { 'multipart/form-data': { schema } } });

type RouteOpts = { summary: string; request?: Record<string, unknown>; guard?: MiddlewareHandler<AppEnv> };

const route = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, { summary, request, guard }: RouteOpts) =>
  createRoute({
    method, path, tags: ['Matchmaking'], security: bearer, summary, request: request as never,
    middleware: (guard ? [requireUser, guard] : [requireUser]) as never,
    responses: { 200: { description: 'OK', ...json(Any) }, ...errorResponses(400, 401, 403, 404) },
  });

const rpc = async (c: C, fn: string, args: Record<string, unknown> = {}) => must(await c.var.sb.rpc(fn as never, args as never));
type GameRef = { game_id?: string | null; demo_url: string | null; clips: unknown[] };

/** La base da la partida; el demo y los videos de los clips dependen de la configuración de la API. */
async function withGame(c: C, game: GameRef) {
  const { sb, config } = c.var;
  const g = must(await sb.from('matches').select('kind, external_id, demo_status').eq('id', game.game_id!).maybeSingle());
  if (g) game.demo_url = demoUrl(config, g as { kind: string; external_id: string | null; demo_status: string });
  const rows = must(await sb.from('match_clip_list').select(LIST_COLUMNS).eq('match_id', game.game_id!).order('position')) as unknown as ClipRow[];
  game.clips = rows.map((r) => ({
    id: r.id, type: r.type, round: r.round, player_id: r.player_id, nick: r.player_name ?? '', kills: r.kills ?? 0,
    video: toVideo(r, config.CLIPS_BASE_URL, false),
  }));
}

const state = async (c: C) => {
  const s = mustHave(await c.var.sb.rpc('mm_my_state' as never)) as { lobby?: { match?: GameRef | null } | null };
  const game = s.lobby?.match;
  if (game?.game_id) await withGame(c, game);
  return c.json(s as never, 200);
};
const body = <T>(c: C) => (c.req as unknown as { valid(t: 'json'): T }).valid('json');
const param = (c: C) => (c.req as unknown as { valid(t: 'param'): { id: string } }).valid('param').id;
const jsonBody = (schema: z.ZodTypeAny) => ({ body: { required: true, ...json(schema) } });

/** Una acción del jugador: llama a la función y devuelve el estado. */
const action = (fn: string, args: (c: C) => Record<string, unknown> = () => ({})) => async (c: C) => {
  await rpc(c, fn, args(c));
  return state(c);
};
const lists = (what: string, arg?: (c: C) => string | undefined) => async (c: C) =>
  c.json((await rpc(c, 'mm_admin_lists', { p_what: what, p_arg: arg?.(c) })) as never, 200);

const Join = z.object({ mode: z.string().max(10), region: z.string().max(60).nullish() }).openapi('MmJoin');
const Report = z.object({ lobby_id: Id, player_id: Id, reason: z.enum(['afk', 'toxic', 'cheat', 'abandon', 'other']), note: z.string().max(500).optional() }).openapi('MmReport');
const Commend = z.object({ lobby_id: Id, player_id: Id }).openapi('MmCommend');
const Sound = z.object({ sound_id: Id.nullable() }).openapi('MmSoundChoice');
const Resolve = z.object({ action: z.enum(['dismiss', 'warn', 'mm_ban', 'ban', 'server_ban']), days: z.number().int().positive().max(3650).optional() }).openapi('MmResolve');
const Maps = z.object({ maps: z.array(z.string().max(64)).min(2).max(50) }).openapi('MmMaps');
const Config = z.record(z.string(), z.unknown()).openapi('MmConfigPatch');

/** Sube un sonido al bucket `sounds`. Las políticas de Storage limitan quién escribe en cada carpeta. */
async function uploadSound(c: C, folder: string, file: File) {
  const { bytes, type } = await readAudio(file, SOUND_MAX_BYTES);
  const bucket = c.var.sb.storage.from('sounds');
  const path = `${folder}/${Date.now()}.${type.ext}`;
  const up = await bucket.upload(path, bytes, { contentType: type.mime, upsert: false });
  if (up.error) throw storageError(up.error);
  return { path, url: bucket.getPublicUrl(path).data.publicUrl };
}
const removeSound = async (c: C, url: unknown) => {
  const path = typeof url === 'string' ? url.split('/sounds/')[1] : undefined;
  if (path) await c.var.sb.storage.from('sounds').remove([path]);
};
const form = (c: C) => (c.req as unknown as { valid(t: 'form'): { file: File; name?: string } }).valid('form');

const r = createRouter();
const add = (def: ReturnType<typeof route>, handler: (c: C) => Promise<Response>) => r.openapi(def as never, handler as never);

add(route('get', '/api/v1/mm/state', { summary: 'Estado de mi matchmaking' }), state);
add(route('post', '/api/v1/mm/queue', { summary: 'Entrar a la cola', request: jsonBody(Join) }), action('mm_join', (c) => {
  const b = body<{ mode: string; region?: string | null }>(c);
  return { p_mode: b.mode, p_region: b.region ?? null };
}));
add(route('delete', '/api/v1/mm/queue', { summary: 'Salir de la cola' }), action('mm_leave'));
add(route('post', '/api/v1/mm/lobby/accept', { summary: 'Aceptar la partida' }), action('mm_accept'));
add(route('post', '/api/v1/mm/lobby/decline', { summary: 'Rechazar la partida' }), action('mm_decline'));

add(route('post', '/api/v1/mm/party/invites', { summary: 'Invitar al grupo', request: jsonBody(PlayerBody) }),
  action('mm_party_invite', (c) => ({ p_player: body<{ player_id: string }>(c).player_id })));
add(route('post', '/api/v1/mm/party/invites/{id}/accept', { summary: 'Aceptar una invitación', request: { params: IdParam } }),
  action('mm_party_respond', (c) => ({ p_invite: param(c), p_accept: true })));
add(route('post', '/api/v1/mm/party/invites/{id}/decline', { summary: 'Rechazar una invitación', request: { params: IdParam } }),
  action('mm_party_respond', (c) => ({ p_invite: param(c), p_accept: false })));
add(route('delete', '/api/v1/mm/party', { summary: 'Salir del grupo' }), action('mm_party_leave'));
add(route('delete', '/api/v1/mm/party/members/{id}', { summary: 'Sacar a alguien del grupo', request: { params: IdParam } }),
  action('mm_party_kick', (c) => ({ p_player: param(c) })));
add(route('post', '/api/v1/mm/party/leader', { summary: 'Pasar el liderazgo', request: jsonBody(PlayerBody) }),
  action('mm_party_promote', (c) => ({ p_player: body<{ player_id: string }>(c).player_id })));

add(route('post', '/api/v1/mm/blocks', { summary: 'Bloquear a un jugador', request: jsonBody(PlayerBody) }),
  action('mm_block', (c) => ({ p_player: body<{ player_id: string }>(c).player_id })));
add(route('delete', '/api/v1/mm/blocks/{id}', { summary: 'Sacar un bloqueo', request: { params: IdParam } }),
  action('mm_unblock', (c) => ({ p_player: param(c) })));
add(route('post', '/api/v1/mm/friends', { summary: 'Sumar a amigos', request: jsonBody(PlayerBody) }),
  action('mm_add_friend', (c) => ({ p_player: body<{ player_id: string }>(c).player_id })));
add(route('delete', '/api/v1/mm/friends/{id}', { summary: 'Sacar de amigos', request: { params: IdParam } }),
  action('mm_remove_friend', (c) => ({ p_player: param(c) })));
add(route('post', '/api/v1/mm/commends', { summary: 'Felicitar a un jugador', request: jsonBody(Commend) }), action('mm_commend', (c) => {
  const b = body<{ lobby_id: string; player_id: string }>(c);
  return { p_lobby: b.lobby_id, p_player: b.player_id };
}));
add(route('post', '/api/v1/mm/reports', { summary: 'Reportar a un jugador', request: jsonBody(Report) }), action('mm_report', (c) => {
  const b = body<{ lobby_id: string; player_id: string; reason: string; note?: string }>(c);
  return { p_lobby: b.lobby_id, p_player: b.player_id, p_reason: b.reason, p_note: b.note ?? null };
}));

add(route('put', '/api/v1/mm/sounds/selected', { summary: 'Elegir el sonido de partida', request: jsonBody(Sound) }),
  action('mm_set_sound', (c) => ({ p_sound: body<{ sound_id: string | null }>(c).sound_id })));
add(route('post', '/api/v1/mm/sounds/mine', { summary: 'Subir mi sonido (VIP)', request: { body: multipart(AudioForm) } }), async (c) => {
  const file = form(c).file;
  // Se valida antes de subir: sin VIP no se guarda nada.
  if (!must(await c.var.sb.rpc('is_vip' as never, { p_user: c.var.user.id } as never))) {
    throw new AppError(403, 'FORBIDDEN', 'Subir tu propio sonido es exclusivo para VIP.');
  }
  const { path, url } = await uploadSound(c, c.var.user.id, file);
  try {
    await rpc(c, 'mm_set_my_sound', { p_name: file.name.slice(0, 40) || 'Mi sonido', p_url: url });
  } catch (e) {
    await c.var.sb.storage.from('sounds').remove([path]);
    throw e;
  }
  return state(c);
});
add(route('delete', '/api/v1/mm/sounds/mine', { summary: 'Borrar mi sonido' }), async (c) => {
  await removeSound(c, await rpc(c, 'mm_delete_my_sound'));
  return state(c);
});

// Administración.
add(route('get', '/api/v1/admin/mm/config', { summary: 'Configuración', guard: requireAdmin }), async (c) => c.json((await rpc(c, 'mm_admin_config')) as never, 200));
add(route('patch', '/api/v1/admin/mm/config', { summary: 'Cambiar la configuración', guard: requireAdmin, request: jsonBody(Config) }),
  async (c) => c.json((await rpc(c, 'mm_set_config', { p: body<unknown>(c) })) as never, 200));
add(route('get', '/api/v1/admin/mm/lobbies', { summary: 'Salas activas', guard: requireAdmin }), lists('lobbies'));
add(route('post', '/api/v1/admin/mm/lobbies/{id}/cancel', { summary: 'Cancelar una sala', guard: requireAdmin, request: { params: IdParam } }), async (c) => {
  await rpc(c, 'mm_admin_cancel', { p_lobby: param(c) });
  return c.json({ ok: true } as never, 200);
});
add(route('get', '/api/v1/admin/mm/servers', { summary: 'Servidores y contraseña vigente', guard: requireAdmin }), lists('servers'));
add(route('get', '/api/v1/admin/mm/servers/{id}/passwords', { summary: 'Historial de contraseñas', guard: requireAdmin, request: { params: IdParam } }), lists('passwords', param));
add(route('post', '/api/v1/admin/mm/servers/{id}/password', { summary: 'Rotar la contraseña', guard: requireAdmin, request: { params: IdParam } }),
  async (c) => c.json((await rpc(c, 'mm_admin_rotate_password', { p_server: param(c) })) as never, 200));
const ModeParam = z.object({ mode: z.string().max(10) });
const modeOf = (c: C) => (c.req as unknown as { valid(t: 'param'): { mode: string } }).valid('param').mode;
add(route('get', '/api/v1/admin/mm/maps/{mode}', { summary: 'Mapas del veto de un modo', guard: requireAdmin, request: { params: ModeParam } }), lists('maps', modeOf));
add(route('put', '/api/v1/admin/mm/maps/{mode}', { summary: 'Cambiar los mapas del veto', guard: requireAdmin, request: { params: ModeParam, ...jsonBody(Maps) } }), async (c) => {
  await rpc(c, 'mm_set_mode_maps', { p_mode: modeOf(c), p_maps: body<{ maps: string[] }>(c).maps });
  return lists('maps', modeOf)(c);
});
add(route('get', '/api/v1/admin/mm/reports', { summary: 'Reportes', guard: requireModerator }), lists('reports'));
add(route('post', '/api/v1/admin/mm/reports/{id}/resolve', { summary: 'Resolver un reporte', guard: requireModerator, request: { params: IdParam, ...jsonBody(Resolve) } }), async (c) => {
  const b = body<{ action: string; days?: number }>(c);
  await rpc(c, 'mm_admin_resolve_report', { p_report: param(c), p_action: b.action === 'ban' ? 'mm_ban' : b.action, p_days: b.days ?? null });
  return c.json({ ok: true } as never, 200);
});
add(route('get', '/api/v1/admin/mm/bans', { summary: 'Exclusiones vigentes', guard: requireModerator }), lists('bans'));
add(route('delete', '/api/v1/admin/mm/bans/{id}', { summary: 'Levantar una exclusión', guard: requireAdmin, request: { params: IdParam } }), async (c) => {
  await rpc(c, 'mm_admin_unban', { p_user: param(c) });
  return c.json({ ok: true } as never, 200);
});
add(route('get', '/api/v1/admin/mm/stats', { summary: 'Métricas', guard: requireAdmin, request: { query: z.object({ days: z.coerce.number().int().min(1).max(90).default(7) }) } }),
  lists('stats', (c) => String((c.req as unknown as { valid(t: 'query'): { days: number } }).valid('query').days)));
add(route('get', '/api/v1/admin/mm/sounds', { summary: 'Sonidos del catálogo', guard: requireAdmin }), async (c) => c.json({ items: await rpc(c, 'mm_admin_sounds') } as never, 200));
add(route('post', '/api/v1/admin/mm/sounds', { summary: 'Subir un sonido', guard: requireAdmin, request: { body: multipart(AudioForm.extend({ name: z.string().trim().min(1).max(40) })) } }), async (c) => {
  const { file, name } = form(c);
  const { path, url } = await uploadSound(c, 'catalogo', file);
  try {
    return c.json((await rpc(c, 'mm_admin_sound_add', { p_name: name, p_url: url })) as never, 200);
  } catch (e) {
    await c.var.sb.storage.from('sounds').remove([path]);
    throw e;
  }
});
add(route('delete', '/api/v1/admin/mm/sounds/{id}', { summary: 'Borrar un sonido', guard: requireAdmin, request: { params: IdParam } }), async (c) => {
  await removeSound(c, await rpc(c, 'mm_admin_sound_delete', { p_id: param(c) }));
  return c.json({ ok: true } as never, 200);
});

export const mm = r;
