import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requireAdmin, requireUser } from '../lib/auth';
import { inBackground } from '../lib/background';
import { must, mustHave, notFound, searchTerm } from '../lib/db';
import { envelope, runList } from '../lib/list';
import { AppError, fromAuthError, fromPostgrest } from '../lib/errors';
import { randomPassword } from '../lib/password';
import { anonClient, serviceClient } from '../lib/supabase';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { AVATAR_MAX_BYTES, readImage, storageError } from '../lib/uploads';
import {
  AdminAccountStatus,
  AdminAliasBody,
  AdminPlayer,
  AdminPlayerCreate,
  AdminPlayerPatch,
  AdminRandomPassword,
  AdminUserList,
  AdminUserQuery,
  BlockedHitList,
  BlockedHitQuery,
  BlockedWord,
  BlockedWordBody,
  BlockedWordList,
  BlockedWordQuery,
  IdParam,
  MedalBody,
  PlayerIpList,
  SteamLinkBody,
  SteamUnlinkedList,
  SteamUnlinkedQuery,
} from '../schemas/admin';
import { bearer, errorResponses, json } from '../schemas/common';
import { AvatarResult, AvatarUpload } from '../schemas/profile';
import { Medal, PlayerVerification, verificationOf } from '../schemas/players';
import { vipStatusOf } from '../services/vip';
import { designOf, loadDefinitions } from '../services/medals';

type C = Context<AppEnv>;
const PLAYER = 'id, nick, user_id, steam_id, photo_url, privacy, bio, achievements, team_history';
const done = { 204: { description: 'Hecho' } } as const;

/** Si el nombre tiene una palabra bloqueada y no se pidió forzar: 400 con la palabra, para ofrecer "Guardar igual". */
export async function checkBlocked(c: C, names: (string | undefined)[], force: boolean, path: string) {
  if (force) return;
  for (const name of names) {
    if (!name) continue;
    const word = must(await c.var.sb.rpc('admin_name_blocked', { p: name }));
    if (word) {
      const message = `"${name}" contiene una palabra bloqueada (${word}). Para guardarlo igual, mandá force: true.`;
      throw new AppError(400, 'BUSINESS_RULE', message, [{ path, message }]);
    }
  }
}

// ---------- jugadores ----------

const createPlayer = createRoute({
  method: 'post', path: '/api/v1/admin/players', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Crear un jugador',
  description: 'El SteamID se vincula aparte (`POST /api/v1/admin/steam/link`), así sus partidas pasan al jugador.',
  request: { body: { required: true, ...json(AdminPlayerCreate) } },
  responses: { 201: { description: 'Creado', ...json(AdminPlayer) }, ...errorResponses(400, 401, 403, 409) },
});
const patchPlayer = createRoute({
  method: 'patch', path: '/api/v1/admin/players/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Editar un jugador',
  description: 'Solo lo enviado. El nick solo se cambia en jugadores sin cuenta (en los vinculados es el alias de la cuenta).',
  request: { params: IdParam, body: { required: true, ...json(AdminPlayerPatch) } },
  responses: { 200: { description: 'Actualizado', ...json(AdminPlayer) }, ...errorResponses(400, 401, 403, 404, 409) },
});
// Insignia de verificado (replanteo 90): gris o dorada, con el motivo del tooltip. kind null la saca.
const VerificationBody = z
  .object({ kind: z.enum(['gray', 'gold']).nullable(), note: z.string().max(60).nullish() })
  .openapi('AdminPlayerVerification');
const setVerification = createRoute({
  method: 'put', path: '/api/v1/admin/players/{id}/verification', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Poner, cambiar o sacar la insignia de verificado',
  description: 'Solo admins. `kind` null la saca (y el motivo con ella).',
  request: { params: IdParam, body: { required: true, ...json(VerificationBody) } },
  responses: { 200: { description: 'La insignia como queda', ...json(z.object({ verification: PlayerVerification.nullable() })) }, ...errorResponses(400, 401, 403, 404) },
});
const deletePlayer = createRoute({
  method: 'delete', path: '/api/v1/admin/players/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Borrar un jugador', description: 'Falla con un mensaje si tiene partidas jugadas.',
  request: { params: IdParam },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});
