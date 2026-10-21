import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AdjustBody, EloValues, UndoBody } from '../../src/schemas/elo';
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

  it('ajuste: sumar o fijar (uno de los dos), de 1 a 10 fichas sin repetir y con motivo', () => {
    const P = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
    const ok = (b: object) => AdjustBody.safeParse({ player_ids: P, reason: 'mix caído', ...b }).success;
    expect(ok({ delta: 20 })).toBe(true);
    expect(ok({ delta: -500 })).toBe(true);
    expect(ok({ set_elo: 1500 })).toBe(true);
    expect(ok({})).toBe(false);
    expect(ok({ delta: 20, set_elo: 1500 })).toBe(false);
    expect(ok({ delta: 0 })).toBe(false);
    expect(ok({ delta: 501 })).toBe(false);
    expect(ok({ set_elo: 10001 })).toBe(false);
    expect(ok({ delta: 20, reason: '  ' })).toBe(false);
    expect(ok({ delta: 20, player_ids: [P[0], P[0]] })).toBe(false);
    expect(ok({ delta: 20, player_ids: Array.from({ length: 11 }, () => crypto.randomUUID()) })).toBe(false);
    expect(ok({ delta: 20, player_ids: [] })).toBe(false);
  });

  it('deshacer pide "estoy seguro"', () => {
    expect(UndoBody.safeParse({}).success).toBe(false);
    expect(UndoBody.safeParse({ confirm: 'si' }).success).toBe(false);
    expect(UndoBody.safeParse({ confirm: ' Estoy Seguro ' }).success).toBe(true);
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

  it('guardar: vale para los mixes nuevos, nunca recalcula', async () => {
    const calls = postgrest('admin', (url) => config(url) ?? (url.pathname.endsWith('/rpc/elo_set_config') ? Response.json(0) : undefined));
    const res = await call('PUT', '/api/v1/admin/elo/config', { config: D, recompute: true, confirm: 'estoy seguro' });
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ config: { ...D, bonus_factor: 10 } });
    expect(JSON.parse(calls.find((x) => x.url.includes('/rpc/'))!.body!)).toEqual({
      p_base: 30, p_bonus_max: 5, p_bonus_factor: 10, p_floor: 100, p_start_elo: 1000, p_min_pct: 35, p_full_pct: 90, p_recompute: false,
    });
  });

  it('recalcular y simular ya no existen', async () => {
    postgrest('admin', () => undefined);
    expect((await call('POST', '/api/v1/admin/elo/recompute', { confirm: 'estoy seguro' })).status).toBe(404);
    expect((await call('POST', '/api/v1/admin/elo/simulate', D)).status).toBe(404);
  });

  it('vista previa: no toca la base', async () => {
    const calls = postgrest('admin', () => undefined);
    const res = await call('POST', '/api/v1/admin/elo/preview', { ...D, base: 20 });
    expect(res.status).toBe(200);
    expect((await json(res)).even).toEqual({ rating: 1, win: 20, lose: -20 });
    expect(calls.some((x) => x.url.includes('/rest/v1/') && !x.url.includes('/profiles'))).toBe(false);
  });

  it('un usuario común no ajusta', async () => {
    postgrest('user', () => undefined);
    expect((await call('POST', '/api/v1/admin/elo/adjustments', { player_ids: [USER], delta: 20, reason: 'x' })).status).toBe(403);
    expect((await call('GET', '/api/v1/admin/elo/adjustments')).status).toBe(403);
  });

  it('ajustar: manda el modo que no se usa en null', async () => {
    const calls = postgrest('admin', (url) =>
      url.pathname.endsWith('/rpc/elo_adjust_players')
        ? Response.json([
            { adjustment_id: 7, player_id: USER, nick: 'Alfa', elo_before: 1000, elo_after: 1020 },
            { adjustment_id: null, player_id: ADMIN2, nick: null, elo_before: 1500, elo_after: 1500 },
          ])
        : undefined,
    );
    const res = await call('POST', '/api/v1/admin/elo/adjustments', { player_ids: [USER, ADMIN2], set_elo: 1500, reason: ' corrección ' });
    expect(res.status).toBe(201);
    expect(await json(res)).toEqual({
      items: [
        { adjustment_id: 7, player: { id: USER, alias: 'Alfa' }, elo_before: 1000, elo_after: 1020 },
        { adjustment_id: null, player: { id: ADMIN2, alias: '' }, elo_before: 1500, elo_after: 1500 },
      ],
    });
    expect(JSON.parse(calls.find((x) => x.url.includes('/rpc/'))!.body!)).toEqual({
      p_players: [USER, ADMIN2], p_delta: null, p_set_elo: 1500, p_reason: 'corrección',
    });
  });

  it('listado del admin: tipo, ficha y quién', async () => {
    const calls = postgrest('admin', (url) =>
      url.pathname.endsWith('/admin_elo_adjustment_list')
        ? Response.json([
            { id: 1, player_id: USER, nick: 'Alfa', steam_id: '76561198000000001', delta: 480, set_elo: 1500, reason: 'r', applied_at: 'x',
              created_by: ADMIN2, created_by_alias: 'Daniel' },
            { id: 2, player_id: null, nick: null, steam_id: null, delta: 20, set_elo: null, reason: null, applied_at: 'y', created_by: null,
              created_by_alias: null },
          ])
        : undefined,
    );
    const body = await json(await call('GET', `/api/v1/admin/elo/adjustments?q=Álfa&player=${USER}&from=2026-10-01`));
    expect(body.items).toEqual([
      { id: 1, kind: 'set', delta: 480, set_elo: 1500, reason: 'r', applied_at: 'x', player: { id: USER, alias: 'Alfa' },
        steam_id: '76561198000000001', created_by: { id: ADMIN2, alias: 'Daniel' } },
      { id: 2, kind: 'delta', delta: 20, set_elo: null, reason: '', applied_at: 'y', player: null, steam_id: '', created_by: null },
    ]);
    const c = calls.find((x) => x.url.includes('/admin_elo_adjustment_list'))!;
    for (const part of ['search=ilike.%alfa%', `player_id=eq.${USER}`, 'applied_at=gte.2026-10-01', 'order=applied_at.desc.nullslast,id.asc'])
      expect(c.url).toContain(part);
  });

  it('deshacer: 400 sin confirmar, 404 si no existe, y no llama a la base', async () => {
    const calls = postgrest('admin', (url) => (url.pathname.endsWith('/elo_adjustments') ? Response.json([]) : undefined));
    expect((await call('DELETE', '/api/v1/admin/elo/adjustments/9', { confirm: 'no' })).status).toBe(400);
    expect((await call('DELETE', '/api/v1/admin/elo/adjustments/9', { confirm: 'estoy seguro' })).status).toBe(404);
    expect(calls.some((x) => x.url.includes('/rpc/'))).toBe(false);
  });

  it('deshacer', async () => {
    const calls = postgrest('admin', (url) =>
      url.pathname.endsWith('/elo_adjustments')
        ? Response.json([{ id: 9 }])
        : url.pathname.endsWith('/rpc/elo_remove_adjustment')
          ? Response.json(null)
          : undefined,
    );
    expect((await call('DELETE', '/api/v1/admin/elo/adjustments/9', { confirm: 'estoy seguro' })).status).toBe(204);
    expect(JSON.parse(calls.find((x) => x.url.includes('/rpc/'))!.body!)).toEqual({ p_id: 9 });
  });

  it('ajustes de un jugador: públicos', async () => {
    postgrest('user', (url) =>
      url.pathname.endsWith('/player_elo_adjustment_list')
        ? Response.json([{ id: 3, delta: -20, set_elo: null, reason: 'abandono', applied_at: 'z' }])
        : undefined,
    );
    const res = await call('GET', `/api/v1/players/${USER}/elo-adjustments`, undefined, false);
    expect(res.status).toBe(200);
    expect((await json(res)).items).toEqual([{ id: 3, kind: 'delta', delta: -20, set_elo: null, reason: 'abandono', applied_at: 'z' }]);
  });
});
