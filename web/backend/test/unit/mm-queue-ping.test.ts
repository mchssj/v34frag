import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';
import { queuePingText } from '../../src/routes/mm';

// Aviso de la cola en Discord (replanteo 57), con PostgREST y el webhook simulados.
const USER = '57575757-5757-4575-8575-575757575757';
const HOOK = 'https://discord.com/api/webhooks/1/abc';
const ROLE = '1559045996535873557';
const PING = { id: 'p1', alias: 'Kyan', mode: '5v5', staff: false, queue: { '5v5': 7 }, next_at: '2026-11-02T22:15:00Z' };
const STATUS = { staff: false, queued: true, next_at: '2026-11-02T22:15:00Z', can_ping: false };
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { url: string; body: Record<string, unknown> | null };

function stub(opts: { discordStatus?: number; pingError?: { code: string; message: string; details?: string } } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
      calls.push({ url, body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
      if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      if (url === HOOK) return new Response(null, { status: opts.discordStatus ?? 204 });
      if (url.includes('/rpc/mm_queue_ping_status')) return Response.json(STATUS);
      if (url.includes('/rpc/mm_queue_ping_cancel')) return Response.json(null);
      if (url.includes('/rpc/mm_queue_ping')) {
        return opts.pingError ? Response.json(opts.pingError, { status: 400 }) : Response.json(PING);
      }
      return new Response('no simulado: ' + url, { status: 599 });
    }),
  );
  return calls;
}

const env = (hook = true) => testEnv(hook ? { DISCORD_QUEUE_WEBHOOK_URL: HOOK, DISCORD_QUEUE_ROLE_ID: ROLE } : {});
const ping = async (e = env()) =>
  makeApp().request('/api/v1/mm/queue/ping', { method: 'POST', headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` } }, e);

describe('POST /api/v1/mm/queue/ping', () => {
  it('publica en el webhook mencionando solo al rol', async () => {
    const calls = stub();
    const res = await ping();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(STATUS);
    const hook = calls.find((c) => c.url === HOOK)!;
    expect(hook.body).toEqual({
      content: `<@&${ROLE}> Hay gente en la queue, ¡mándate!\n5v5: 7 buscando · avisó Kyan`,
      allowed_mentions: { parse: [], roles: [ROLE] },
    });
  });

  it('si Discord falla, borra el aviso y responde 502', async () => {
    const calls = stub({ discordStatus: 500 });
    const res = await ping();
    expect(res.status).toBe(502);
    expect(calls.find((c) => c.url.includes('/rpc/mm_queue_ping_cancel'))?.body).toEqual({ p_id: 'p1' });
  });

  it('antes de los 15 minutos: 409 con la hora', async () => {
    stub({ pingError: { code: 'V5701', message: 'Ya se avisó hace poco', details: '{"next_at":"2026-11-02T22:15:00Z"}' } });
    const res = await ping();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'CONFLICT', details: { next_at: '2026-11-02T22:15:00Z' } } });
  });

  it('sin webhook configurado: 501 y no toca la base', async () => {
    const calls = stub();
    const res = await ping(env(false));
    expect(res.status).toBe(501);
    expect(calls.some((c) => c.url.includes('/rpc/'))).toBe(false);
  });
});

describe('queuePingText', () => {
  it('saca markdown y menciones del alias', () => {
    expect(queuePingText({ alias: '@everyone **x**', queue: {} })).toBe('Hay gente en la queue, ¡mándate!\navisó everyone x');
    expect(queuePingText({ alias: '', queue: { '5v5': 3, '2v2': 0 } }, ROLE)).toBe(
      `<@&${ROLE}> Hay gente en la queue, ¡mándate!\n5v5: 3 buscando · avisó Alguien`,
    );
  });
});