const uploadPhoto = createRoute({
  method: 'post', path: '/api/v1/admin/players/{id}/photo', tags: ['Admin'], security: bearer,
  middleware: [
    requireUser,
    requireAdmin,
    bodyLimit({
      maxSize: AVATAR_MAX_BYTES + 16 * 1024,
      onError: () => {
        throw new AppError(413, 'FILE_TOO_LARGE', 'La imagen pesa más de 1024 KB.');
      },
    }),
  ] as const,
  summary: 'Foto de un jugador', description: '`multipart/form-data`, campo `file`. JPEG, PNG o WebP de hasta 1 MB.',
  request: { params: IdParam, body: { required: true, content: { 'multipart/form-data': { schema: AvatarUpload } } } },
  responses: { 200: { description: 'Foto actualizada', ...json(AvatarResult) }, ...errorResponses(400, 401, 403, 404, 413) },
});
const addMedal = createRoute({
  method: 'post', path: '/api/v1/admin/players/{id}/medals', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Dar una medalla',
  description: 'Una definición manual (Comunidad: staff, caster, campeón de torneo…). El título, si no viene, es el de la definición.',
  request: { params: IdParam, body: { required: true, ...json(MedalBody) } },
  responses: { 201: { description: 'Medalla', ...json(Medal) }, ...errorResponses(400, 401, 403, 404) },
});
const deleteMedal = createRoute({
  method: 'delete', path: '/api/v1/admin/medals/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Quitar una medalla', request: { params: IdParam },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});

const playerIps = createRoute({
  method: 'get', path: '/api/v1/admin/players/{id}/ips', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'IPs de un jugador',
  description:
    'Las IPs desde las que entró al servidor con cualquiera de sus SteamID (las registra el reporter 2.6.0 al entrar), ' +
    'la más reciente primero, con las otras fichas que usaron la misma IP. Dato personal: solo admin.',
  request: { params: IdParam },
  responses: { 200: { description: 'IPs', ...json(PlayerIpList) }, ...errorResponses(400, 401, 403, 404) },
});

// ---------- SteamID ----------

