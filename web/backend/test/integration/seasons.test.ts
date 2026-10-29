import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Temporadas contra la Supabase local (replanteo 24): abrir, ranking, vista previa, cerrar, medallas y reinicio.
const app = createApp();
const env = localEnv();
const OK = 'estoy seguro';
let adminToken: string;
let userToken: string;
let configBefore: Record<string, unknown> | null = null;
let eloConfigAdded = false;
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
const steam = [0, 1, 2].map((i) => `7656119${seed}${String(i).padStart(4, '0')}`);
const players = [0, 1, 2].map(() => crypto.randomUUID());
const nicks = ['Alfa', 'Beta', 'Gama'].map((n) => `${n}${seed}`);
const mixes = [crypto.randomUUID(), crypto.randomUUID()];
let seasonId: string;

const call = (method: string, path: string, body?: unknown, token = adminToken) =>
  app.request(
    path,
    {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
const eloOf = async (id: string) => (await admin().from('player_elo').select('elo').eq('steam_id', id).single()).data?.elo as number;
const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};

// Borra las temporadas (y sus medallas y fotos) para empezar sin ninguna activa.
async function clearSeasons() {
  const a = admin();
  check(await a.from('player_medals').delete().not('season_id', 'is', null));
  check(await a.from('seasons').delete().not('id', 'is', null));
}

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
  userToken = (await createUser()).token;
  const a = admin();
  configBefore = (await a.from('season_config').select('*').eq('id', 1).maybeSingle()).data;
  await clearSeasons();
  // Los ajustes de ELO necesitan la fila de elo_config (en producción existe; la base local puede no tenerla).
  if (!(await a.from('elo_config').select('id').eq('id', 1).maybeSingle()).data) {
    check(await a.from('elo_config').insert({ id: 1 }));
    eloConfigAdded = true;
  }
  check(await a.from('players').insert(players.map((id, i) => ({ id, nick: nicks[i], steam_id: steam[i] }))));
  // Pretemporada: Alfa a 2540 y Beta a 2200.
  const past = new Date(Date.now() - 86_400_000).toISOString();
  check(await a.rpc('elo_add_adjustment', { p_steam_ids: [steam[0]], p_delta: 1540, p_reason: `prueba ${seed}`, p_at: past }));
  check(await a.rpc('elo_add_adjustment', { p_steam_ids: [steam[1]], p_delta: 1200, p_reason: `prueba ${seed}`, p_at: past }));
});

afterAll(async () => {
  const a = admin();
  await clearSeasons();
  await a.from('match_player_stats').delete().in('match_id', mixes);
  await a.from('matches').delete().in('id', mixes);
  await a.from('elo_adjustments').delete().in('steam_id', steam);
  await a.from('players').delete().in('id', players);
  if (configBefore) await a.from('season_config').update(configBefore).eq('id', 1);
  if (eloConfigAdded) await a.from('elo_config').delete().eq('id', 1);
  check(await a.rpc('elo_recompute_all'));
  await a.from('player_elo').delete().in('steam_id', steam);
});

