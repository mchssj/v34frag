import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { levelOf } from '../../src/lib/db';
import { admin, createUser, localEnv } from './local';

// Mixes en vivo e interrumpidos contra la Supabase local (migración 20261017120000 y replanteo 16).
const app = createApp();
const env = localEnv();
const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const token = `tok-live-${sfx}`;
const serverId = crypto.randomUUID();
const teamIds = [crypto.randomUUID(), crypto.randomUUID()];
const pcwId = crypto.randomUUID();
const playerIds = Array.from({ length: 6 }, () => crypto.randomUUID());
// SteamID64 únicos por corrida: 7656119 + 10 dígitos.
const steam = (i: number) => `7656119${(Number.parseInt(sfx.slice(-5), 36) % 1_000_000).toString().padStart(6, '0')}${i.toString().padStart(4, '0')}`;
const uid = (s: string) => `lv${sfx}-${s}`;
let adminToken: string;
let userToken: string;
let linkCode: string;

const call = (method: string, path: string, body?: unknown, auth?: string, headers: Record<string, string> = {}) =>
  app.request(
    path,
    {
      method,
      headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );

// Foto o resultado de un mix 3v3 (a = jugadores 0 a 2, b = 3 a 5), como lo arma el plugin.
const payload = (u: string, status: string, a: number, b: number, extra: Record<string, unknown> = {}) => ({
  schema: 1, match_uid: u, map: 'de_inferno', started_at: 1792000000, ended_at: 1792003600, max_rounds: 24, status,
  team_names: { a: `Alfa${sfx}`, b: '' }, demo: false, score: { a, b },
  rounds: Array.from({ length: a + b }, (_, i) => ({ n: i + 1, winner: i < a ? 'a' : 'b', a_side: i < 12 ? 'CT' : 'T', reason: 8 })),
  players: playerIds.map((_, i) => ({ steamid: steam(i), name: `Nick${i}${sfx}`, team: i < 3 ? 'a' : 'b', rounds: a + b, kills: 10 + i, deaths: 8, k1: 5 })),
  ...extra,
});

// Envía como el plugin: base64 en partes de 1400 caracteres a ingest_server_chunk.
async function send(partsUid: string, p: unknown) {
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const b64 = Buffer.from(JSON.stringify(p), 'utf8').toString('base64');
  const n = Math.ceil(b64.length / 1400);
  let id: string | null = null;
  for (let i = 1; i <= n; i++) {
    const r = await sb.rpc('ingest_server_chunk', { p_token: token, p_uid: partsUid, p_part: i, p_total: n, p_data: b64.slice((i - 1) * 1400, i * 1400) });
    if (r.error) throw r.error;
    id = r.data as string | null;
  }
  return id;
}
const live = (u: string, seq: number, a: number, b: number, extra: Record<string, unknown> = {}) =>
  send(`${u}_v${seq}`, payload(u, 'live', a, b, { live_seq: seq, ...extra }));
const crash = (u: string, a: number, b: number, extra: Record<string, unknown> = {}) =>
  send(u, payload(u, 'cancelled', a, b, { cancel_reason: 'crash', cancelled_by: '', ...extra }));

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
  userToken = (await createUser()).token;
  const a = admin();
  const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
  for (const [table, rows] of [
    ['game_servers', [{ id: serverId, name: `Vivo ${sfx}`, token_hash: hash }]],
    ['players', playerIds.map((id, i) => ({ id, nick: `Jv${i}${sfx}`, steam_id: steam(i) }))],
    ['teams', teamIds.map((id, i) => ({ id, name: `Eq${i}${sfx}`, tag: `E${i}`, kind: 'official' }))],
    ['team_members', playerIds.map((player_id, i) => ({ team_id: teamIds[i < 3 ? 0 : 1], player_id }))],
    ['matches', [{ id: pcwId, team1: teamIds[0], team2: teamIds[1], kind: 'pcw', status: 'upcoming', best_of: 1 }]],
  ] as const) {
    const r = await a.from(table).insert(rows as never);
    if (r.error) throw r.error;
  }
  const m = await a.from('matches').select('link_code').eq('id', pcwId).single();
  if (m.error) throw m.error;
  linkCode = m.data.link_code as string;
});

afterAll(async () => {
  const a = admin();
  await a.from('live_matches').delete().like('uid', `lv${sfx}-%`);
  await a.from('matches').delete().like('external_id', `lv${sfx}-%`);
  await a.from('matches').delete().eq('id', pcwId);
  await a.from('team_members').delete().in('team_id', teamIds);
  await a.from('teams').delete().in('id', teamIds);
  await a.from('players').delete().in('id', playerIds);
  await a.from('game_servers').delete().eq('id', serverId);
});

