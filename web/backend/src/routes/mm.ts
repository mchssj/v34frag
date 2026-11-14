import { createRoute, z } from '@hono/zod-openapi';
import type { Context, MiddlewareHandler } from 'hono';
import { requireAdmin, requireModerator, requireSupport, requireUser } from '../lib/auth';
import { must, mustHave, notFound } from '../lib/db';
import { RATE_RULES, rateLimit } from '../lib/ratelimit';
import { AppError } from '../lib/errors';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { BANNER_MAX_BYTES, readAudio, storageError, SOUND_MAX_BYTES, type ImageShape } from '../lib/uploads';
import { bearer, errorResponses, json } from '../schemas/common';
import { demoUrl } from '../services/matches';
import { removePhoto, savePhoto, dropPhoto } from '../services/photos';
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
  // server_now: las cuentas regresivas de la web se corrigen con el reloj del servidor (el de cada PC puede ir corrido).
  return c.json({ ...s, server_now: new Date().toISOString() } as never, 200);
};
const body = <T>(c: C) => (c.req as unknown as { valid(t: 'json'): T }).valid('json');
const param = (c: C) => (c.req as unknown as { valid(t: 'param'): { id: string } }).valid('param').id;
const jsonBody = (schema: z.ZodTypeAny) => ({ body: { required: true, ...json(schema) } });

/** El estado liviano (mm_my_live): la cola, la sala, el grupo y los contadores. */
const liveState = async (c: C) =>
  c.json({ ...((await rpc(c, 'mm_my_live')) as unknown as object), server_now: new Date().toISOString() } as never, 200);

/**
 * Una acción del jugador: llama a la función y devuelve el estado. Las de la cola, la sala y el grupo devuelven solo el
 * liviano y la web lo combina con el perfil que ya tiene (plan docs/bitacora/2026-11-02-mm-socket-optimizado, mejora B):
 * el completo (mm_my_state) es lo más lento del matchmaking. Las sociales cambian el perfil y siguen con el completo.
 */
const action = (fn: string, args: (c: C) => Record<string, unknown> = () => ({}), part: 'live' | 'full' = 'full') => async (c: C) => {
  await rpc(c, fn, args(c));
  return part === 'live' ? liveState(c) : state(c);
};
const lists = (what: string, arg?: (c: C) => string | undefined) => async (c: C) =>
  c.json((await rpc(c, 'mm_admin_lists', { p_what: what, p_arg: arg?.(c) })) as never, 200);

const Join = z.object({ mode: z.string().max(10), region: z.string().max(60).nullish() }).openapi('MmJoin');
const Report = z.object({ lobby_id: Id, player_id: Id, reason: z.enum(['afk', 'toxic', 'cheat', 'abandon', 'other']), note: z.string().max(500).optional() }).openapi('MmReport');
const Commend = z.object({ lobby_id: Id, player_id: Id }).openapi('MmCommend');
// (replanteo 93) Chat del grupo y denuncia desde ese chat.
const PartyChat = z.object({ message: z.string().trim().min(1).max(300) }).openapi('MmPartyChatBody');
const PartyChatQuery = z.object({ after: z.coerce.number().int().positive().optional().openapi({ description: 'Solo los mensajes posteriores a este id' }) });
const ChatIdParam = z.object({ id: z.coerce.number().int().positive().openapi({ param: { name: 'id', in: 'path' } }) });
const ChatReport = z.object({ reason: z.enum(['afk', 'toxic', 'cheat', 'abandon', 'other']), note: z.string().max(500).optional() }).openapi('MmChatReport');
const Sound = z.object({ sound_id: Id.nullable() }).openapi('MmSoundChoice');
const AutoAccept = z.object({ enabled: z.boolean() }).openapi('MmAutoAccept');
const Resolve = z.object({ action: z.enum(['dismiss', 'warn', 'mm_ban', 'ban', 'server_ban']), days: z.number().int().positive().max(3650).optional() }).openapi('MmResolve');
const Lift = z.object({ reason: z.string().trim().min(3).max(300) }).openapi('MmPenaltyLift');
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
/** Imagen de la tarjeta del MVP (replanteo 54): ancha como el banner de un torneo. */
const MVP_SHAPE: ImageShape = { what: 'La imagen del MVP', ratio: 4, tolerance: 0.05, shape: 'de proporción 4:1', min: [800, 200], max: [2400, 600] };
const ImageForm = z.object({ file: z.instanceof(File).openapi({ type: 'string', format: 'binary' }) });

