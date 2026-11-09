import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Chat del grupo y denuncia desde ese chat (replanteo 93), con PostgREST simulado.
const USER = '55555555-5555-4555-8555-555555555555';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Rpc = { fn: string; body: unknown };
function stub(fail?: { fn: string; message: string }) {
  const rpcs: Rpc[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
      if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      if (url.includes('/rpc/')) {
        const fn = url.slice(url.indexOf('/rpc/') + 5).split('?')[0]!;
        rpcs.push({ fn, body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
        if (fail?.fn === fn) return Response.json({ code: 'P0001', message: fail.message }, { status: 400 });
        if (fn === 'mm_party_chat_list') return Response.json([{ id: 7, user_id: USER, alias: 'kyan', message: 'hola', created_at: '2026-11-08T20:00:00Z', is_me: true }]);
        if (fn === 'mm_party_chat_send') return Response.json({ id: 8, user_id: USER, alias: 'kyan', message: 'dale', created_at: '2026-11-08T20:00:01Z', is_me: true });
        return new Response(null, { status: 204 });
      }
      return new Response('no simulado: ' + url, { status: 599 });
    }),
  );
  return rpcs;
}

const call = async (method: string, path: string, body?: unknown, token = true) =>
  makeApp().request(
    path,
    {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` } : {}), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    testEnv(),
  );

describe('chat del grupo', () => {
  it('sin sesión: 401', async () => {
    stub();
    expect((await call('GET', '/api/v1/mm/party/chat', undefined, false)).status).toBe(401);
  });

  it('leer: los mensajes de mi grupo, con `after`', async () => {
    const rpcs = stub();
    const res = await call('GET', '/api/v1/mm/party/chat?after=6');
    expect(res.status).toBe(200);
    expect((await res.json()).items[0]).toMatchObject({ id: 7, message: 'hola', is_me: true });
    expect(rpcs).toEqual([{ fn: 'mm_party_chat_list', body: { p_after: 6 } }]);
  });

  it('escribir: el mensaje sin espacios a los costados; vacío o de más de 300, 400 sin llegar a la base', async () => {
    const rpcs = stub();
    const res = await call('POST', '/api/v1/mm/party/chat', { message: '  dale  ' });
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(8);
    expect(rpcs).toEqual([{ fn: 'mm_party_chat_send', body: { p_message: 'dale' } }]);
    expect((await call('POST', '/api/v1/mm/party/chat', { message: '   ' })).status).toBe(400);
    expect((await call('POST', '/api/v1/mm/party/chat', { message: 'x'.repeat(301) })).status).toBe(400);
    expect(rpcs).toHaveLength(1);
  });

  it('la regla de la base llega con su mensaje', async () => {
    stub({ fn: 'mm_party_chat_send', message: 'El chat del grupo es con al menos un compañero' });
    const res = await call('POST', '/api/v1/mm/party/chat', { message: 'hola' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatchObject({ code: 'BUSINESS_RULE', message: 'El chat del grupo es con al menos un compañero' });
  });

  it('denunciar un mensaje: 204; motivo inválido, 400', async () => {
    const rpcs = stub();
    expect((await call('POST', '/api/v1/mm/party/chat/7/report', { reason: 'toxic', note: 'me insultó' })).status).toBe(204);
    expect(rpcs).toEqual([{ fn: 'mm_report_from_chat', body: { p_message: 7, p_reason: 'toxic', p_note: 'me insultó' } }]);
    expect((await call('POST', '/api/v1/mm/party/chat/7/report', { reason: 'feo' })).status).toBe(400);
  });
});