describe('mixes en vivo', () => {
  it('listado con filtros y detalle con ETag', async () => {
    await live(uid('a'), 1, 3, 1, { link_code: linkCode.toLowerCase(), link_side_a: 2 });
    await live(uid('a'), 2, 4, 1, { link_code: linkCode.toLowerCase(), link_side_a: 2 });

    let body = await (await call('GET', `/api/v1/mixes/live?q=alfa${sfx}`)).json();
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({
      uid: uid('a'), server: { id: serverId, name: `Vivo ${sfx}` }, map: 'inferno',
      side1: { name: `Equipo Alfa${sfx}`, score: 4 }, side2: { name: `Mix de Nick5${sfx}`, score: 1 },
      rounds_played: 5, max_rounds: 24, stale: false, parent_match_id: pcwId,
    });
    expect((await (await call('GET', `/api/v1/mixes/live?player=${playerIds[4]}&server=${serverId}`)).json()).total).toBe(1);
    expect((await (await call('GET', `/api/v1/mixes/live?server=${serverId}&stale=true`)).json()).total).toBe(0);
    expect((await call('GET', '/api/v1/mixes/live?sort=score')).status).toBe(400);

    const res = await call('GET', `/api/v1/mixes/live/${uid('a')}`);
    let res2: Response;
    expect(res.status).toBe(200);
    body = await res.json();
    expect(body.seq).toBe(2);
    expect(body.rounds).toHaveLength(5);
    expect(body.rounds[0]).toEqual({ n: 1, winner_side: 1, side1_as: 'CT', reason: 8 });
    expect(body.rounds[4].winner_side).toBe(2);
    expect(body.players).toHaveLength(6);
    expect(body.players[0]).toMatchObject({ side: 1, player_id: playerIds[2], alias: `Jv2${sfx}`, game_nick: `Nick2${sfx}`, steam_id: null });
    expect(typeof body.players[0].rating).toBe('number');
    expect(body.players[0]).toHaveProperty('elo');
    expect(body.players[0]).toHaveProperty('level');
    const etag = res.headers.get('ETag');
    expect(etag).toBeTruthy();
    expect((await call('GET', `/api/v1/mixes/live/${uid('a')}`, undefined, undefined, { 'If-None-Match': etag! })).status).toBe(304);
    // Un uid que nunca existió: 404 sin match_id.
    res2 = await call('GET', `/api/v1/mixes/live/${uid('nada')}`);
    expect(res2.status).toBe(404);
    expect((await res2.json()).error.details).toBeUndefined();
  });

  it('la PCW vinculada muestra el juego en curso con su orden de bandos', async () => {
    const body = await (await call('GET', `/api/v1/matches/${pcwId}`)).json();
    // link_side_a = 2: el bando a del mix es el equipo 2 de la PCW, así que el marcador se da vuelta.
    expect(body.live).toMatchObject({ uid: uid('a'), map: 'inferno', score1: 1, score2: 4, rounds_played: 5, stale: false });
  });
});

