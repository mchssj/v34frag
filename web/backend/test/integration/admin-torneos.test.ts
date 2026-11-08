import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv, approveEvent } from './local';

// Gestión de torneos (replanteo 41): moderadores, siembra por ranking con etapas del suizo y mapas de una serie.
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

/** Equipo oficial 1v1: un jugador con SteamID. */
async function team() {
  const sb = admin();
  const t = (await sb.from('teams').insert({ name: `AT ${rnd()}`, tag: rnd().slice(0, 5).toUpperCase(), kind: 'official' }).select('id').single()).data!;
  const p = (await sb.from('players').insert({ nick: `AT${rnd()}${rnd()}`, steam_id: steam() }).select('id, steam_id').single()).data!;
  const r = await sb.from('team_members').insert({ team_id: t.id, player_id: p.id, joined_at: new Date().toISOString() });
  if (r.error) throw r.error;
  return { id: t.id as string, player: p.id as string, steam: p.steam_id as string };
}

async function register(ev: string, t: Awaited<ReturnType<typeof team>>) {
  const sb = admin();
  const a = await sb.from('tournament_registrations').insert({ event_id: ev, team_id: t.id });
  if (a.error) throw a.error;
  const b = await sb.from('tournament_registration_players').insert({ event_id: ev, team_id: t.id, player_id: t.player });
  if (b.error) throw b.error;
}

let adm: U;
let org: U;
let mod: U;
beforeAll(async () => {
  adm = await createUser({ role: 'admin' });
  org = await createUser({ tag: `Org${rnd()}` });
  mod = await createUser({ tag: `Mod${rnd()}` });
  expect((await req('PUT', `/api/v1/admin/users/${org.id}/role`, { token: adm.token, body: { role: 'organizer' } })).status).toBe(204);
  expect((await req('PUT', `/api/v1/admin/users/${mod.id}/role`, { token: adm.token, body: { role: 'moderator' } })).status).toBe(204);
});

describe('moderadores y siembra', () => {
  it('el moderador siembra por ranking y las etapas del suizo salen de la siembra; no cancela ni borra', async () => {
    const ev = (await req('POST', '/api/v1/events', { token: org.token, body: { name: `Suizo AT ${rnd()}`, template: 'swiss', game_mode: '1v1', config: { stages: 2, size: 8, wins: 2 } } })).body.id;
    await approveEvent(ev);
    expect(ev).toBeTruthy();
    const ts = [];
    for (let i = 0; i < 12; i++) ts.push(await team());
    for (const t of ts) await register(ev, t);

    expect((await req('GET', `/api/v1/events/${ev}`, { token: mod.token })).body.viewer).toEqual({ can_manage: true, can_own: false, can_review: true, can_approve: true });
    expect((await req('GET', '/api/v1/servers', { token: mod.token })).status).toBe(200);
    expect((await req('GET', `/api/v1/events/${ev}`, { token: org.token })).body.viewer).toEqual({ can_manage: true, can_own: true, can_review: false, can_approve: false });

    const s = await req('POST', `/api/v1/events/${ev}/seeds/ranking`, { token: mod.token });
    expect(s.status).toBe(200);
    expect(s.body.seeds).toHaveLength(12);
    const regs = (await req('GET', `/api/v1/events/${ev}/registrations?per=100`)).body.items as { team: { id: string }; start_stage: number }[];
    const stageOf = (id: string) => regs.find((r) => r.team.id === id)!.start_stage;
    // 2 etapas de 8: los 4 primeros entran directo a la etapa 2.
    expect(s.body.seeds.slice(0, 4).map((t: { id: string }) => stageOf(t.id))).toEqual([2, 2, 2, 2]);
    expect(s.body.seeds.slice(4).every((t: { id: string }) => stageOf(t.id) === 1)).toBe(true);
    expect((await req('POST', `/api/v1/events/${ev}/generate`, { token: mod.token })).status).toBe(204);

    expect((await req('POST', `/api/v1/events/${ev}/cancel`, { token: mod.token })).status).toBe(403);
    expect((await req('DELETE', `/api/v1/events/${ev}`, { token: mod.token })).status).toBe(403);
    expect((await req('POST', `/api/v1/events/${ev}/reset`, { token: mod.token })).status).toBe(204);
    expect((await req('GET', `/api/v1/events/${ev}`)).body.status).toBe('registration');
    expect((await req('DELETE', `/api/v1/events/${ev}`, { token: org.token })).status).toBe(204);
  });
});