describe('temporadas', () => {
  it('sin temporada activa: 404', async () => {
    expect((await call('GET', '/api/v1/seasons/current', undefined, '')).status).toBe(404);
  });

  it('configuración: la lee y la cambia un admin', async () => {
    expect((await call('GET', '/api/v1/admin/seasons/config', undefined, userToken)).status).toBe(403);
    const got = await (await call('GET', '/api/v1/admin/seasons/config')).json();
    expect(got).toMatchObject({ duration_days: expect.any(Number), tiers: expect.any(Array) });
    const cfg = { duration_days: 30, top_n: 20, min_matches: 20, reset_pct: 10, reset_floor: 2001, tiers: got.tiers };
    const res = await call('PUT', '/api/v1/admin/seasons/config', cfg);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ...cfg, reset_all: false, updated_at: expect.any(String) });
  });

  it('abrir: un admin, una sola activa, fin a las 06:00 de Argentina', async () => {
    expect((await call('POST', '/api/v1/admin/seasons', {}, userToken)).status).toBe(403);
    const res = await call('POST', '/api/v1/admin/seasons', {});
    expect(res.status).toBe(201);
    const s = await res.json();
    seasonId = s.id;
    expect(s).toMatchObject({ number: 1, name: 'Temporada 1', status: 'active', top_n: 20, min_matches: 20, champion: null, medals: 0 });
    expect(new Date(s.ends_at).getUTCHours()).toBe(9); // 06:00 en Argentina (UTC−3)
    expect((await call('POST', '/api/v1/admin/seasons', {})).status).toBe(409);
    expect((await (await call('GET', '/api/v1/seasons/current', undefined, '')).json()).id).toBe(seasonId);
  });

  it('cambiar la activa', async () => {
    expect((await call('PATCH', `/api/v1/admin/seasons/${seasonId}`, { ends_at: '2020-01-01T00:00:00Z' })).status).toBe(400);
    const res = await call('PATCH', `/api/v1/admin/seasons/${seasonId}`, { top_n: 2, min_matches: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ top_n: 2, min_matches: 1, reset_pct: 10 });
    expect((await call('PATCH', `/api/v1/admin/seasons/${crypto.randomUUID()}`, { top_n: 2 })).status).toBe(404);
  });

  it('ranking en vivo con dos mixes: Alfa y Beta le ganan a Gama', async () => {
    const a = admin();
    const at = new Date().toISOString();
    check(await a.from('matches').insert(mixes.map((id) => ({ id, kind: 'mix', status: 'finished', map: 'de_dust2', score1: 16, score2: 10, winner_side: 1, played_at: at }))));
    check(await a.from('match_player_stats').insert([
      { match_id: mixes[0], steam_id: steam[0], team: 1, nick: 'a', rounds: 26, rating: 1, kills: 20, deaths: 10, k1: 20 },
      { match_id: mixes[0], steam_id: steam[2], team: 2, nick: 'c', rounds: 26, rating: 1, kills: 0, deaths: 0, k1: 0 },
      { match_id: mixes[1], steam_id: steam[1], team: 1, nick: 'b', rounds: 26, rating: 1, kills: 0, deaths: 0, k1: 0 },
      { match_id: mixes[1], steam_id: steam[2], team: 2, nick: 'c', rounds: 26, rating: 1, kills: 0, deaths: 0, k1: 0 },
    ]));
    check(await a.rpc('elo_recompute_all'));

    const res = await call('GET', `/api/v1/seasons/${seasonId}/standings?q=${seed}&eligible=true`, undefined, '');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.map((x: { player: { alias: string }; rank: number; medal: { name: string } | null }) => [x.player.alias, x.rank, x.medal?.name ?? null]))
      .toEqual([[nicks[0], 1, 'Campeón'], [nicks[1], 2, 'Subcampeón'], [nicks[2], 3, null]]);
    expect(body.items[0]).toMatchObject({ matches: 1, wins: 1, losses: 0, level: 10, kd: 2, rating: expect.any(Number), teams: [] });
    expect(body.items[2]).toMatchObject({ matches: 2, wins: 0, losses: 2, kd: 0 });

    // Rating y K/D de la temporada, filtro de nivel y orden por K/D (replanteo 30).
    const lv = await (await call('GET', `/api/v1/seasons/${seasonId}/standings?q=${seed}&level=10&sort=kd&order=desc`, undefined, '')).json();
    expect(lv.items.map((x: { player: { alias: string } }) => x.player.alias)).toEqual([nicks[0], nicks[1]]);
  });

  it('vista previa: no cambia nada', async () => {
    const before = await eloOf(steam[0]!);
    expect((await call('GET', '/api/v1/admin/seasons/preview?top_n=3&min_matches=1&reset_pct=0&reset_floor=2001', undefined, userToken)).status).toBe(403);
    const res = await call('GET', `/api/v1/admin/seasons/preview?top_n=3&min_matches=1&reset_pct=0&reset_floor=2001&q=${seed}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.items[0]).toMatchObject({ rank: 1, elo: before, elo_after: 2001, reset: true, medal: { name: 'Campeón' } });
    expect(body.items[2]).toMatchObject({ rank: 3, reset: false, medal: { name: 'Tercer puesto' } });
    expect(body.summary.reset).toBeGreaterThanOrEqual(2);
    // Reinicio total (replanteo 37): el que está debajo del piso también queda en el piso.
    const all = await (await call('GET', `/api/v1/admin/seasons/preview?top_n=3&min_matches=1&reset_pct=0&reset_floor=2001&reset_all=true&q=${seed}`)).json();
    expect(all.items[2]).toMatchObject({ rank: 3, reset: true, elo_after: 2001 });
    expect(await eloOf(steam[0]!)).toBe(before);
  });

  it('terminar: foto, medallas, reinicio y la temporada siguiente', async () => {
    expect((await call('POST', `/api/v1/admin/seasons/${seasonId}/close`, { confirm: 'no' })).status).toBe(400);
    expect((await call('POST', `/api/v1/admin/seasons/${seasonId}/close`, { confirm: OK }, userToken)).status).toBe(403);
    const elo = [await eloOf(steam[0]!), await eloOf(steam[1]!), await eloOf(steam[2]!)];
    const res = await call('POST', `/api/v1/admin/seasons/${seasonId}/close`, { confirm: OK });
    expect(res.status).toBe(200);
    const r = await res.json();
    expect(r).toMatchObject({ season_id: seasonId, medals: 2, next_season_id: expect.any(String) });

    expect(await eloOf(steam[0]!)).toBe(2001 + Math.round((elo[0]! - 2001) * 0.1));
    expect(await eloOf(steam[1]!)).toBe(2001 + Math.round((elo[1]! - 2001) * 0.1));
    expect(await eloOf(steam[2]!)).toBe(elo[2]);

    // Ya cerrada: no se cambia ni se vuelve a cerrar.
    expect((await call('POST', `/api/v1/admin/seasons/${seasonId}/close`, { confirm: OK })).status).toBe(400);
    expect((await call('PATCH', `/api/v1/admin/seasons/${seasonId}`, { name: 'x' })).status).toBe(400);

    const list = await (await call('GET', '/api/v1/seasons?status=closed', undefined, '')).json();
    expect(list.items[0]).toMatchObject({ id: seasonId, status: 'closed', champion: { id: players[0], alias: nicks[0] }, medals: 2 });
    const cur = await (await call('GET', '/api/v1/seasons/current', undefined, '')).json();
    expect(cur).toMatchObject({ id: r.next_season_id, number: 2, name: 'Temporada 2', top_n: 20, min_matches: 20 });

    const foto = await (await call('GET', `/api/v1/seasons/${seasonId}/standings?q=${seed}`, undefined, '')).json();
    expect(foto.items[0]).toMatchObject({ rank: 1, elo: elo[0], elo_after: 2001 + Math.round((elo[0]! - 2001) * 0.1), medal: { name: 'Campeón', icon: '🏆' }, kd: 2 });
  });

  it('el jugador: medalla con su temporada e historial', async () => {
    const medals = await (await call('GET', `/api/v1/players/${players[0]}/medals`, undefined, '')).json();
    expect(medals.items).toEqual([
      expect.objectContaining({ title: 'Temporada 1 · #1', icon: '🏆', rank: 1, season: { id: seasonId, number: 1, name: 'Temporada 1' } }),
    ]);
    const hist = await (await call('GET', `/api/v1/players/${players[1]}/seasons`, undefined, '')).json();
    expect(hist.items).toEqual([expect.objectContaining({ season: { id: seasonId, number: 1, name: 'Temporada 1' }, rank: 2, medal: { name: 'Subcampeón', icon: '🥈' } })]);
  });

  it('un recálculo (automático: desde la web ya no se puede) después del cierre deja el mismo ELO', async () => {
    const before = await Promise.all(steam.map(eloOf));
    check(await admin().rpc('elo_recompute_all'));
    expect(await Promise.all(steam.map(eloOf))).toEqual(before);
  });
});