const form = (c: C) => (c.req as unknown as { valid(t: 'form'): { file: File; name?: string } }).valid('form');

/** "@player Hay gente en la queue, ¡mándate!" y abajo "5v5: 7 buscando · avisó Kyan". El alias va sin markdown ni menciones. */
export function queuePingText(p: { alias: string; queue: Record<string, number> }, role?: string) {
  const who = p.alias.replace(/[\\*_~`|>@#:<]/g, '').slice(0, 32).trim() || 'Alguien';
  const modes = Object.entries(p.queue).filter(([, n]) => n > 0).map(([m, n]) => `${m}: ${n} buscando`);
  return `${role ? `<@&${role}> ` : ''}Hay gente en la queue, ¡mándate!\n${[...modes, `avisó ${who}`].join(' · ')}`;
}

const r = createRouter();
const add = (def: ReturnType<typeof route>, handler: (c: C) => Promise<Response>) => r.openapi(def as never, handler as never);

add(route('get', '/api/v1/mm/state', { summary: 'Estado de mi matchmaking (completo)' }), state);
// (replanteo 59) El estado en dos partes: lo que cambia rápido y lo que casi no cambia. Las estadísticas de una partida
// terminada salen aparte, una sola vez.
add(route('get', '/api/v1/mm/state/live', { summary: 'Estado liviano: cola, sala (sin estadísticas), grupo y contadores' }), async (c) => {
  // (replanteo 63) La web sin socket pide esto cada 5 s: cuenta como que sigue conectado.
  c.var.mmPolled?.(c.var.user.id);
  return liveState(c);
});
// (replanteo 115) La última sala terminada, aparte del estado liviano (que trae solo last_lobby_ref): la web la pide
// cuando cambia `rev`. null si no jugó.
add(route('get', '/api/v1/mm/last-lobby', { summary: 'Mi última sala terminada (sin estadísticas)' }), async (c) =>
  c.json(((await rpc(c, 'mm_my_last_lobby')) ?? null) as never, 200));
add(route('get', '/api/v1/mm/profile',{ summary: 'Lo que casi no cambia: mi ficha, últimas partidas, amigos, sonidos y sanciones' }), async (c) =>
  c.json({ ...((await rpc(c, 'mm_my_profile')) as unknown as object), server_now: new Date().toISOString() } as never, 200));
add(route('get', '/api/v1/mm/lobbies/{id}/match', { summary: 'La partida de una sala que jugué, con las estadísticas y los clips', request: { params: IdParam } }), async (c) => {
  const game = (await rpc(c, 'mm_lobby_match', { p_lobby: param(c) })) as unknown as GameRef | null;
  if (game?.game_id) await withGame(c, game);
  return c.json((game ?? null) as never, 200);
});
// (replanteo 78) El detalle de una partida del matchmaking es su sala: cualquiera con sesión, sin el servidor ni el chat.
// null si el juego no es de una sala del matchmaking terminada (la web muestra entonces la sala de mix de siempre).
add(route('get', '/api/v1/mm/games/{id}/room', { summary: 'La sala de una partida del matchmaking terminada (el detalle de la partida)', request: { params: IdParam } }), async (c) => {
  const room = (await rpc(c, 'mm_game_room', { p_game: param(c) })) as unknown as { match?: GameRef | null } | null;
  if (room?.match?.game_id) await withGame(c, room.match);
  return c.json((room ?? null) as never, 200);
});
add(route('post', '/api/v1/mm/queue', { summary: 'Entrar a la cola', request: jsonBody(Join) }), action('mm_join', (c) => {
  const b = body<{ mode: string; region?: string | null }>(c);
  return { p_mode: b.mode, p_region: b.region ?? null };
}, 'live'));
add(route('delete', '/api/v1/mm/queue', { summary: 'Salir de la cola' }), action('mm_leave', undefined, 'live'));

// Aviso de la cola en Discord (replanteo 57). La base decide si se puede (en la cola, uno cada 15 min; el staff siempre) y
// la API publica. allowed_mentions limita la mención al rol: un alias no puede mencionar a nadie.
add(route('get', '/api/v1/mm/queue/ping', { summary: 'Si puedo avisar en Discord que hay gente en la cola' }), async (c) =>
  c.json((await rpc(c, 'mm_queue_ping_status')) as never, 200));
add(route('post', '/api/v1/mm/queue/ping', { summary: 'Avisar en Discord (#avisos) que hay gente en la cola' }), async (c) => {
  const { DISCORD_QUEUE_WEBHOOK_URL: hook, DISCORD_QUEUE_ROLE_ID: role } = c.var.config;
  if (!hook) throw new AppError(501, 'NOT_AVAILABLE', 'El aviso en Discord no está configurado.');
  const ping = (await rpc(c, 'mm_queue_ping')) as unknown as { id: string; alias: string; queue: Record<string, number> };
  const res = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: queuePingText(ping, role), allowed_mentions: { parse: [], roles: role ? [role] : [] } }),
  }).catch(() => null);
  if (!res?.ok) {
    await rpc(c, 'mm_queue_ping_cancel', { p_id: ping.id });
    throw new AppError(502, 'NOT_AVAILABLE', 'Discord no recibió el aviso. Probá de nuevo en un rato.');
  }
  return c.json((await rpc(c, 'mm_queue_ping_status')) as never, 200);
});
// Reemplazos (replanteo 75): la página del link que sale en Discord. La base decide si se puede tomar y solo uno lo consigue.
const TokenParam = z.object({ token: z.string().regex(/^[0-9a-f]{32}$/) });
const token = (c: C) => (c.req as unknown as { valid(t: 'param'): { token: string } }).valid('param').token;
const replaceRoute = (method: 'get' | 'post', summary: string) => {
  const def = route(method, '/api/v1/mm/replace/{token}', { summary, request: { params: TokenParam } });
  return { ...def, middleware: [requireUser, rateLimit(RATE_RULES.replace, (c: C) => `user:${c.var.user.id}`)] } as typeof def;
};
add(replaceRoute('get', 'La partida de un link de reemplazo y si lo puedo tomar'), async (c) =>
  c.json((await rpc(c, 'mm_replace_info', { p_token: token(c) })) as never, 200));
add(replaceRoute('post', 'Entrar como reemplazo: devuelve el estado con la sala'), async (c) => {
  await rpc(c, 'mm_replace_take', { p_token: token(c) });
  return liveState(c);
});
add(route('post', '/api/v1/mm/lobby/accept', { summary: 'Aceptar la partida' }), action('mm_accept', undefined, 'live'));
add(route('post', '/api/v1/mm/lobby/decline', { summary: 'Rechazar la partida' }), action('mm_decline', undefined, 'live'));

add(route('post', '/api/v1/mm/party/invites', { summary: 'Invitar al grupo', request: jsonBody(PlayerBody) }),
  action('mm_party_invite', (c) => ({ p_player: body<{ player_id: string }>(c).player_id }), 'live'));
add(route('post', '/api/v1/mm/party/invites/{id}/accept', { summary: 'Aceptar una invitación', request: { params: IdParam } }),
  action('mm_party_respond', (c) => ({ p_invite: param(c), p_accept: true }), 'live'));
add(route('post', '/api/v1/mm/party/invites/{id}/decline', { summary: 'Rechazar una invitación', request: { params: IdParam } }),
  action('mm_party_respond', (c) => ({ p_invite: param(c), p_accept: false }), 'live'));
add(route('delete', '/api/v1/mm/party', { summary: 'Salir del grupo' }), action('mm_party_leave', undefined, 'live'));
add(route('delete', '/api/v1/mm/party/members/{id}', { summary: 'Sacar a alguien del grupo', request: { params: IdParam } }),
  action('mm_party_kick', (c) => ({ p_player: param(c) }), 'live'));
add(route('post', '/api/v1/mm/party/leader', { summary: 'Pasar el liderazgo', request: jsonBody(PlayerBody) }),
  action('mm_party_promote', (c) => ({ p_player: body<{ player_id: string }>(c).player_id }), 'live'));

add(route('post', '/api/v1/mm/blocks', { summary: 'Bloquear a un jugador', request: jsonBody(PlayerBody) }),
  action('mm_block', (c) => ({ p_player: body<{ player_id: string }>(c).player_id })));
add(route('delete', '/api/v1/mm/blocks/{id}', { summary: 'Sacar un bloqueo', request: { params: IdParam } }),
  action('mm_unblock', (c) => ({ p_player: param(c) })));
// (replanteo 85) Amigos con solicitudes: enviar (o aceptar, si ya te había enviado), aceptar, rechazar (en silencio),
// eliminar o cancelar la enviada, y el estado con un jugador para el botón de su perfil.
add(route('post', '/api/v1/mm/friends', { summary: 'Enviar una solicitud de amistad', request: jsonBody(PlayerBody) }),
  action('mm_add_friend', (c) => ({ p_player: body<{ player_id: string }>(c).player_id })));
add(route('delete', '/api/v1/mm/friends/{id}', { summary: 'Eliminar de amigos o cancelar la solicitud enviada', request: { params: IdParam } }),
  action('mm_remove_friend', (c) => ({ p_player: param(c) })));
add(route('post', '/api/v1/mm/friends/{id}/accept', { summary: 'Aceptar la solicitud de amistad de un jugador', request: { params: IdParam } }),
  action('mm_friend_answer', (c) => ({ p_player: param(c), p_accept: true })));
add(route('post', '/api/v1/mm/friends/{id}/reject', { summary: 'Rechazar la solicitud de amistad de un jugador (no se le avisa)', request: { params: IdParam } }),
  action('mm_friend_answer', (c) => ({ p_player: param(c), p_accept: false })));
add(route('get', '/api/v1/mm/friends/{id}', { summary: 'La amistad con un jugador: self, unavailable, friends, received, sent o none', request: { params: IdParam } }),
  async (c) => c.json({ status: await rpc(c, 'mm_friendship', { p_player: param(c) }) } as never, 200));
add(route('post', '/api/v1/mm/commends', { summary: 'Felicitar a un jugador', request: jsonBody(Commend) }), action('mm_commend', (c) => {
  const b = body<{ lobby_id: string; player_id: string }>(c);
  return { p_lobby: b.lobby_id, p_player: b.player_id };
}));
add(route('post', '/api/v1/mm/reports', { summary: 'Reportar a un jugador', request: jsonBody(Report) }), action('mm_report', (c) => {
  const b = body<{ lobby_id: string; player_id: string; reason: string; note?: string }>(c);
  return { p_lobby: b.lobby_id, p_player: b.player_id, p_reason: b.reason, p_note: b.note ?? null };
}));

// (replanteo 93) Chat del grupo: lo leen y escriben solo los del grupo; el socket avisa con 'party.chat'.
add(route('get', '/api/v1/mm/party/chat', { summary: 'Los mensajes de mi grupo (los últimos 50)', request: { query: PartyChatQuery } }), async (c) => {
  const after = (c.req as unknown as { valid(t: 'query'): { after?: number } }).valid('query').after ?? null;
  return c.json({ items: await rpc(c, 'mm_party_chat_list', { p_after: after }) } as never, 200);
});
add(route('post', '/api/v1/mm/party/chat', { summary: 'Escribir en el chat de mi grupo', request: jsonBody(PartyChat) }), async (c) =>
  c.json((await rpc(c, 'mm_party_chat_send', { p_message: body<{ message: string }>(c).message })) as never, 200));
add(route('post', '/api/v1/mm/party/chat/{id}/report', { summary: 'Denunciar al autor de un mensaje del chat del grupo', request: { params: ChatIdParam, ...jsonBody(ChatReport) } }), async (c) => {
  const id = (c.req as unknown as { valid(t: 'param'): { id: number } }).valid('param').id;
  const b = body<{ reason: string; note?: string }>(c);
  await rpc(c, 'mm_report_from_chat', { p_message: id, p_reason: b.reason, p_note: b.note ?? null });
  return c.body(null, 204);
});

add(route('put', '/api/v1/mm/sounds/selected', { summary: 'Elegir el sonido de partida', request: jsonBody(Sound) }),
  action('mm_set_sound', (c) => ({ p_sound: body<{ sound_id: string | null }>(c).sound_id })));
// Autoaceptar partida (replanteo 89): prenderlo es solo para VIP (403); apagarlo, para cualquiera.
add(route('put', '/api/v1/mm/auto-accept', { summary: 'Autoaceptar partida (VIP)', request: jsonBody(AutoAccept) }),
  action('mm_set_auto_accept', (c) => ({ p_on: body<{ enabled: boolean }>(c).enabled })));
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
// (replanteo 116) "Ver sala": la sala completa, como la ve un jugador, con el servidor y sin lo del que mira como jugador.
add(route('get', '/api/v1/admin/mm/lobbies/{id}', { summary: 'Una sala completa (Ver sala)', guard: requireAdmin, request: { params: IdParam } }), async (c) => {
  const room = (await rpc(c, 'mm_admin_lobby', { p_lobby: param(c) })) as unknown as { match?: GameRef | null } | null;
  if (!room) throw notFound('la sala');
  if (room.match?.game_id) await withGame(c, room.match);
  return c.json(room as never, 200);
});
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
// Reportes: solo admin (Daniel, 2026-11-03; replanteo 68).
add(route('get', '/api/v1/admin/mm/reports', { summary: 'Reportes', guard: requireAdmin }), lists('reports'));
add(route('post', '/api/v1/admin/mm/reports/{id}/resolve', { summary: 'Resolver un reporte', guard: requireAdmin, request: { params: IdParam, ...jsonBody(Resolve) } }), async (c) => {
  const b = body<{ action: string; days?: number }>(c);
  await rpc(c, 'mm_admin_resolve_report', { p_report: param(c), p_action: b.action === 'ban' ? 'mm_ban' : b.action, p_days: b.days ?? null });
  return c.json({ ok: true } as never, 200);
});
add(route('get', '/api/v1/admin/mm/bans', { summary: 'Exclusiones vigentes', guard: requireModerator }), lists('bans'));
add(route('delete', '/api/v1/admin/mm/bans/{id}', { summary: 'Levantar una exclusión', guard: requireAdmin, request: { params: IdParam } }), async (c) => {
  await rpc(c, 'mm_admin_unban', { p_user: param(c) });
  return c.json({ ok: true } as never, 200);
});
// Sanciones automáticas de la cola (replanteo 61). Levantar corta la espera y baja un nivel de la escalera.
// También el soporte (replanteo 117); las exclusiones, no.
add(route('get', '/api/v1/admin/mm/penalties', { summary: 'Sanciones de la cola vigentes', guard: requireSupport }), lists('penalties'));
add(route('post', '/api/v1/admin/mm/penalties/{id}/lift', { summary: 'Levantar una sanción de la cola', guard: requireSupport, request: { params: IdParam, ...jsonBody(Lift) } }), async (c) => {
  await rpc(c, 'mm_admin_lift_penalty', { p_user: param(c), p_reason: body<{ reason: string }>(c).reason });
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

// Imagen del MVP (replanteo 54): la sube un admin; la usan la sala del matchmaking y el detalle de un mix.
add(route('get', '/api/v1/mm/mvp-image', { summary: 'Imagen de la tarjeta del MVP' }), async (c) =>
  c.json({ url: ((await rpc(c, 'mm_mvp_image')) as string | null) ?? null } as never, 200));
add(route('put', '/api/v1/admin/mm/mvp-image', { summary: 'Subir la imagen del MVP', guard: requireAdmin, request: { body: multipart(ImageForm) } }), async (c) => {
  const { url, path } = await savePhoto(c, 'mm', form(c).file, BANNER_MAX_BYTES, MVP_SHAPE);
  let old: unknown;
  try {
    old = await rpc(c, 'mm_admin_set_mvp_image', { p_url: url });
  } catch (e) {
    await dropPhoto(c, path);
    throw e;
  }
  removePhoto(c, typeof old === 'string' ? old : null);
  return c.json({ url } as never, 200);
});
add(route('delete', '/api/v1/admin/mm/mvp-image', { summary: 'Quitar la imagen del MVP', guard: requireAdmin }), async (c) => {
  const old = await rpc(c, 'mm_admin_set_mvp_image', { p_url: null });
  removePhoto(c, typeof old === 'string' ? old : null);
  return c.json({ url: null } as never, 200);
});

export const mm = r;