describe('mapas de una serie', () => {
  it('vincular un mix y cargar el resultado a mano, mapa por mapa', async () => {
    const sb = admin();
    const ev = (await req('POST', '/api/v1/events', { token: org.token, body: { name: `Serie AT ${rnd()}`, template: 'single', game_mode: '1v1', config: { bo: 3, bo_semi: 3, bo_final: 3 } } })).body.id;
    await approveEvent(ev);
    const [a, b] = [await team(), await team()];
    await register(ev, a);
    await register(ev, b);
    expect((await req('POST', `/api/v1/events/${ev}/generate`, { token: org.token })).status).toBe(204);
    const final = (await req('GET', `/api/v1/events/${ev}/matches`)).body.items[0];
    const sideOf = (t: string) => (final.side1.team.id === t ? 1 : 2);

    // Un mix de los dos inscritos: el equipo a ganó 16-10 desde el bando 1 del mix.
    const g = (await sb.from('matches').insert({ kind: 'mix', status: 'finished', map: 'de_dust2_ob', score1: 16, score2: 10, played_at: new Date().toISOString() }).select('id').single()).data!.id as string;
    const st = await sb.from('match_player_stats').insert([
      { match_id: g, steam_id: a.steam, player_id: a.player, team: 1, nick: 'a', kills: 20, deaths: 10, rounds: 26, rating: 1.3 },
      { match_id: g, steam_id: b.steam, player_id: b.player, team: 2, nick: 'b', kills: 10, deaths: 20, rounds: 26, rating: 0.7 },
    ]);
    if (st.error) throw st.error;

    expect((await req('GET', `/api/v1/matches/${final.id}/games/candidates`, { token: (await createUser()).token })).status).toBe(403);
    const cands = await req('GET', `/api/v1/matches/${final.id}/games/candidates`, { token: mod.token });
    expect(cands.body.items).toContainEqual(expect.objectContaining({ game_id: g, registered: 2, side1: sideOf(a.id), linked: false, approved: null }));

    // Mapa 1 con el mix, mapa 2 a mano a favor del equipo 1 de la partida: serie 2-0 (o 1-1 si a es el equipo 2).
    const put = await req('PUT', `/api/v1/matches/${final.id}/maps`, {
      token: mod.token,
      body: { maps: [{ game_id: g }, { map: 'de_inferno', r1: 16, r2: 12 }] },
    });
    expect(put.status).toBe(204);
    const d = await req('GET', `/api/v1/matches/${final.id}`);
    expect(d.body.maps_detail).toEqual([
      { map: 'de_dust2_ob', r1: sideOf(a.id) === 1 ? 16 : 10, r2: sideOf(a.id) === 1 ? 10 : 16, game_id: g, approved: true, played_at: expect.any(String) },
      { map: 'de_inferno', r1: 16, r2: 12, game_id: null, approved: null, played_at: null },
    ]);
    expect(d.body.games.map((x: { id: string }) => x.id)).toEqual([g]);
    expect(d.body.series_players).toHaveLength(2);
    expect(d.body.status).toBe(sideOf(a.id) === 1 ? 'finished' : 'live');

    // Sin mapas: la serie vuelve a por jugar y el mix se desvincula.
    expect((await req('PUT', `/api/v1/matches/${final.id}/maps`, { token: org.token, body: { maps: [] } })).status).toBe(204);
    const e = await req('GET', `/api/v1/matches/${final.id}`);
    expect(e.body).toMatchObject({ status: 'upcoming', maps_detail: [], games: [] });

    const bad = await req('PUT', `/api/v1/matches/${final.id}/maps`, { token: org.token, body: { maps: [{ map: 'x', r1: 16 }] } });
    expect(bad.status).toBe(400);
    const tie = await req('PUT', `/api/v1/matches/${final.id}/maps`, { token: org.token, body: { maps: [{ map: 'x', r1: 15, r2: 15 }] } });
    expect(tie.body.error.message).toMatch(/empatado/);
  });
});
