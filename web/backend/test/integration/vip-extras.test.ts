import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Beneficios VIP de la web contra la Supabase local con los replanteos 140 a 142 (bitácoras 2026-11-24-*-vip).
const app = createApp();
const env = localEnv();
const steam = () => '7656119' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0');

type Res = { status: number; body: any };
async function req(method: string, path: string, token?: string, body?: unknown): Promise<Res> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await app.request(path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }, env);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};
const code = (r: Res) => [r.status, r.body?.error?.code];

let vip: { id: string; token: string };
let common: { id: string; token: string };
const P: { id: string; nick: string; sid: string }[] = [];
const M: string[] = [];

beforeAll(async () => {
  const db = admin();
  [vip, common] = await Promise.all([createUser(), createUser()]);
  check(await db.from('vip_memberships').insert({ user_id: vip.id, source: 'import' }));
  for (let i = 0; i < 3; i++) {
    const id = crypto.randomUUID();
    P.push({ id, nick: `vx${id.slice(0, 8)}`, sid: steam() });
  }
  check(await db.from('players').insert(P.map((p, i) => ({ id: p.id, nick: p.nick, steam_id: p.sid, user_id: [vip.id, common.id, null][i] }))));
  // Al vincular una cuenta, el nick pasa a ser su alias.
  for (const r of check(await db.from('players').select('id, nick').in('id', P.map((p) => p.id))).data!) P.find((p) => p.id === r.id)!.nick = r.nick;
  // El ranking solo trae fichas con ELO.
  check(await db.from('player_elo').insert(P.map((p) => ({ steam_id: p.sid, elo: 1020 }))));
  // Mix 1: P0 y P1 juntos ganan 13-11 con demo. Mix 2: P0 contra P1, pierde 4-13.
  const mix = async (score1: number, score2: number, winner: number, demo: string, mins: number, teams: [number, number][]) => {
    const m = check(
      await db.from('matches').insert({
        kind: 'mix', status: 'finished', best_of: 1, side1_name: 'a', side2_name: 'b', map: 'dust2_ob', demo_status: demo,
        played_at: new Date(Date.now() - mins * 60_000).toISOString(), score1, score2, winner_side: winner,
      }).select('id').single(),
    ).data!.id as string;
    M.push(m);
    check(
      await db.from('match_player_stats').insert(
        teams.map(([i, team]) => ({
          match_id: m, steam_id: P[i]!.sid, player_id: P[i]!.id, nick: P[i]!.nick, team, rounds: score1 + score2, kills: 20, deaths: 10, headshots: 10,
          damage: 2400, rating: i === 0 ? 1.4 : 1, elo_before: 1000, elo_after: 1020, elo_delta: 20,
        })),
      ),
    );
  };
  await mix(13, 11, 1, 'uploaded', 120, [[0, 1], [1, 1], [2, 2]]);
  await mix(4, 13, 2, 'none', 60, [[0, 1], [1, 2]]);
});

afterAll(async () => {
  const db = admin();
  await db.from('matches').delete().in('id', M);
  await db.from('player_elo').delete().in('steam_id', P.map((p) => p.sid));
  await db.from('players').delete().in('id', P.map((p) => p.id));
  await db.auth.admin.deleteUser(vip.id);
  await db.auth.admin.deleteUser(common.id);
});

describe('comparador de hasta 5', () => {
  const two = () => `/api/v1/players/compare?a=${P[0]!.nick}&b=${P[1]!.nick}`;
  it('dos, sin sesión, como siempre', async () => {
    const r = await req('GET', two());
    expect(r.status).toBe(200);
    expect(r.body.others).toEqual([]);
    expect(r.body.together).toEqual({ same_team: { matches: 1, wins: 1 }, against: { matches: 1, a_wins: 0 } });
  });
  it('el tercero: 401 sin sesión, 403 sin VIP y con VIP en `others`', async () => {
    const three = `${two()}&c=${P[2]!.nick}`;
    expect(code(await req('GET', three))).toEqual([401, 'UNAUTHORIZED']);
    expect(code(await req('GET', three, common.token))).toEqual([403, 'VIP_REQUIRED']);
    const r = await req('GET', three, vip.token);
    expect(r.status).toBe(200);
    expect(r.body.others).toHaveLength(1);
    expect(r.body.others[0]).toMatchObject({ player: { player: { id: P[2]!.id } }, together: { against: { matches: 1, a_wins: 1 } } });
  });
  it('repetidos, 400', async () => {
    expect((await req('GET', `${two()}&c=${P[0]!.nick}`, vip.token)).status).toBe(400);
  });
});

