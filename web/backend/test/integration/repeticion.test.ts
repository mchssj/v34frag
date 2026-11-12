import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, localEnv } from './local';

// Repetición 2D y mapa de calor contra la Supabase local (replanteo 92).
const app = createApp();
const env = localEnv({ DEMO_BASE_URL: 'https://demos.test' });
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
const s64 = (i: number) => `7656119${seed}${String(i).padStart(4, '0')}`;
const [principal, adicional, rival] = [s64(0), s64(1), s64(2)];
const ficha = crypto.randomUUID();
const [conTrk, sinTrk, nuke] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
const uid = `srv1-t92-${seed}`;

const get = async (path: string) => {
  const res = await app.request(path, {}, env);
  return { status: res.status, body: (await res.json()) as any };
};
const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};
const kill = (match_id: string, round: number, killer: string | null, victim: string, kx: number | null, vx: number) => ({
  match_id, round, killer_steam: killer, victim_steam: victim, weapon: 'ak47', headshot: false,
  kx, ky: kx === null ? null : kx + 1, vx, vy: vx + 1,
});

beforeAll(async () => {
  const a = admin();
  check(await a.from('players').insert({ id: ficha, nick: `Heat${seed}`, steam_id: principal }));
  check(await a.from('player_extra_steam_ids').insert({ steam_id: adicional, player_id: ficha }));
  const now = Date.now();
  // Un insert con varias filas manda null en las columnas que falten: todas llevan las mismas.
  check(
    await a.from('matches').insert([
      { id: conTrk, external_id: uid, kind: 'mix', status: 'finished', map: 'de_dust2', score1: 13, score2: 7, winner_side: 1,
        demo_status: 'uploaded', demo_key: `demos/2026/11/${uid}.dem`, demo_size: 10, track_key: `tracks/2026/11/${uid}.trk`,
        played_at: new Date(now - 1000).toISOString() },
      { id: sinTrk, external_id: null, demo_status: 'none', demo_key: null, demo_size: null, track_key: null, kind: 'mix', status: 'finished', map: 'de_dust2', score1: 13, score2: 2, winner_side: 1, played_at: new Date(now - 2000).toISOString() },
      { id: nuke, external_id: null, demo_status: 'none', demo_key: null, demo_size: null, track_key: null, kind: 'mix', status: 'finished', map: 'de_nuke', score1: 13, score2: 2, winner_side: 1, played_at: new Date(now).toISOString() },
    ]),
  );
  check(
    await a.from('match_kills').insert([
      kill(conTrk, 1, principal, rival, 100, 200),
      kill(conTrk, 2, rival, principal, 300, 400),
      kill(conTrk, 3, null, adicional, null, 500),
      kill(sinTrk, 1, adicional, rival, 600, 700),
      kill(nuke, 1, principal, rival, 900, 950),
    ]),
  );
});

afterAll(async () => {
  const a = admin();
  await a.from('matches').delete().in('id', [conTrk, sinTrk, nuke]);
  await a.from('players').delete().eq('id', ficha);
});

describe('repetición 2D', () => {
  it('el detalle trae track_url solo si hay .trk', async () => {
    const con = await get(`/api/v1/matches/${conTrk}`);
    expect(con.body).toMatchObject({ id: conTrk });
    expect(con.body.track_url).toBe(`https://demos.test/track/${uid}`);
    expect((await get(`/api/v1/matches/${sinTrk}`)).body.track_url).toBeNull();
  });

  it('las kills con posición de una partida, sin sesión', async () => {
    const r = await get(`/api/v1/matches/${conTrk}/kills`);
    expect(r.status).toBe(200);
    expect(r.body.map).toBe('de_dust2');
    expect(r.body.kills).toHaveLength(3);
    expect(r.body.kills[2]).toMatchObject({ round: 3, killer_steam: null, kx: null, vx: 500 });
    expect((await get(`/api/v1/matches/${crypto.randomUUID()}/kills`)).status).toBe(404);
  });
});

describe('mapa de calor de un jugador', () => {
  it('desde dónde mata, con sus dos SteamID y solo en ese mapa', async () => {
    const r = await get(`/api/v1/players/${ficha}/heatmap?map=de_dust2`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ map: 'de_dust2', kind: 'kills', matches: 2 });
    expect(r.body.points.sort((a: number[], b: number[]) => a[0] - b[0])).toEqual([[100, 101], [600, 601]]);
  });

  it('dónde muere y el tope de partidas', async () => {
    const d = await get(`/api/v1/players/${ficha}/heatmap?map=de_dust2&kind=deaths`);
    expect(d.body.points.sort((a: number[], b: number[]) => a[0] - b[0])).toEqual([[400, 401], [500, 501]]);
    const last = await get(`/api/v1/players/${ficha}/heatmap?map=de_dust2&matches=1`);
    expect(last.body).toMatchObject({ matches: 1, points: [[100, 101]] });
  });

  it('valida el mapa y el tipo', async () => {
    expect((await get(`/api/v1/players/${ficha}/heatmap?map=de dust`)).status).toBe(400);
    expect((await get(`/api/v1/players/${ficha}/heatmap?map=de_dust2&kind=otra`)).status).toBe(400);
  });
});
