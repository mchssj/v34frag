import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Pendientes del frontend (E9 a E18 y E20) contra la Supabase local con el replanteo 39
// (plan docs/bitacora/2026-10-30-api-pendientes-frontend).
const app = createApp();
const env = localEnv();
type U = Awaited<ReturnType<typeof createUser>>;

const rnd = () => Math.random().toString(36).slice(2, 8);
const steam = () => '7656119' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0');

async function req(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await app.request(
    path,
    {
      method,
      headers: {
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    },
    env,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** Usuario con jugador vinculado y SteamID. */
async function player() {
  const u = await createUser({ tag: `P${rnd()}` });
  const sid = steam();
  const { data, error } = await admin().from('players').insert({ nick: 'x', user_id: u.id, steam_id: sid }).select('id, nick').single();
  if (error) throw error;
  return { ...u, playerId: data.id as string, alias: data.nick as string, steamId: sid };
}

function check<T extends { error: unknown }>(r: T): T {
  if (r.error) throw r.error;
  return r;
}

let adm: U;
beforeAll(async () => {
  adm = await createUser({ role: 'admin' });
});

describe('partidas (E14 a E18)', () => {
  let p: Awaited<ReturnType<typeof player>>;
  const finished = randomUUID();
  const cancelled = randomUUID();
  const gameNick = `Zeta${rnd()}`;

  beforeAll(async () => {
    p = await player();
    const a = admin();
    check(
      await a.from('matches').insert([
        { id: finished, kind: 'mix', status: 'finished', map: 'de_dust2', score1: 16, score2: 10, winner_side: 1, played_at: new Date().toISOString() },
        { id: cancelled, kind: 'mix', status: 'cancelled', map: 'de_nuke', cancel_reason: 'admin', played_at: new Date().toISOString() },
      ]),
    );
    check(
      await a.from('match_player_stats').insert([
        { match_id: finished, steam_id: p.steamId, team: 1, nick: gameNick, kills: 25, deaths: 10, rounds: 26, rating: 1.5, player_id: p.playerId },
        { match_id: cancelled, steam_id: p.steamId, team: 1, nick: gameNick, kills: 3, deaths: 2, rounds: 4, player_id: p.playerId },
      ]),
    );
  });

  it('status con varios valores, mine, contadores y MVP', async () => {
    const both = await req('GET', '/api/v1/matches?status=finished,cancelled&mine=true', { token: p.token });
    expect(both.status).toBe(200);
    expect(both.body.items.map((m: { id: string }) => m.id).sort()).toEqual([finished, cancelled].sort());
    expect(both.body.counts).toEqual({ all: 2, mix: 2, pcw: 0, official: 0 });
    const fin = both.body.items.find((m: { id: string }) => m.id === finished);
    expect(fin.mvp).toMatchObject({ player_id: p.playerId, game_nick: gameNick, rating: 1.5 });

    const onlyFinished = await req('GET', '/api/v1/matches?status=finished&mine=true', { token: p.token });
    expect(onlyFinished.body.items.map((m: { id: string }) => m.id)).toEqual([finished]);
    // kind no cambia los contadores; el total sí.
    const pcw = await req('GET', '/api/v1/matches?status=finished,cancelled&mine=true&kind=pcw', { token: p.token });
    expect(pcw.body).toMatchObject({ total: 0, items: [], counts: { all: 2, mix: 2, pcw: 0, official: 0 } });
  });

  it('errores y casos sin ficha', async () => {
    expect((await req('GET', '/api/v1/matches?status=finished,bogus')).status).toBe(400);
    expect((await req('GET', '/api/v1/matches?mine=true')).status).toBe(401);
    const noPlayer = await createUser();
    const empty = await req('GET', '/api/v1/matches?mine=true', { token: noPlayer.token });
    expect(empty.body).toMatchObject({ items: [], total: 0, counts: { all: 0, mix: 0, pcw: 0, official: 0 } });
  });

  it('q busca por el nick de los que jugaron', async () => {
    const r = await req('GET', `/api/v1/matches?q=${gameNick.toLowerCase()}`);
    expect(r.body.items.map((m: { id: string }) => m.id).sort()).toEqual([finished, cancelled].sort());
  });
});

describe('solicitud de equipo nuevo (E9, reemplazada por el replanteo 40)', () => {
  it('ya no se piden ni se aprueban equipos: solo queda leer la solicitud vieja', async () => {
    const u = await player();
    expect((await req('PUT', '/api/v1/me/team-request', { token: u.token, body: { name: `Pedido ${rnd()}`, tag: 'ped' } })).status).toBe(404);
    expect((await req('DELETE', '/api/v1/me/team-request', { token: u.token })).status).toBe(404);
    expect((await req('GET', '/api/v1/admin/team-requests', { token: adm.token })).status).toBe(404);
    expect((await req('GET', '/api/v1/me/team-request', { token: u.token })).body).toBeNull();
  });
});

describe('biografía (E12)', () => {
  it('el jugador la escribe; sin ficha, 409', async () => {
    const u = await player();
    const r = await req('PATCH', '/api/v1/me/profile', { token: u.token, body: { bio: '  AWPer.\r\nBusco equipo.  ' } });
    expect(r.status).toBe(200);
    expect(r.body.player.bio).toBe('AWPer.\nBusco equipo.');
    expect((await req('GET', `/api/v1/players/${u.playerId}`)).body.bio).toBe('AWPer.\nBusco equipo.');
    expect((await req('PATCH', '/api/v1/me/profile', { token: u.token, body: { bio: null } })).body.player.bio).toBeNull();
    expect((await req('PATCH', '/api/v1/me/profile', { token: u.token, body: { bio: 'x'.repeat(501) } })).status).toBe(400);

    const noPlayer = await createUser();
    const conflict = await req('PATCH', '/api/v1/me/profile', { token: noPlayer.token, body: { bio: 'hola' } });
    expect(conflict.status).toBe(409);
  });
});

describe('equipo: nombre, disolver y logos (E10, E11 y E13)', () => {
  it('el capitán cambia el nombre una vez cada 30 días y disuelve el equipo', async () => {
    const cap = await player();
    const member = await player();
    const created = await req('POST', '/api/v1/admin/teams', {
      token: adm.token,
      body: { name: `Furia ${rnd()}`, tag: 'FUR', captain_player_id: cap.playerId },
    });
    const team = created.body.id as string;
    check(await admin().from('team_members').insert({ team_id: team, player_id: member.playerId, joined_at: new Date().toISOString() }));

    const name = `Nuevo ${rnd()}`;
    // Sigla al azar: la base local guarda los equipos de otras corridas.
    const tag = rnd().slice(0, 5).toUpperCase();
    expect((await req('PATCH', `/api/v1/teams/${team}`, { token: member.token, body: { name } })).status).toBe(403);
    expect((await req('PATCH', `/api/v1/teams/${team}`, { token: cap.token, body: { name, tag: tag.toLowerCase(), looking_for: ['sub'] } })).status).toBe(204);
    const detail = (await req('GET', `/api/v1/teams/${team}`)).body;
    expect(detail).toMatchObject({ name, tag, looking_for: ['sub'], dissolved_at: null, name_changed_at: expect.any(String) });
    expect(new Date(detail.next_name_change_at).getTime() - new Date(detail.name_changed_at).getTime()).toBe(30 * 86_400_000);
    const again = await req('PATCH', `/api/v1/teams/${team}`, { token: cap.token, body: { tag: 'OTR' } });
    expect(again.status).toBe(409);
    expect(again.body.error.details.next_change_at).toEqual(expect.any(String));
    // looking_for solo no cuenta como cambio de nombre.
    expect((await req('PATCH', `/api/v1/teams/${team}`, { token: cap.token, body: { looking_for: [] } })).status).toBe(204);

    // E13: el historial del jugador trae el logo (null: sin logo).
    const hist = (await req('GET', `/api/v1/players/${member.playerId}/teams`)).body.items;
    expect(hist).toEqual([expect.objectContaining({ team: { id: team, name, tag, logo_url: null } })]);

    expect((await req('POST', `/api/v1/teams/${team}/dissolve`, { token: member.token })).status).toBe(403);
    expect((await req('POST', `/api/v1/teams/${team}/dissolve`, { token: cap.token })).status).toBe(204);
    expect((await req('POST', `/api/v1/teams/${team}/dissolve`, { token: cap.token })).status).toBe(409);
    expect((await req('GET', `/api/v1/teams/${team}`)).body).toMatchObject({ dissolved_at: expect.any(String), members: 0 });
    const list = await req('GET', `/api/v1/teams?q=${encodeURIComponent(name)}`);
    expect(list.body.items).toEqual([]);
    expect((await req('GET', `/api/v1/me/teams`, { token: member.token })).body).toEqual([]);
    expect((await req('GET', `/api/v1/me/profile`, { token: cap.token })).body.teams).toEqual([]);
    const notif = await req('GET', '/api/v1/notifications?per=5', { token: member.token });
    expect(notif.body.items.map((n: { type: string }) => n.type)).toContain('team_dissolved');
    expect((await req('POST', `/api/v1/teams/${randomUUID()}/dissolve`, { token: cap.token })).status).toBe(404);
  });
});