describe('partidas favoritas', () => {
  it('marcar pide VIP; sacar, no; el filtro y la estrella', async () => {
    expect(code(await req('PUT', `/api/v1/me/favorites/${M[0]}`))).toEqual([401, 'UNAUTHORIZED']);
    expect(code(await req('PUT', `/api/v1/me/favorites/${M[0]}`, common.token))).toEqual([403, 'VIP_REQUIRED']);
    expect(code(await req('PUT', `/api/v1/me/favorites/${crypto.randomUUID()}`, vip.token))).toEqual([404, 'NOT_FOUND']);
    expect((await req('PUT', `/api/v1/me/favorites/${M[0]}`, vip.token)).status).toBe(204);
    expect((await req('PUT', `/api/v1/me/favorites/${M[0]}`, vip.token)).status).toBe(204);

    const fav = await req('GET', '/api/v1/matches?favorites=true', vip.token);
    expect(fav.body).toMatchObject({ total: 1, counts: { all: 1, mix: 1, pcw: 0, official: 0 } });
    expect(fav.body.items[0]).toMatchObject({ id: M[0], favorite: true, mvp: { player_id: P[0]!.id } });
    expect(code(await req('GET', '/api/v1/matches?favorites=true'))).toEqual([401, 'UNAUTHORIZED']);
    expect((await req('GET', '/api/v1/matches?favorites=true', common.token)).body.total).toBe(0);

    const list = (t?: string) => req('GET', `/api/v1/matches?player=${P[0]!.nick}`, t);
    expect((await list(vip.token)).body.items.map((m: any) => m.favorite)).toEqual([false, true]);
    expect((await list()).body.items.map((m: any) => m.favorite)).toEqual([false, false]);

    expect((await req('DELETE', `/api/v1/me/favorites/${M[0]}`, vip.token)).status).toBe(204);
    expect((await req('GET', '/api/v1/matches?favorites=true', vip.token)).body.total).toBe(0);
  });
});

describe('filtros avanzados de partidas', () => {
  const get = (q: string, t?: string) => req('GET', `/api/v1/matches?player=${P[0]!.nick}&${q}`, t);
  it('con, contra, diferencia, demo y orden', async () => {
    const ids = async (q: string) => (await get(q, vip.token)).body.items.map((m: any) => m.id);
    expect(await ids(`with=${P[1]!.nick}`)).toEqual([M[0]]);
    expect(await ids(`against=${P[1]!.id}`)).toEqual([M[1]]);
    expect(await ids('max_diff=2')).toEqual([M[0]]);
    expect(await ids('demo=true')).toEqual([M[0]]);
    expect(await ids('demo=false')).toEqual([M[1]]);
    expect(await ids('sort=round_diff&order=asc')).toEqual([M[0], M[1]]);
    expect(await ids('sort=round_diff&order=desc')).toEqual([M[1], M[0]]);
    expect(await ids('demo=true&kind=pcw')).toEqual([]);
  });
  it('sin VIP, 403; lo que ya era público sigue igual', async () => {
    for (const q of [`with=${P[1]!.nick}`, 'max_diff=2', 'demo=true', 'sort=mvp_rating']) expect(code(await get(q, common.token))).toEqual([403, 'VIP_REQUIRED']);
    expect(code(await get('max_diff=2'))).toEqual([401, 'UNAUTHORIZED']);
    expect((await get('kind=mix')).body.total).toBe(2);
  });
  it('con o contra sin jugador, 400; un jugador que no existe, 404', async () => {
    expect((await req('GET', `/api/v1/matches?with=${P[1]!.nick}`, vip.token)).status).toBe(400);
    expect((await get('with=nadie-con-este-nick', vip.token)).status).toBe(404);
  });
});

describe('filtros avanzados del ranking', () => {
  let season: string;
  beforeAll(async () => {
    season = check(await admin().from('seasons').select('id').eq('status', 'active').single()).data!.id as string;
  });
  const views = () => ['/api/v1/ranking/players', `/api/v1/seasons/${season}/standings`];
  const get = (path: string, q: string, t?: string) => req('GET', `${path}?${q}`, t);
  it('el ranking de siempre, sin sesión, no cambia', async () => {
    for (const v of views()) {
      const r = await get(v, 'per=1');
      expect(r.status).toBe(200);
      expect(r.body.items[0]).toMatchObject({ hs: null, last_played_at: null });
    }
  });
  it('con VIP, en el Histórico y en la temporada', async () => {
    const q = 'active_days=1&per=100';
    for (const v of views()) {
      const all = await get(v, `${q}&map=de_dust2_ob`, vip.token);
      expect(all.status).toBe(200);
      const me = all.body.items.find((x: any) => x.player.id === P[0]!.id);
      expect(me).toMatchObject({ hs: 50 });
      expect(me.last_played_at).toBeTruthy();
      const ids = async (f: string) => (await get(v, `${q}&${f}`, vip.token)).body.items.map((x: any) => x.player.id);
      expect(await ids('kd_min=2.1')).not.toContain(P[0]!.id);
      expect(await ids('vip=true')).toContain(P[0]!.id);
      expect(await ids('vip=true')).not.toContain(P[1]!.id);
      expect(await ids('has_team=true')).not.toContain(P[0]!.id);
      expect(await ids('matches_min=2&hs_min=50')).toEqual(expect.arrayContaining([P[0]!.id, P[1]!.id]));
      expect(await ids('matches_min=2&hs_min=50')).not.toContain(P[2]!.id);
      expect(await ids(`q=${P[0]!.nick}&hs_min=50`)).toEqual([P[0]!.id]);
      expect(await ids('elo_max=1')).toEqual([]);
    }
  });
  it('sin VIP, 403', async () => {
    for (const v of views()) {
      expect(code(await get(v, 'kd_min=1'))).toEqual([401, 'UNAUTHORIZED']);
      expect(code(await get(v, 'vip=true', common.token))).toEqual([403, 'VIP_REQUIRED']);
    }
  });
});

