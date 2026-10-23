import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Clips automáticos contra la Supabase local (migración 20261023120000_clips y replanteo 26).
const app = createApp();
const env = localEnv();
let adminToken: string;
let userToken: string;
let before: Record<string, unknown> | null = null;
const matchId = crypto.randomUUID();
const emptyMatch = crypto.randomUUID();
const ficha = crypto.randomUUID();
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
// SteamID64 nuevos: el principal y uno adicional de la ficha, y uno sin ficha.
const s64 = (i: number) => `7656119${seed}${String(i).padStart(4, '0')}`;
const [principal, adicional, suelto] = [s64(0), s64(1), s64(2)];
const nick = `Clip${seed}`;

const call = (method: string, path: string, body?: unknown, token: string | null = adminToken) =>
  app.request(
    path,
    {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};
const clip = (round: number, steamId: string, ticks: number[], extra: Record<string, unknown> = {}) => ({
  match_id: matchId, round, player_steamid: steamId, player_name: `n${round}`, round_won: true, kill_ticks: ticks, ...extra,
});
const list = async (query = '') => (await call('GET', `/api/v1/matches/${matchId}/clips${query}`, undefined, null)).json() as Promise<any>;

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
  userToken = (await createUser()).token;
  const a = admin();
  before = (await a.from('clip_config').select('*').eq('id', 1).maybeSingle()).data;
  check(await a.from('players').insert({ id: ficha, nick, steam_id: principal }));
  check(await a.from('player_extra_steam_ids').insert({ steam_id: adicional, player_id: ficha }));
  check(
    await a.from('matches').insert([
      { id: matchId, kind: 'mix', status: 'finished', map: 'de_dust2', score1: 13, score2: 7, winner_side: 1, tickrate: 66, played_at: new Date().toISOString() },
      { id: emptyMatch, kind: 'mix', status: 'finished', map: 'de_dust2', score1: 13, score2: 2, winner_side: 1, played_at: new Date().toISOString() },
    ]),
  );
  check(
    await a.from('match_clips').insert([
      clip(3, principal, [660, 700, 800, 900, 1000]), // ace
      clip(5, principal, [3300, 3400, 3500]), // 3k
      clip(7, principal, [4620, 4700, 4800]), // 3k
      clip(9, adicional, [5940, 6000, 6100, 6200]), // 4k con el SteamID adicional: la misma ficha
      clip(2, suelto, [], { clutch_vs: 2, clutch_start_tick: 1320, end_tick: 1500 }), // 1v2 ganado sin kills, sin ficha
      clip(4, 'BOT:4', [2640, 2700, 2800], { round_won: false }), // 3k de un bot en una ronda perdida
    ]),
  );
});

afterAll(async () => {
  const a = admin();
  await a.from('matches').delete().in('id', [matchId, emptyMatch]);
  await a.from('players').delete().eq('id', ficha);
  if (before) {
    await a.rpc('clip_set_config', {
      p_priorities: before.priorities as never, p_per_player: before.per_player as number, p_per_match: before.per_match as number,
      p_split_gap_seconds: before.split_gap_seconds as number, p_pre_seconds: before.pre_seconds as number, p_post_seconds: before.post_seconds as number,
    });
  }
});

