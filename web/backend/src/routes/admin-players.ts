import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requireAdmin, requireUser } from '../lib/auth';
import { inBackground } from '../lib/background';
import { must, mustHave, notFound, searchTerm } from '../lib/db';
import { envelope, runList } from '../lib/list';
import { AppError, fromPostgrest } from '../lib/errors';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { AVATAR_MAX_BYTES, readImage, storageError } from '../lib/uploads';
import {
  AdminAliasBody,
  AdminPlayer,
  AdminPlayerCreate,
  AdminPlayerPatch,
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
  SteamLinkBody,
  SteamUnlinkedList,
  SteamUnlinkedQuery,
} from '../schemas/admin';
import { bearer, errorResponses, json } from '../schemas/common';
import { AvatarResult, AvatarUpload } from '../schemas/profile';
import { Medal } from '../schemas/players';
import { vipStatusOf } from '../services/vip';

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
  summary: 'Dar una medalla', request: { params: IdParam, body: { required: true, ...json(MedalBody) } },
  responses: { 201: { description: 'Medalla', ...json(Medal) }, ...errorResponses(400, 401, 403) },
});
const deleteMedal = createRoute({
  method: 'delete', path: '/api/v1/admin/medals/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Quitar una medalla', request: { params: IdParam },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
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
  description: 'Suma el SteamID a la ficha (principal si no tiene, adicional si ya tiene; hasta 4) y le pasa todas sus partidas. Si une historiales, recalcula el ELO. `player_id: null` lo quita de su ficha.',
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
    const row = mustHave(await c.var.sb.from('player_medals').insert({ player_id: id, ...c.req.valid('json') }).select('id, title, icon, created_at').single());
    return c.json({ ...row, season: null, rank: null }, 201);
  })
  .openapi(deleteMedal, async (c) => {
    const gone = mustHave(await c.var.sb.from('player_medals').delete().eq('id', c.req.valid('param').id).select('id'));
    if (!gone.length) throw notFound('esa medalla');
    return c.body(null, 204);
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
    let q = c.var.sb.from('admin_user_list').select('id, alias, role, alias_changed_at, player_id, steam_id', { count: 'exact' });
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    if (p.role) q = q.eq('role', p.role);
    if (p.has_player !== undefined) q = q.eq('has_player', p.has_player);
    if (p.has_steam !== undefined) q = q.eq('has_steam', p.has_steam);
    type Row = { id: string; alias: string | null; role: string; alias_changed_at: string | null; player_id: string | null; steam_id: string | null };
    const { rows, total } = await runList<Row, typeof q>(q, p, {});
    const vip = await vipStatusOf(c.var.sb, rows.map((u) => u.id));
    return c.json(envelope(rows.map((u) => ({ ...u, alias: u.alias ?? '', vip: vip.get(u.id) ?? null })), total, p), 200);
  })
  .openapi(userAlias, async (c) => {
    const { alias, force } = c.req.valid('json');
    must(await c.var.sb.rpc('set_user_tag', { p_user: c.req.valid('param').id, p_tag: alias, p_force: force }));
    return c.body(null, 204);
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