const unlinked = createRoute({
  method: 'get', path: '/api/v1/admin/steam/unlinked', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'SteamIDs sin vincular', description: 'SteamIDs que jugaron y no tienen jugador. Por defecto, el último en jugar primero.',
  request: { query: SteamUnlinkedQuery },
  responses: { 200: { description: 'SteamIDs', ...json(SteamUnlinkedList) }, ...errorResponses(400, 401, 403) },
});
const steamLink = createRoute({
  method: 'post', path: '/api/v1/admin/steam/link', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Vincular un SteamID',
  description: 'Suma el SteamID a la ficha (principal si no tiene, adicional si ya tiene; hasta 4) y le pasa todas sus partidas. Si une historiales, recalcula el ELO de esa ficha (los demás no cambian).`player_id: null` lo quita de su ficha.',
  request: { body: { required: true, ...json(SteamLinkBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403, 409) },
});

// ---------- usuarios y alias ----------

const users = createRoute({
  method: 'get', path: '/api/v1/admin/users', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Usuarios', description: 'Alias, rol y jugador vinculado.',
  request: { query: AdminUserQuery },
  responses: { 200: { description: 'Usuarios', ...json(AdminUserList) }, ...errorResponses(400, 401, 403) },
});
const userAlias = createRoute({
  method: 'put', path: '/api/v1/admin/users/{id}/alias', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar el alias de un usuario',
  description: 'Moderación: sin la espera de 15 días. Respeta la unicidad. Con una palabra bloqueada pide `force: true`.',
  request: { params: IdParam, body: { required: true, ...json(AdminAliasBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403, 409) },
});

// ---------- acciones de cuenta (plan docs/bitacora/2026-11-03-admin-cuentas-usuarios) ----------

const accountStatus = createRoute({
  method: 'get', path: '/api/v1/admin/users/{id}/account', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Estado de la cuenta', description: 'Si confirmó su correo, su último inicio de sesión y el correo (solo lectura).',
  request: { params: IdParam },
  responses: { 200: { description: 'Estado', ...json(AdminAccountStatus) }, ...errorResponses(401, 403, 404) },
});
const accountResend = createRoute({
  method: 'post', path: '/api/v1/admin/users/{id}/resend-confirmation', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Reenviar el correo de activación', description: 'Solo a una cuenta que todavía no confirmó su correo (si no, 409).',
  request: { params: IdParam },
  responses: { ...done, ...errorResponses(401, 403, 404, 409, 429) },
});
const accountReset = createRoute({
  method: 'post', path: '/api/v1/admin/users/{id}/send-password-reset', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Enviar el correo para cambiar la contraseña',
  request: { params: IdParam },
  responses: { ...done, ...errorResponses(401, 403, 404, 429) },
});
const accountRandom = createRoute({
  method: 'post', path: '/api/v1/admin/users/{id}/random-password', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar la contraseña por una aleatoria',
  description: 'La devuelve una sola vez y cierra las sesiones de la cuenta. No se puede usar sobre la cuenta propia ni sobre otro admin.',
  request: { params: IdParam },
  responses: { 200: { description: 'La contraseña nueva', ...json(AdminRandomPassword) }, ...errorResponses(401, 403, 404, 501) },
});

// ---------- palabras bloqueadas ----------

const words = createRoute({
  method: 'get', path: '/api/v1/admin/blocked-words', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Palabras bloqueadas',
  request: { query: BlockedWordQuery },
  responses: { 200: { description: 'Palabras', ...json(BlockedWordList) }, ...errorResponses(400, 401, 403) },
});
const addWord = createRoute({
  method: 'post', path: '/api/v1/admin/blocked-words', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Bloquear una palabra',
  description: 'Se guarda normalizada (minúsculas, sin tildes, espacios ni leetspeak). Desde ese momento se rechaza en alias, equipos y solicitudes.',
  request: { body: { required: true, ...json(BlockedWordBody) } },
  responses: { 201: { description: 'Bloqueada', ...json(BlockedWord) }, ...errorResponses(400, 401, 403, 409) },
});
const deleteWord = createRoute({
  method: 'delete', path: '/api/v1/admin/blocked-words/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Desbloquear una palabra', request: { params: IdParam },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});
const hits = createRoute({
  method: 'get', path: '/api/v1/admin/blocked-words/hits', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Nombres actuales con palabras bloqueadas',
  description: 'Alias, nicks de jugadores sin cuenta y nombres o siglas de equipos oficiales, para corregirlos.',
  request: { query: BlockedHitQuery },
  responses: { 200: { description: 'Coincidencias', ...json(BlockedHitList) }, ...errorResponses(400, 401, 403) },
});

export const adminPlayers = createRouter()
  .openapi(createPlayer, async (c) => {
    const { force, ...body } = c.req.valid('json');
    if (!body.user_id) await checkBlocked(c, [body.nick], force, 'nick');
    const row = mustHave(await c.var.sb.from('players').insert(body).select(PLAYER).single());
    return c.json(row, 201);
  })
  .openapi(patchPlayer, async (c) => {
    const { id } = c.req.valid('param');
    const { force, ...body } = c.req.valid('json');
    const cur = must(await c.var.sb.from('players').select('user_id').eq('id', id).maybeSingle());
    if (!cur) throw notFound('ese jugador');
    const linked = body.user_id !== undefined ? body.user_id : cur.user_id;
    if (body.nick !== undefined) {
      if (linked) throw new AppError(400, 'BUSINESS_RULE', 'El nombre de un jugador con cuenta es su alias: cambiá el alias del usuario.');
      await checkBlocked(c, [body.nick], force, 'nick');
    }
    // supabase-js omite las claves undefined: solo se cambia lo enviado.
    const row = mustHave(await c.var.sb.from('players').update(body).eq('id', id).select(PLAYER).single());
    return c.json(row, 200);
  })
  .openapi(setVerification, async (c) => {
    const { id } = c.req.valid('param');
    const { kind, note } = c.req.valid('json');
    must(await c.var.sb.rpc('admin_player_verify' as never, { p_player: id, p_kind: kind, p_note: note ?? null } as never));
    const row = must(await c.var.sb.from('players').select('verified, verified_note').eq('id', id).maybeSingle());
    if (!row) throw notFound('ese jugador');
    return c.json({ verification: verificationOf(row.verified, row.verified_note) }, 200);
  })
  .openapi(deletePlayer, async (c) => {
    const { id } = c.req.valid('param');
    const gone = mustHave(await c.var.sb.from('players').delete().eq('id', id).select('id'));
    if (!gone.length) throw notFound('ese jugador');
    return c.body(null, 204);
  })
  .openapi(uploadPhoto, async (c) => {
    const { id } = c.req.valid('param');
    const { sb } = c.var;
    const player = must(await sb.from('players').select('photo_url').eq('id', id).maybeSingle());
    if (!player) throw notFound('ese jugador');
    const { bytes, type } = await readImage(c.req.valid('form').file, AVATAR_MAX_BYTES);
    const bucket = sb.storage.from('photos');
    const path = `players/${id}/${Date.now()}.${type.ext}`;
    const up = await bucket.upload(path, bytes, { contentType: type.mime, upsert: false });
    if (up.error) throw storageError(up.error);
    const photo_url = bucket.getPublicUrl(path).data.publicUrl;
    const saved = await sb.from('players').update({ photo_url }).eq('id', id);
    if (saved.error) {
      await bucket.remove([path]);
      throw fromPostgrest(saved.error);
    }
    // La foto anterior, si era del bucket, se borra sin demorar la respuesta.
    const marker = '/storage/v1/object/public/photos/';
    const previous = player.photo_url;
    if (previous?.includes(marker)) {
      const old = decodeURIComponent(previous.slice(previous.indexOf(marker) + marker.length));
      inBackground(c, bucket.remove([old]).then((r) => {
        if (r.error) throw new Error(`borrar foto anterior: ${r.error.message}`);
      }));
    }
    return c.json({ avatar_url: photo_url }, 200);
  })
  .openapi(addMedal, async (c) => {
    const { id } = c.req.valid('param');
    const b = c.req.valid('json');
    const def = (await loadDefinitions(c.var.sb, [b.definition_id])).get(b.definition_id);
    if (!def || def.status !== 'active') throw notFound('esa medalla');
    if (def.aggregation !== 'manual') throw new AppError(400, 'BUSINESS_RULE', 'Esa medalla la da el juego o el cierre de temporada, no un admin.');
    const row = mustHave(
      await c.var.sb
        .from('player_medals')
        .insert({ player_id: id, definition_id: def.id, title: b.title ?? def.title, icon: null, source: 'admin' })
        .select('id, title, created_at')
        .single(),
    );
    return c.json({ ...row, source: 'admin' as const, season: null, rank: null, design: designOf(def) }, 201);
  })
  .openapi(deleteMedal, async (c) => {
    const gone = mustHave(await c.var.sb.from('player_medals').delete().eq('id', c.req.valid('param').id).select('id'));
    if (!gone.length) throw notFound('esa medalla');
    return c.body(null, 204);
  })
  .openapi(playerIps, async (c) => {
    const { id } = c.req.valid('param');
    const player = must(await c.var.sb.from('players').select('id').eq('id', id).maybeSingle());
    if (!player) throw notFound('ese jugador');
    c.header('Cache-Control', 'no-store');
    const rows = mustHave(await c.var.sb.rpc('admin_player_ips', { p_player: id }));
    return c.json(
      {
        items: rows.map((r) => ({
          ip: r.ip,
          steam_id: r.steam_id,
          first_seen_at: r.first_seen_at,
          last_seen_at: r.last_seen_at,
          times: r.times,
          last_nick: r.last_nick,
          others: Array.isArray(r.others) ? (r.others as { id: string; alias: string }[]) : [],
          others_unlinked: r.others_unlinked ?? 0,
        })),
      },
      200,
    );
  })
  .openapi(unlinked, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('steam_unlinked').select('steam_id, last_nick, matches, last_played', { count: 'exact' });
    const term = searchTerm(p.q);
    if (term) q = q.or(`last_nick.ilike.*${term}*,steam_id.ilike.*${term}*`);
    type Row = { steam_id: string | null; last_nick: string | null; matches: number | null; last_played: string | null };
    const { rows, total } = await runList<Row, typeof q>(q, p, {}, 'steam_id');
    return c.json(envelope(rows.map((r) => ({ steam_id: r.steam_id ?? '', last_nick: r.last_nick, matches: r.matches ?? 0, last_played: r.last_played })), total, p), 200);
  })
  .openapi(steamLink, async (c) => {
    const { steam_id, player_id } = c.req.valid('json');
    // link_steam_id acepta null para desvincular aunque el tipo generado diga string.
    must(await c.var.sb.rpc('link_steam_id', { p_steam: steam_id, p_player: player_id as string }));
    return c.body(null, 204);
  })
  .openapi(users, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('admin_user_list').select('id, alias, role, alias_changed_at, player_id, steam_id, is_streamer', { count: 'exact' });
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    if (p.role) q = q.eq('role', p.role);
    if (p.has_player !== undefined) q = q.eq('has_player', p.has_player);
    if (p.has_steam !== undefined) q = q.eq('has_steam', p.has_steam);
    if (p.streamer !== undefined) q = q.eq('is_streamer', p.streamer);
    type Row = {
      id: string; alias: string | null; role: string; alias_changed_at: string | null; player_id: string | null; steam_id: string | null;
      is_streamer: boolean | null;
    };
    const { rows, total } = await runList<Row, typeof q>(q, p, {});
    const vip = await vipStatusOf(c.var.sb, rows.map((u) => u.id));
    return c.json(
      envelope(rows.map(({ is_streamer, ...u }) => ({ ...u, alias: u.alias ?? '', vip: vip.get(u.id) ?? null, streamer: !!is_streamer })), total, p),
      200,
    );
  })
  .openapi(userAlias, async (c) => {
    const { alias, force } = c.req.valid('json');
    must(await c.var.sb.rpc('set_user_tag', { p_user: c.req.valid('param').id, p_tag: alias, p_force: force }));
    return c.body(null, 204);
  })
  .openapi(accountStatus, async (c) => {
    const data = must(await c.var.sb.rpc('admin_account_status', { p_user: c.req.valid('param').id }));
    c.header('Cache-Control', 'no-store');
    return c.json(data as z.infer<typeof AdminAccountStatus>, 200);
  })
  .openapi(accountResend, async (c) => {
    const cfg = c.var.config;
    const { email } = must(await c.var.sb.rpc('admin_account_action', { p_user: c.req.valid('param').id, p_action: 'resend_confirmation' })) as { email: string };
    const { error } = await anonClient(cfg).auth.resend({ type: 'signup', email, options: { emailRedirectTo: cfg.FRONTEND_URL } });
    if (error) throw fromAuthError(error);
    return c.body(null, 204);
  })
  .openapi(accountReset, async (c) => {
    const cfg = c.var.config;
    const { email } = must(await c.var.sb.rpc('admin_account_action', { p_user: c.req.valid('param').id, p_action: 'password_reset_email' })) as { email: string };
    const { error } = await anonClient(cfg).auth.resetPasswordForEmail(email, { redirectTo: `${cfg.FRONTEND_URL}/reset-password` });
    if (error) throw fromAuthError(error);
    return c.body(null, 204);
  })
  .openapi(accountRandom, async (c) => {
    const id = c.req.valid('param').id;
    const admin = serviceClient(c.var.config);
    if (!admin) throw new AppError(501, 'NOT_AVAILABLE', 'Falta configurar la clave de administrador en la API.');
    must(await c.var.sb.rpc('admin_account_action', { p_user: id, p_action: 'random_password' }));
    const password = randomPassword();
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) throw fromAuthError(error);
    // La contraseña ya cambió: si esto falla hay que entregarla igual, y el admin ve que las sesiones siguen abiertas.
    const closed = await c.var.sb.rpc('admin_account_close_sessions', { p_user: id });
    c.header('Cache-Control', 'no-store');
    return c.json({ password, sessions_closed: !closed.error }, 200);
  })
  .openapi(words, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('blocked_words').select('id, word, created_at', { count: 'exact' });
    const term = searchTerm(p.q);
    if (term) q = q.ilike('word', `%${term.replace(/ /g, '')}%`);
    type Row = { id: string; word: string; created_at: string };
    const { rows, total } = await runList<Row, typeof q>(q, p, {});
    return c.json(envelope(rows, total, p), 200);
  })
  .openapi(addWord, async (c) => {
    const row = mustHave(await c.var.sb.from('blocked_words').insert({ word: c.req.valid('json').word }).select('id, word, created_at').single());
    return c.json(row, 201);
  })
  .openapi(deleteWord, async (c) => {
    const gone = mustHave(await c.var.sb.from('blocked_words').delete().eq('id', c.req.valid('param').id).select('id'));
    if (!gone.length) throw notFound('esa palabra');
    return c.body(null, 204);
  })
  .openapi(hits, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.rpc('blocked_names_hits', {}, { count: 'exact' });
    if (p.kind) q = q.eq('kind', p.kind);
    type Row = { kind: string; id: string; name: string; word: string };
    const { rows, total } = await runList<Row, typeof q>(q, p, {});
    return c.json(envelope(rows.map((r) => ({ ...r, kind: r.kind as 'alias' | 'player' | 'team' })), total, p), 200);
  });
