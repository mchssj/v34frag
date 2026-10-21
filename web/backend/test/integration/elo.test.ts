import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { ELO_DEFAULTS, preview } from '../../src/services/elo';
import { admin, createUser, localEnv } from './local';

// Configuración del ELO y ajustes manuales contra la Supabase local (replanteo 13 y 25).
const app = createApp();
const env = localEnv();
const OK = 'estoy seguro';
let adminToken: string;
let before: Record<string, unknown> | null = null;
const matchId = crypto.randomUUID();
// 10 SteamID64 nuevos (17 dígitos): equipos parejos, así cada uno gana o pierde exactamente `base`.
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
const steam = Array.from({ length: 10 }, (_, i) => `7656119${seed}${String(i).padStart(4, '0')}`);
// Fichas de los dos primeros, para los ajustes.
const players = [crypto.randomUUID(), crypto.randomUUID()];
const nicks = [`Alfa${seed}`, `Beta${seed}`];

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

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
  const a = admin();
  before = (await a.from('elo_config').select('*').eq('id', 1).maybeSingle()).data;
  check(await a.from('elo_config').upsert({ id: 1, ...ELO_DEFAULTS }));
  check(
    await a.from('matches').insert({
      id: matchId, kind: 'mix', status: 'finished', map: 'de_dust2', score1: 16, score2: 10, winner_side: 1,
      played_at: new Date(Date.now() - 86_400_000).toISOString(),
    }),
  );
  check(
    await a.from('match_player_stats').insert(
      steam.map((id, i) => ({ match_id: matchId, steam_id: id, team: i < 5 ? 1 : 2, nick: `E${seed}n${i}`, rounds: 26, rating: 1 })),
    ),
  );
  check(await a.from('players').insert(players.map((id, i) => ({ id, nick: nicks[i], steam_id: steam[i === 0 ? 0 : 9] }))));
  // El mix se aplica con un recálculo de la base (desde la web ya no se puede).
  check(await a.rpc('elo_recompute_all'));
});

// Deja la configuración como estaba y el ELO recalculado sin el mix ni los ajustes sembrados.
afterAll(async () => {
  const a = admin();
  await a.from('elo_adjustments').delete().in('steam_id', steam);
  await a.from('players').delete().in('id', players);
  await a.from('match_player_stats').delete().eq('match_id', matchId);
  await a.from('matches').delete().eq('id', matchId);
  if (before) await a.from('elo_config').update(before).eq('id', 1);
  else await a.from('elo_config').delete().eq('id', 1);
  check(await a.rpc('elo_recompute_all'));
  await a.from('player_elo').delete().in('steam_id', steam);
});

describe('configuración del ELO', () => {
  it('un anónimo la lee', async () => {
    const res = await call('GET', '/api/v1/elo/config', undefined, '');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body.config).sort()).toEqual(Object.keys(ELO_DEFAULTS).sort());
    expect(body.updated_by).toBeNull();
  });

  it('un usuario común no la cambia ni ajusta', async () => {
    const u = await createUser();
    expect((await call('PUT', '/api/v1/admin/elo/config', { config: ELO_DEFAULTS }, u.token)).status).toBe(403);
    expect((await call('POST', '/api/v1/admin/elo/adjustments', { player_ids: [players[0]], delta: 20, reason: 'x' }, u.token)).status).toBe(403);
  });

  it('guardar vale para los mixes nuevos: no recalcula; el admin ve quién la cambió', async () => {
    const cfg = { ...ELO_DEFAULTS, base: 40 };
    const res = await call('PUT', '/api/v1/admin/elo/config', { config: cfg, recompute: true, confirm: OK });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ config: cfg });
    expect(await eloOf(steam[0]!)).toBe(ELO_DEFAULTS.start_elo + ELO_DEFAULTS.base);
    const got = await (await call('GET', '/api/v1/elo/config')).json();
    expect(got.config).toEqual(cfg);
    expect(got.updated_by.alias).toEqual(expect.any(String));
    check(await admin().from('elo_config').update(ELO_DEFAULTS).eq('id', 1));
  });

  it('recalcular y simular ya no existen', async () => {
    expect((await call('POST', '/api/v1/admin/elo/recompute', { confirm: OK })).status).toBe(404);
    expect((await call('POST', '/api/v1/admin/elo/simulate', ELO_DEFAULTS)).status).toBe(404);
  });

  it('la vista previa coincide con el motor en equipos parejos', async () => {
    const res = await call('POST', '/api/v1/admin/elo/preview', ELO_DEFAULTS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(preview(ELO_DEFAULTS));
    expect(body.even.win).toBe((await eloOf(steam[0]!)) - ELO_DEFAULTS.start_elo);
  });
});

