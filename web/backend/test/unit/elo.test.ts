import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { EloConfigPut, EloValues, RecomputeBody } from '../../src/schemas/elo';
import { delta, ELO_DEFAULTS, preview, weight } from '../../src/services/elo';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

const D = ELO_DEFAULTS;

describe('vista previa', () => {
  it('participación: mínimo, completo y proporcional', () => {
    expect(weight(D, 0, 30)).toBe(0);
    expect(weight(D, 10, 30)).toBe(0); // 33 % < 35 %
    expect(weight(D, 20, 30)).toBeCloseTo(2 / 3);
    expect(weight(D, 27, 30)).toBe(1); // 90 %
    expect(weight(D, 5, 0)).toBe(0);
  });

  it('cambio de ELO con equipos parejos', () => {
    expect(delta(D, true)).toBe(30);
    expect(delta(D, false)).toBe(-30);
    expect(delta(D, true, 1.4)).toBe(34);
    expect(delta(D, false, 0.6)).toBe(-34);
    expect(delta(D, true, 3)).toBe(35); // tope del bonus
    expect(delta(D, true, 1, 20, 30)).toBe(20);
    expect(delta(D, true, 1, 10, 30)).toBeNull();
    // Nunca 0: quien gana suma al menos 1 y quien pierde resta al menos 1.
    const c = { ...D, base: 5, bonus_max: 20, bonus_factor: 50 };
    expect(delta(c, true, 0)).toBe(1);
    expect(delta(c, false, 2)).toBe(-1);
    // round de Postgres: el empate se aleja del cero (-2,5 → -3).
    expect(delta({ ...D, base: 5, bonus_factor: 25 }, false, 0.9)).toBe(-8);
    // round de Postgres sobre double (participación): el empate va al par (25 × 0,5 = 12,5 → 12; 27 × 0,5 → 14; −12,5 → −12).
    expect(delta({ ...D, base: 25 }, true, 1, 15, 30)).toBe(12);
    expect(delta({ ...D, base: 27 }, true, 1, 15, 30)).toBe(14);
    expect(delta({ ...D, base: 25 }, false, 1, 15, 30)).toBe(-12);
  });

  it('ejemplos', () => {
    const p = preview(D);
    expect(p.even).toEqual({ rating: 1, win: 30, lose: -30 });
    expect(p.high_rating).toEqual({ rating: 1.4, win: 34, lose: -26 });
    expect(p.low_rating).toEqual({ rating: 0.6, win: 26, lose: -34 });
    expect(p.new_player).toEqual({ elo: 1000, level: 4 });
    expect(p.floor).toBe(100);
    expect(p.participation).toEqual([
      { rounds: 10, total: 30, pct: 33, weight: 0, rating: 1, win: null, lose: null },
      { rounds: 20, total: 30, pct: 67, weight: 0.67, rating: 1, win: 20, lose: -20 },
      { rounds: 27, total: 30, pct: 90, weight: 1, rating: 1, win: 30, lose: -30 },
    ]);
  });
});

describe('esquemas', () => {
  it.each([
    [{ base: 4 }, 'base'],
    [{ bonus_max: 21 }, 'bonus_max'],
    [{ bonus_factor: -1 }, 'bonus_factor'],
    [{ elo_floor: 1001 }, 'elo_floor'],
    [{ start_elo: 50, elo_floor: 0 }, 'start_elo'],
    [{ start_elo: 500, elo_floor: 600 }, 'start_elo'],
    [{ min_pct: 50, full_pct: 40 }, 'full_pct'],
    [{ base: 30.5 }, 'base'],
  ])('rechaza %j', (over, path) => {
    const r = EloValues.safeParse({ ...D, ...over });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path.join('.'))).toContain(path);
  });

  it('acepta un factor con decimales', () => expect(EloValues.parse({ ...D, bonus_factor: 7.5 }).bonus_factor).toBe(7.5));

  it('recalcular pide "estoy seguro"', () => {
    expect(EloConfigPut.safeParse({ config: D }).success).toBe(true);
    expect(EloConfigPut.safeParse({ config: D, recompute: true }).success).toBe(false);
    expect(EloConfigPut.safeParse({ config: D, recompute: true, confirm: 'si' }).success).toBe(false);
    expect(EloConfigPut.safeParse({ config: D, recompute: true, confirm: '  Estoy Seguro ' }).success).toBe(true);
    expect(RecomputeBody.safeParse({}).success).toBe(false);
    expect(RecomputeBody.safeParse({ confirm: 'estoy segura' }).success).toBe(false);
    expect(RecomputeBody.safeParse({ confirm: 'estoy seguro' }).success).toBe(true);
  });
});

// ---------- rutas con PostgREST simulado ----------

