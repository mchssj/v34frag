import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { ELO_DEFAULTS, preview } from '../../src/services/elo';
import { admin, createUser, localEnv } from './local';

// Configuración del ELO, simulación y recálculo contra la Supabase local (con el replanteo 13 aplicado).
const app = createApp();
const env = localEnv();
const OK = 'estoy seguro';
let adminToken: string;
let before: Record<string, unknown> | null = null;
const matchId = crypto.randomUUID();
// 10 SteamID64 nuevos (17 dígitos): equipos parejos, así cada uno gana o pierde exactamente `base`.
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
const steam = Array.from({ length: 10 }, (_, i) => `7656119${seed}${String(i).padStart(4, '0')}`);

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
const eloOf = async (id: string) => (await admin().from('player_elo').select('elo').eq('steam_id', id).single()).data?.elo;

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
  const a = admin();
  before = (await a.from('elo_config').select('*').eq('id', 1).maybeSingle()).data;
  const m = await a.from('matches').insert({
    id: matchId, kind: 'mix', status: 'finished', map: 'de_dust2', score1: 16, score2: 10, winner_side: 1,
    played_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
  if (m.error) throw m.error;
  const s = await a.from('match_player_stats').insert(
    steam.map((id, i) => ({ match_id: matchId, steam_id: id, team: i < 5 ? 1 : 2, nick: `E${seed}n${i}`, rounds: 26, rating: 1 })),
  );
  if (s.error) throw s.error;
});

// Deja la configuración como estaba y el ELO recalculado sin el mix sembrado.
afterAll(async () => {
  const a = admin();
  await a.from('match_player_stats').delete().eq('match_id', matchId);
  await a.from('matches').delete().eq('id', matchId);
  if (before) await a.from('elo_config').update(before).eq('id', 1);
  else await a.from('elo_config').delete().eq('id', 1);
  const r = await a.rpc('elo_recompute_all');
  if (r.error) throw r.error;
});

describe('configuración del ELO', () => {
  it('un anónimo la lee', async () => {
    const res = await call('GET', '/api/v1/elo/config', undefined, '');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body.config).sort()).toEqual(Object.keys(ELO_DEFAULTS).sort());
    expect(body.updated_by).toBeNull();
  });

  it('un usuario común no la cambia, no simula ni recalcula', async () => {
    const u = await createUser();
    expect((await call('PUT', '/api/v1/admin/elo/config', { config: ELO_DEFAULTS }, u.token)).status).toBe(403);
    expect((await call('POST', '/api/v1/admin/elo/simulate', ELO_DEFAULTS, u.token)).status).toBe(403);
    expect((await call('POST', '/api/v1/admin/elo/recompute', { confirm: OK }, u.token)).status).toBe(403);
  });

  it('guardar y recalcular cambia el ELO según la base nueva; el admin ve quién la cambió', async () => {
    const cfg = { ...ELO_DEFAULTS, base: 40 };
    expect((await call('PUT', '/api/v1/admin/elo/config', { config: cfg, recompute: true })).status).toBe(400); // sin confirmar
    const res = await call('PUT', '/api/v1/admin/elo/config', { config: cfg, recompute: true, confirm: OK });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config).toEqual(cfg);
    expect(body.recomputed).toBeGreaterThanOrEqual(1);
    expect(await eloOf(steam[0]!)).toBe(cfg.start_elo + 40);
    expect(await eloOf(steam[9]!)).toBe(cfg.start_elo - 40);

    const got = await (await call('GET', '/api/v1/elo/config')).json();
    expect(got.config).toEqual(cfg);
    expect(got.updated_by.alias).toEqual(expect.any(String));
    expect(got.updated_at).not.toBeNull();
  });

  it('simular no guarda nada y muestra el cambio de cada jugador', async () => {
    const cfg = { ...ELO_DEFAULTS, base: 40 };
    const res = await call('POST', `/api/v1/admin/elo/simulate?q=E${seed}&sort=delta&order=asc`, { ...cfg, base: 20 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(10);
    expect(body.items[0]).toMatchObject({ steam_id: expect.any(String), elo_before: cfg.start_elo + 40, elo_after: cfg.start_elo + 20, delta: -20, changed: true });
    expect(body.items.at(-1)).toMatchObject({ elo_before: cfg.start_elo - 40, elo_after: cfg.start_elo - 20, delta: 20 });
    expect(await eloOf(steam[0]!)).toBe(cfg.start_elo + 40);
    expect((await (await call('GET', '/api/v1/elo/config')).json()).config.base).toBe(40);

    // Con los mismos valores no cambia nadie.
    const same = await (await call('POST', `/api/v1/admin/elo/simulate?q=E${seed}&changed=true`, cfg)).json();
    expect(same.total).toBe(0);
    // Valores inválidos.
    expect((await call('POST', '/api/v1/admin/elo/simulate', { ...cfg, base: 1 })).status).toBe(400);
  });

  it('guardar sin recalcular deja el ELO como estaba', async () => {
    const res = await call('PUT', '/api/v1/admin/elo/config', { config: { ...ELO_DEFAULTS, base: 25 } });
    expect(await res.json()).toMatchObject({ recomputed: null, config: { base: 25 } });
    expect(await eloOf(steam[0]!)).toBe(ELO_DEFAULTS.start_elo + 40);
  });

  it('recalcular aplica la configuración actual', async () => {
    expect((await call('POST', '/api/v1/admin/elo/recompute', { confirm: 'no' })).status).toBe(400);
    const res = await call('POST', '/api/v1/admin/elo/recompute', { confirm: OK });
    expect(res.status).toBe(200);
    expect((await res.json()).recomputed).toBeGreaterThanOrEqual(1);
    expect(await eloOf(steam[0]!)).toBe(ELO_DEFAULTS.start_elo + 25);
  });

  it('la vista previa coincide con el motor en equipos parejos', async () => {
    const res = await call('POST', '/api/v1/admin/elo/preview', { ...ELO_DEFAULTS, base: 25 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(preview({ ...ELO_DEFAULTS, base: 25 }));
    expect(body.even.win).toBe((await eloOf(steam[0]!))! - ELO_DEFAULTS.start_elo);
  });
});
