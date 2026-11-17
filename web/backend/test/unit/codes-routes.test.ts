import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CodeCreate, RedeemBody } from '../../src/schemas/codes';
import { makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Códigos canjeables (replanteo 126, bitácora docs/bitacora/2026-11-16-codigos-canjeables) con PostgREST simulado. Las
// reglas (usos, vencimiento, topes por cuenta, premios) las prueba la base: pruebas/probar_126.sql.
const USER = '77777777-7777-4777-8777-777777777777';
const CODE = '99999999-9999-4999-8999-999999999999';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: string | null };
function postgrest(role: 'admin' | 'user', rpc: Record<string, unknown>) {
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
      const fn = url.pathname.split('/rpc/')[1];
      if (fn && fn in rpc) {
        const v = rpc[fn];
        return v === null ? new Response(null, { status: 204 }) : Response.json(v);
      }
      return new Response('no simulado: ' + raw, { status: 599 });
    }),
  );
  return calls;
}
const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  makeApp().request(
    path,
    {
      method,
      headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, 'Content-Type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    testEnv(),
  );
const rpcBody = (calls: Call[], fn: string) => JSON.parse(calls.find((x) => x.url.includes(`/rpc/${fn}`))!.body!);

describe('esquemas', () => {
  it('el código: con o sin guiones, sin caracteres raros', () => {
    expect(RedeemBody.parse({ code: '  cml-7k2m-qx9p-4htd ' }).code).toBe('cml-7k2m-qx9p-4htd');
    expect(RedeemBody.safeParse({ code: 'NAVIDAD 2026' }).success).toBe(true);
    expect(RedeemBody.safeParse({ code: 'abc' }).success).toBe(false);
    expect(RedeemBody.safeParse({ code: "x'; drop table" }).success).toBe(false);
    expect(RedeemBody.safeParse({ code: 'A'.repeat(41) }).success).toBe(false);
  });

  it('crear: cada premio con lo suyo; usos y cantidad por defecto 1', () => {
    expect(CodeCreate.parse({ reward: 'points', amount: 500 })).toMatchObject({ max_uses: 1, count: 1 });
    expect(CodeCreate.safeParse({ reward: 'points' }).success).toBe(false);
    expect(CodeCreate.safeParse({ reward: 'item' }).success).toBe(false);
    expect(CodeCreate.safeParse({ reward: 'item', item: 'marco-mira' }).success).toBe(true);
    expect(CodeCreate.safeParse({ reward: 'vip' }).success).toBe(false);
    expect(CodeCreate.safeParse({ reward: 'vip', days: 366 }).success).toBe(false);
    expect(CodeCreate.safeParse({ reward: 'vip', days: 7, count: 101 }).success).toBe(false);
    expect(CodeCreate.safeParse({ reward: 'points', amount: 5, custom: 'NAVIDAD 2026' }).success).toBe(false);
  });
});

describe('canjear', () => {
  it('pasa el código y la IP a la base y devuelve el premio', async () => {
    const calls = postgrest('user', {
      code_redeem: { ok: true, reward: 'vip', item: null, amount: null, days: 7, until: '2026-11-23T00:00:00Z', label: 'Sorteo' },
    });
    const r = await call('POST', '/api/v1/me/redeem', { code: 'CML-7K2M-QX9P-4HTD' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ reward: 'vip', item: null, amount: null, days: 7, until: '2026-11-23T00:00:00Z', label: 'Sorteo' });
    expect(rpcBody(calls, 'code_redeem')).toMatchObject({ p_code: 'CML-7K2M-QX9P-4HTD' });
    // el código nunca va en la URL
    expect(calls.some((x) => x.url.includes('7K2M'))).toBe(false);
  });

  it.each([
    ['code_invalid', 404, 'CODE_INVALID'],
    ['code_expired', 409, 'CODE_EXPIRED'],
    ['code_used_up', 409, 'CODE_USED_UP'],
    ['code_already_redeemed', 409, 'CODE_ALREADY_REDEEMED'],
    ['code_not_for_you', 403, 'CODE_NOT_FOR_YOU'],
    ['code_already_owned', 409, 'CODE_ALREADY_OWNED'],
    ['code_vip_lifetime', 409, 'CODE_VIP_LIFETIME'],
    ['code_no_player', 403, 'CODE_NO_PLAYER'],
    ['code_banned', 403, 'CODE_BANNED'],
    ['otro', 400, 'BUSINESS_RULE'],
  ])('%s responde %i %s con el mensaje de la base', async (error, status, code) => {
    postgrest('user', { code_redeem: { ok: false, error, message: 'Mensaje de la base' } });
    const r = await call('POST', '/api/v1/me/redeem', { code: 'CML-AAAA-BBBB-CCCC' });
    expect(r.status).toBe(status);
    expect((await r.json()).error).toMatchObject({ code, message: 'Mensaje de la base' });
  });

  it('bloqueado por la base: 429 con Retry-After', async () => {
    postgrest('user', { code_redeem: { ok: false, error: 'code_rate_limited', message: 'Espera', retry_after: 840 } });
    const r = await call('POST', '/api/v1/me/redeem', { code: 'CML-AAAA-BBBB-CCCC' });
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe('840');
    expect((await r.json()).error).toMatchObject({ code: 'RATE_LIMITED', details: { retry_after: 840 } });
  });

  it('más de 10 por minuto desde la misma IP: 429 sin llegar a la base', async () => {
    const calls = postgrest('user', { code_redeem: { ok: false, error: 'code_invalid', message: 'x' } });
    const app = makeApp();
    const env = testEnv();
    const token = await signToken(key, userClaims(USER));
    const send = () =>
      app.request('/api/v1/me/redeem', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'NOEXISTE1' }),
      }, env);
    for (let i = 0; i < 10; i++) expect((await send()).status).toBe(404);
    expect((await send()).status).toBe(429);
    expect(calls.filter((x) => x.url.includes('/rpc/code_redeem'))).toHaveLength(10);
  });

  it('sin sesión: 401', async () => {
    const r = await makeApp().request('/api/v1/me/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"code":"NOEXISTE1"}' }, testEnv());
    expect(r.status).toBe(401);
  });
});