describe('clips de una partida', () => {
  it('ordenados por la escala, con el tope por ficha (sus dos SteamID suman juntos)', async () => {
    const body = await list();
    expect(body.total).toBe(4);
    expect(body.items.map((c: any) => [c.position, c.type, c.round])).toEqual([
      [1, 'ace', 3],
      [2, '4k', 9],
      [3, '3k', 4],
      [4, 'clutch_2', 2],
    ]);
    expect(body.items[0]).toMatchObject({
      player: { id: ficha, alias: nick }, game_nick: 'n3', steam_id: null, kills: 5, kill_ticks: [660, 700, 800, 900, 1000],
      tickrate: 66, demo_seconds: 10, round_won: true,
    });
    expect(body.items[1].player).toEqual({ id: ficha, alias: nick });
    // Bot: sin ficha ni perfil; ronda perdida.
    expect(body.items[2]).toMatchObject({ player: null, steam_id: null, round_won: false });
    // Sin ficha: SteamID64 para el perfil sin reclamar. Empieza en el inicio del clutch (1320 / 66 = 20 s).
    expect(body.items[3]).toMatchObject({ player: null, steam_id: suelto, kills: 0, clutch_vs: 2, clutch_start_tick: 1320, end_tick: 1500, demo_seconds: 20 });
  });

  it('filtros, paginación y orden por ronda', async () => {
    expect((await list(`?player=${ficha}`)).items.map((c: any) => c.type)).toEqual(['ace', '4k']);
    expect((await list('?type=clutch_2')).items.map((c: any) => c.round)).toEqual([2]);
    const page = await list('?per=1&page=2');
    expect(page).toMatchObject({ total: 4, page: 2, per: 1 });
    expect(page.items.map((c: any) => c.type)).toEqual(['4k']);
    expect((await list('?sort=round')).items.map((c: any) => c.round)).toEqual([2, 3, 4, 9]);
    expect((await list('?sort=round&order=desc')).items.map((c: any) => c.round)).toEqual([9, 4, 3, 2]);
  });

  it('partida sin clips: lista vacía; partida que no existe: 404', async () => {
    expect(await (await call('GET', `/api/v1/matches/${emptyMatch}/clips`, undefined, null)).json()).toMatchObject({ items: [], total: 0 });
    expect((await call('GET', `/api/v1/matches/${crypto.randomUUID()}/clips`, undefined, null)).status).toBe(404);
  });
});

describe('configuración de los clips', () => {
  it('solo un admin', async () => {
    expect((await call('GET', '/api/v1/admin/clips/config', undefined, null)).status).toBe(401);
    expect((await call('GET', '/api/v1/admin/clips/config', undefined, userToken)).status).toBe(403);
    expect((await call('PATCH', '/api/v1/admin/clips/config', { per_player: 3 }, userToken)).status).toBe(403);
    const res = await call('GET', '/api/v1/admin/clips/config');
    expect(res.status).toBe(200);
    expect((await res.json()).config).toMatchObject({ per_player: expect.any(Number), priorities: expect.objectContaining({ ace: expect.any(Number) }) });
  });

  it('el cambio vale al instante para el listado y guarda quién lo hizo', async () => {
    const res = await call('PATCH', '/api/v1/admin/clips/config', { per_player: 3, priorities: { ace: 1, clutch_5: 2, clutch_4: 2, '4k': 3, clutch_3: 4, '3k': 5, clutch_2: 6, clutch_1: 7 } });
    expect(res.status).toBe(200);
    const saved = await res.json();
    expect(saved.config.per_player).toBe(3);
    expect(saved.updated_by).toMatchObject({ id: expect.any(String) });
    // Con 3 por ficha entra el 3k más tardío (ronda 7).
    expect((await list(`?player=${ficha}`)).items.map((c: any) => [c.type, c.round])).toEqual([['ace', 3], ['4k', 9], ['3k', 7]]);
    // Solo un tipo: el resto de la escala queda igual. El 1v2 empata con el ace (1) y sube del 4.º al 2.º puesto
    // (desempate: la ronda más tardía, la 3 del ace).
    expect((await call('PATCH', '/api/v1/admin/clips/config', { priorities: { clutch_2: 1 } })).status).toBe(200);
    const cfg = (await (await call('GET', '/api/v1/admin/clips/config')).json()).config;
    expect(cfg.priorities).toMatchObject({ clutch_2: 1, ace: 1, '3k': 5 });
    expect((await list()).items.slice(0, 2).map((c: any) => [c.type, c.round])).toEqual([['ace', 3], ['clutch_2', 2]]);
  });
});