describe('búsquedas guardadas', () => {
  const put = (name: string, t: string, query: unknown = { kd: 1.2 }) => req('PUT', '/api/v1/me/searches', t, { kind: 'players', name, query });
  it('guardar pide VIP; tope de 5; el mismo nombre la reemplaza; borrar', async () => {
    expect(code(await put('x', common.token))).toEqual([403, 'VIP_REQUIRED']);
    for (let i = 1; i <= 5; i++) expect((await put(`b${i}`, vip.token)).status).toBe(200);
    expect(code(await put('b6', vip.token))).toEqual([400, 'BUSINESS_RULE']);
    expect((await put('B1', vip.token, { kd: 2, team: 'with', vip: true })).status).toBe(200);
    const r = await req('GET', '/api/v1/me/searches?kind=players&sort=name&order=asc&per=2', vip.token);
    expect(r.body).toMatchObject({ total: 5, per: 2 });
    expect(r.body.items[0]).toMatchObject({ name: 'B1', query: { kd: 2, team: 'with', vip: true } });
    expect((await req('GET', '/api/v1/me/searches?kind=matches', vip.token)).body.total).toBe(0);
    expect((await req('DELETE', `/api/v1/me/searches/${r.body.items[0].id}`, common.token)).status).toBe(404);
    expect((await req('DELETE', `/api/v1/me/searches/${r.body.items[0].id}`, vip.token)).status).toBe(204);
    expect((await req('GET', '/api/v1/me/searches', vip.token)).body.total).toBe(4);
  });
  it('demasiado larga, 400', async () => {
    const big = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, 'x'.repeat(59)]));
    expect((await put('larga', vip.token, big)).status).toBe(400);
  });
});

describe('tarjeta de stats', () => {
  it('por período, sin pedir VIP; sin ficha, 400', async () => {
    const r = await req('GET', '/api/v1/me/card?period=all', common.token);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ nick: P[1]!.nick, matches: 2, wins: 2, kd: 2, hs: 50, streak: 2, mvp: 0, maps: [{ name: 'dust2_ob', matches: 2, wins: 2 }], elo_history: [1020, 1020] });
    expect((await req('GET', '/api/v1/me/card?period=30d', vip.token)).body).toMatchObject({ matches: 2, wins: 1, streak: 1, mvp: 2 });
    const alone = await createUser();
    expect(code(await req('GET', '/api/v1/me/card', alone.token))).toEqual([400, 'PLAYER_NOT_LINKED']);
    await admin().auth.admin.deleteUser(alone.id);
  });
});

describe('desglose del ELO', () => {
  it('sin VIP, solo el cambio; con VIP, la configuración', async () => {
    const r = await req('GET', '/api/v1/me/elo/breakdown?per=1', common.token);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ vip: false, config: null, total: 2, per: 1, items: [{ match_id: M[1], result: 'win', own_score: 13, other_score: 4, elo_delta: 20, steps: null }] });
    const v = await req('GET', '/api/v1/me/elo/breakdown', vip.token);
    expect(v.body.vip).toBe(true);
    expect(v.body.config.base).toBeGreaterThan(0);
    // Sin elo_mult guardado, es de la fórmula anterior: sin pasos.
    expect(v.body.items.every((i: any) => i.formula === 'old' && i.steps === null)).toBe(true);
  });
  it('con la fórmula por partida, los pasos dan el cambio guardado', async () => {
    const db = admin();
    const cfg = check(await db.from('elo_config').select('base').eq('id', 1).single()).data!;
    // Parejos, rating 1,4: ganó 2 × base × 0,5 × 1,4, sin tope (el factor guardado es 1).
    const delta = Math.round(cfg.base * 1.4);
    check(
      await db.from('match_player_stats').update({ win_prob: 0.5, elo_mult: 1.4, elo_scale: 1, elo_before: 1000, elo_after: 1000 + delta, elo_delta: delta })
        .eq('match_id', M[0]!).eq('player_id', P[0]!.id),
    );
    const r = await req('GET', '/api/v1/me/elo/breakdown', vip.token);
    const it = r.body.items.find((i: any) => i.match_id === M[0]);
    expect(it).toMatchObject({ formula: 'match', elo_delta: delta });
    expect(it.steps).toMatchObject({ exact: true, abandoned: false, counted_as: 'win', win_prob: 0.5, mult: 1.4, weight: 1, raw: delta, scaled: delta, floor_hit: false });
  });
});