describe('mixes interrumpidos', () => {
  it('cerrar como caída: solo admin y solo sin fotos hace 10 minutos', async () => {
    expect((await call('POST', `/api/v1/admin/mixes/live/${uid('a')}/close`, undefined, userToken)).status).toBe(403);
    let res = await call('POST', `/api/v1/admin/mixes/live/${uid('a')}/close`, undefined, adminToken);
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/sigue mandando datos/);

    const r = await admin().from('live_matches').update({ updated_at: new Date(Date.now() - 11 * 60_000).toISOString() }).eq('uid', uid('a'));
    if (r.error) throw r.error;
    expect((await (await call('GET', `/api/v1/mixes/live?server=${serverId}&stale=true`)).json()).total).toBe(1);

    res = await call('POST', `/api/v1/admin/mixes/live/${uid('a')}/close`, undefined, adminToken);
    expect(res.status).toBe(200);
    const { match_id } = await res.json();
    // Ya no está en vivo: el 404 trae la partida para pasar a la sala final.
    res = await call('GET', `/api/v1/mixes/live/${uid('a')}`);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatchObject({ code: 'NOT_FOUND', details: { match_id } });
    expect((await call('POST', `/api/v1/admin/mixes/live/${uid('a')}/close`, undefined, adminToken)).status).toBe(404);

    const d = await (await call('GET', `/api/v1/matches/${match_id}`)).json();
    expect(d).toMatchObject({ status: 'cancelled', cancel_reason: 'crash', review: 'pending' });
    // 5 de 24 rondas: el mínimo es 9.
    expect(d.review_detail).toEqual({ status: 'pending', max_rounds: 24, rounds_played: 5, min_rounds: 9, can_apply: false, blocked_reason: expect.stringMatching(/hacen falta 9/) });
  });

  it('aplicar el ELO: doble confirmación, reglas, vinculación con !match y revisión en el listado', async () => {
    const id = (await crash(uid('b'), 6, 3, { link_code: linkCode, link_side_a: 1 })) as string;
    expect(id).toBeTruthy();
    let list = await (await call('GET', `/api/v1/matches?kind=mix&review=pending&q=alfa${sfx}`)).json();
    expect(list.items.map((m: { id: string }) => m.id)).toContain(id);
    expect(list.items.find((m: { id: string }) => m.id === id)).toMatchObject({ cancel_reason: 'crash', review: 'pending' });
    // El listado único de mixes también trae la revisión (chip "ELO pendiente").
    const mixes = await (await call('GET', `/api/v1/mixes?server=${serverId}&per=100`)).json();
    expect(mixes.items.find((m: { match_id: string | null }) => m.match_id === id)).toMatchObject({ status: 'cancelled', review: 'pending' });

    expect((await call('POST', `/api/v1/admin/mixes/${id}/apply-elo`, { confirm: 'estoy seguro' }, userToken)).status).toBe(403);
    expect((await call('POST', `/api/v1/admin/mixes/${id}/apply-elo`, { confirm: 'si' }, adminToken)).status).toBe(400);
    expect((await call('POST', `/api/v1/admin/mixes/${id}/apply-elo`, { confirm: 'Estoy Seguro' }, adminToken)).status).toBe(204);

    const d = await (await call('GET', `/api/v1/matches/${id}`)).json();
    expect(d).toMatchObject({ status: 'finished', end_reason: 'crash', winner_side: 1, parent_match_id: pcwId, review: 'applied' });
    expect(d.review_detail).toMatchObject({ status: 'applied', can_apply: false, blocked_reason: null });
    expect(d.players.every((p: { elo_delta: number | null }) => p.elo_delta !== null)).toBe(true);
    // ELO actual y nivel de cada jugador: el de player_elo de su SteamID principal.
    const elos = await admin().from('player_elo').select('steam_id, elo').in('steam_id', playerIds.map((_, i) => steam(i)));
    if (elos.error) throw elos.error;
    const byPlayer = new Map<string, number | null>(playerIds.map((pid, i) => [pid, elos.data.find((e) => e.steam_id === steam(i))?.elo ?? null]));
    for (const p of d.players as { player_id: string; elo: number | null; level: number | null }[]) {
      expect(p.elo).toBe(byPlayer.get(p.player_id));
      expect(p.elo).not.toBeNull();
      expect(p.level).toBe(levelOf(p.elo));
    }
    const pcw = await (await call('GET', `/api/v1/matches/${pcwId}`)).json();
    expect(pcw).toMatchObject({ status: 'finished', side1: { score: 1 }, side2: { score: 0 } });
    expect(pcw.games.map((g: { id: string }) => g.id)).toContain(id);

    const again = await call('POST', `/api/v1/admin/mixes/${id}/apply-elo`, { confirm: 'estoy seguro' }, adminToken);
    expect(again.status).toBe(404);
    // Vinculado, el mix toma los nombres de los equipos de la PCW: se busca por jugador.
    list = await (await call('GET', `/api/v1/matches?kind=mix&review=applied&player=${playerIds[0]}`)).json();
    expect(list.items.map((m: { id: string }) => m.id)).toContain(id);
  });

  it('empate y menos del 35 %: no se aplica; descartar', async () => {
    const tie = (await crash(uid('c'), 5, 5)) as string;
    let res = await call('POST', `/api/v1/admin/mixes/${tie}/apply-elo`, { confirm: 'estoy seguro' }, adminToken);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatchObject({ code: 'BUSINESS_RULE', message: expect.stringMatching(/empatados/) });

    expect((await call('POST', `/api/v1/admin/mixes/${tie}/discard`, undefined, userToken)).status).toBe(403);
    expect((await call('POST', `/api/v1/admin/mixes/${tie}/discard`, undefined, adminToken)).status).toBe(204);
    expect((await call('POST', `/api/v1/admin/mixes/${tie}/discard`, undefined, adminToken)).status).toBe(404);
    const d = await (await call('GET', `/api/v1/matches/${tie}`)).json();
    expect(d).toMatchObject({ status: 'cancelled', review: 'discarded' });
    const mixes = await (await call('GET', `/api/v1/mixes?server=${serverId}&per=100`)).json();
    expect(mixes.items.find((m: { match_id: string | null }) => m.match_id === tie)).toMatchObject({ review: 'discarded' });
    res = await call('POST', `/api/v1/admin/mixes/${tie}/apply-elo`, { confirm: 'estoy seguro' }, adminToken);
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/ya se revisó/);
  });

  it('una partida común no tiene revisión', async () => {
    const d = await (await call('GET', `/api/v1/matches/${pcwId}`)).json();
    expect(d.review).toBeNull();
    expect(d.review_detail).toBeNull();
  });
});