const USER = '77777777-7777-4777-8777-777777777777';
const ADMIN2 = '88888888-8888-4888-8888-888888888888';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: string | null };
function postgrest(role: 'admin' | 'user', handler: (url: URL) => Response | undefined) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const raw = String(input instanceof Request ? input.url : input);
      const method = (input instanceof Request ? input.method : init.method) ?? 'GET';
      calls.push({ method, url: decodeURIComponent(raw), body: typeof init.body === 'string' ? init.body : null });
      if (raw.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      const url = new URL(raw);
      if (url.pathname.endsWith('/profiles') && url.searchParams.get('select') === 'role') return Response.json([{ role }]);
      return handler(url) ?? new Response('no simulado: ' + raw, { status: 599 });
    }),
  );
  return calls;
}
const call = async (method: string, path: string, body?: unknown, token = true) =>
  makeApp().request(
    path,
    {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` } : {}), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    testEnv(),
  );
const row = { ...D, bonus_factor: '10', updated_at: '2026-10-16T00:00:00Z', updated_by: ADMIN2 };
const config = (url: URL) => (url.pathname.endsWith('/elo_config') ? Response.json([row]) : undefined);

describe('rutas', () => {
  it('sin fila de configuración: los valores por defecto', async () => {
    postgrest('user', (url) => (url.pathname.endsWith('/elo_config') ? Response.json([]) : undefined));
    const res = await call('GET', '/api/v1/elo/config', undefined, false);
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ config: D, updated_at: null, updated_by: null });
  });

  it('un usuario común no ve quién la cambió', async () => {
    postgrest('user', config);
    expect((await json(await call('GET', '/api/v1/elo/config'))).updated_by).toBeNull();
  });

  it('un admin ve quién la cambió; bonus_factor como número', async () => {
    postgrest('admin', (url) => config(url) ?? (url.pathname.endsWith('/profiles') ? Response.json([{ tag: 'Daniel' }]) : undefined));
    expect(await json(await call('GET', '/api/v1/elo/config'))).toEqual({
      config: { ...D, bonus_factor: 10 }, updated_at: row.updated_at, updated_by: { id: ADMIN2, alias: 'Daniel' },
    });
  });

  it('guardar sin recalcular: recomputed null', async () => {
    const calls = postgrest('admin', (url) => config(url) ?? (url.pathname.endsWith('/rpc/elo_set_config') ? Response.json(0) : undefined));
    const res = await call('PUT', '/api/v1/admin/elo/config', { config: D });
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ config: { ...D, bonus_factor: 10 }, recomputed: null });
    expect(JSON.parse(calls.find((x) => x.url.includes('/rpc/'))!.body!)).toEqual({
      p_base: 30, p_bonus_max: 5, p_bonus_factor: 10, p_floor: 100, p_start_elo: 1000, p_min_pct: 35, p_full_pct: 90, p_recompute: false,
    });
  });

  it('guardar y recalcular', async () => {
    postgrest('admin', (url) => config(url) ?? (url.pathname.endsWith('/rpc/elo_set_config') ? Response.json(13) : undefined));
    const res = await call('PUT', '/api/v1/admin/elo/config', { config: D, recompute: true, confirm: 'estoy seguro' });
    expect((await json(res)).recomputed).toBe(13);
  });

  it('recalcular sin confirmar: 400 y no llama a la base', async () => {
    const calls = postgrest('admin', () => undefined);
    const res = await call('POST', '/api/v1/admin/elo/recompute', { confirm: 'dale' });
    expect(res.status).toBe(400);
    expect((await json(res)).error.details).toEqual([{ path: 'confirm', message: 'Para recalcular, escribe "estoy seguro".' }]);
    expect(calls.some((x) => x.url.includes('/rpc/'))).toBe(false);
  });

  it('recalcular', async () => {
    postgrest('admin', (url) => (url.pathname.endsWith('/rpc/elo_recompute_all') ? Response.json(13) : undefined));
    expect(await json(await call('POST', '/api/v1/admin/elo/recompute', { confirm: 'estoy seguro' }))).toEqual({ recomputed: 13 });
  });

  it('recalcular devuelve null: 0', async () => {
    postgrest('admin', (url) => (url.pathname.endsWith('/rpc/elo_recompute_all') ? Response.json(null) : undefined));
    expect(await json(await call('POST', '/api/v1/admin/elo/recompute', { confirm: 'estoy seguro' }))).toEqual({ recomputed: 0 });
  });

  it('vista previa: no toca la base', async () => {
    const calls = postgrest('admin', () => undefined);
    const res = await call('POST', '/api/v1/admin/elo/preview', { ...D, base: 20 });
    expect(res.status).toBe(200);
    expect((await json(res)).even).toEqual({ rating: 1, win: 20, lose: -20 });
    expect(calls.some((x) => x.url.includes('/rest/v1/') && !x.url.includes('/profiles'))).toBe(false);
  });

  it('un usuario común no simula', async () => {
    postgrest('user', () => undefined);
    expect((await call('POST', '/api/v1/admin/elo/simulate', D)).status).toBe(403);
  });

  it('simular: filtros, orden y desempate por SteamID', async () => {
    const sim = { steam_id: '76561198000000001', player_id: null, name: 'x', elo_before: 1000, elo_after: 1010, delta: 10, abs_delta: 10,
                  matches_before: 1, matches_after: 1, changed: true, search: 'x' };
    const calls = postgrest('admin', (url) =>
      url.pathname.endsWith('/rpc/elo_simulate') ? Response.json([sim], { headers: { 'Content-Range': '0-0/1' } }) : undefined,
    );
    const res = await call('POST', '/api/v1/admin/elo/simulate?q=Kyán&changed=true&sort=delta&order=asc', D);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toMatchObject({ total: 1, sort: 'delta', order: 'asc' });
    expect(body.items[0]).not.toHaveProperty('search');
    expect(body.items[0]).not.toHaveProperty('abs_delta');
    const c = calls.find((x) => x.url.includes('/rpc/elo_simulate'))!;
    for (const part of ['search=ilike.%kyan%', 'changed=eq.true', 'order=delta.asc.nullslast,steam_id.asc']) expect(c.url).toContain(part);
    expect(JSON.parse(c.body!)).toMatchObject({ p_base: 30, p_full_pct: 90 });
  });
});