describe('admin', () => {
  it('un jugador no entra: 403', async () => {
    postgrest('user', {});
    expect((await call('GET', '/api/v1/admin/codes')).status).toBe(403);
    expect((await call('POST', '/api/v1/admin/codes', { reward: 'points', amount: 5 })).status).toBe(403);
  });

  it('crear: pasa cada campo a la base y responde 201', async () => {
    const calls = postgrest('admin', { admin_code_create: { batch_id: CODE, codes: [{ id: CODE, code: 'CML-AAAA-BBBB-CCCC' }] } });
    const r = await call('POST', '/api/v1/admin/codes', { reward: 'item', item: 'marco-mira', days: 30, count: 1, label: 'Sorteo Discord' });
    expect(r.status).toBe(201);
    expect((await r.json()).codes[0].code).toBe('CML-AAAA-BBBB-CCCC');
    expect(rpcBody(calls, 'admin_code_create')).toEqual({
      p_reward: 'item', p_item: 'marco-mira', p_amount: null, p_days: 30, p_max_uses: 1, p_count: 1, p_starts_at: null,
      p_expires_at: null, p_for_user: null, p_custom: null, p_label: 'Sorteo Discord', p_note: null,
    });
  });

  it('lista: paginada, con el premio aparte y el total de la base', async () => {
    const row = {
      id: CODE, code: 'CML-AAAA-BBBB-CCCC', custom: false, batch_id: CODE, reward: { reward: 'points', item: null, amount: 500, days: null },
      max_uses: 1, uses: 0, for_user: null, starts_at: '2026-11-16T00:00:00Z', expires_at: null, label: 'x', note: null, created_by: null,
      created_at: '2026-11-16T00:00:00Z', revoked_at: null, revoke_reason: null, state: 'active', total: 41,
    };
    const calls = postgrest('admin', { admin_codes: [row] });
    const r = await call('GET', '/api/v1/admin/codes?page=3&per=20&state=active&q=navidad');
    expect(r.status).toBe(200);
    const b = await r.json();
    expect(b).toMatchObject({ total: 41, page: 3, per: 20, sort: 'created_at', order: 'desc' });
    expect(b.items[0]).toMatchObject({ prize: { reward: 'points', amount: 500 }, state: 'active' });
    expect(b.items[0].total).toBeUndefined();
    expect(rpcBody(calls, 'admin_codes')).toEqual({ p_q: 'navidad', p_state: 'active', p_limit: 20, p_offset: 40 });
  });

  it('revocar y revertir piden motivo y responden 204', async () => {
    const calls = postgrest('admin', { admin_code_revoke: null, admin_redemption_revert: null });
    expect((await call('POST', `/api/v1/admin/codes/${CODE}/revoke`, {})).status).toBe(400);
    expect((await call('POST', `/api/v1/admin/codes/${CODE}/revoke`, { reason: 'se filtró' })).status).toBe(204);
    expect(rpcBody(calls, 'admin_code_revoke')).toEqual({ p_code: CODE, p_reason: 'se filtró' });
    expect((await call('POST', `/api/v1/admin/redemptions/${CODE}/revert`, { reason: 'trampa' })).status).toBe(204);
    expect(rpcBody(calls, 'admin_redemption_revert')).toEqual({ p_redemption: CODE, p_reason: 'trampa' });
  });
});