describe('ajustes manuales', () => {
  const start = ELO_DEFAULTS.start_elo;
  const base = ELO_DEFAULTS.base;
  let setId: number;
  let deltaId: number;

  it('sumar a dos fichas', async () => {
    expect((await call('POST', '/api/v1/admin/elo/adjustments', { player_ids: players, reason: 'x' })).status).toBe(400);
    const res = await call('POST', '/api/v1/admin/elo/adjustments', { player_ids: players, delta: 20, reason: 'mix caído' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.items).toEqual(
      expect.arrayContaining([
        { adjustment_id: expect.any(Number), player: { id: players[0], alias: nicks[0] }, elo_before: start + base, elo_after: start + base + 20 },
        { adjustment_id: expect.any(Number), player: { id: players[1], alias: nicks[1] }, elo_before: start - base, elo_after: start - base + 20 },
      ]),
    );
    deltaId = body.items.find((x: { player: { id: string } }) => x.player.id === players[1]).adjustment_id;
    expect(await eloOf(steam[9]!)).toBe(start - base + 20);
  });

  it('fijar', async () => {
    const res = await call('POST', '/api/v1/admin/elo/adjustments', { player_ids: [players[0]], set_elo: 1500, reason: 'corrección' });
    expect(res.status).toBe(201);
    const [item] = (await res.json()).items;
    expect(item).toMatchObject({ elo_before: start + base + 20, elo_after: 1500 });
    setId = item.adjustment_id;
    // Un recálculo automático lo vuelve a fijar.
    check(await admin().rpc('elo_recompute_all'));
    expect(await eloOf(steam[0]!)).toBe(1500);
  });

  it('el admin los lista y el jugador los ve en su perfil', async () => {
    const list = await (await call('GET', `/api/v1/admin/elo/adjustments?player=${players[0]}`)).json();
    expect(list.items.map((x: { kind: string; set_elo: number | null }) => [x.kind, x.set_elo])).toEqual([['set', 1500], ['delta', null]]);
    expect(list.items[0]).toMatchObject({ player: { id: players[0], alias: nicks[0] }, steam_id: steam[0], created_by: { alias: expect.any(String) } });
    const mine = await (await call('GET', `/api/v1/players/${players[0]}/elo-adjustments`, undefined, '')).json();
    expect(mine.items).toEqual([
      expect.objectContaining({ kind: 'set', set_elo: 1500, reason: 'corrección' }),
      expect.objectContaining({ kind: 'delta', delta: 20, reason: 'mix caído' }),
    ]);
  });

  it('deshacer', async () => {
    expect((await call('DELETE', `/api/v1/admin/elo/adjustments/${setId}`, { confirm: 'no' })).status).toBe(400);
    expect((await call('DELETE', `/api/v1/admin/elo/adjustments/${setId}`, { confirm: OK })).status).toBe(204);
    expect(await eloOf(steam[0]!)).toBe(start + base + 20); // el "fijar" se deshace con un recálculo
    expect((await call('DELETE', `/api/v1/admin/elo/adjustments/${deltaId}`, { confirm: OK })).status).toBe(204);
    expect(await eloOf(steam[9]!)).toBe(start - base); // el "sumar" se resta
    expect((await call('DELETE', `/api/v1/admin/elo/adjustments/${deltaId}`, { confirm: OK })).status).toBe(404);
  });
});
