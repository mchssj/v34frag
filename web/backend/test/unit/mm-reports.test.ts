import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Reportes del matchmaking: solo el admin (replanteo 68), con PostgREST simulado.
const USER = '66666666-6666-4666-8666-666666666666';
const REPORT = '88888888-8888-4888-8888-888888888888';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stub(role: 'admin' | 'moderator') {
  const rpcs: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
      if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      if (url.includes('/rest/v1/profiles')) return Response.json([{ role }]);
      if (url.includes('/rpc/')) {
        rpcs.push(url.slice(url.indexOf('/rpc/') + 5));
        return url.includes('/rpc/mm_admin_lists') ? Response.json([]) : new Response(null, { status: 204 });
      }
      return new Response('no simulado: ' + url, { status: 599 });
    }),
  );
  return rpcs;
}

const auth = async () => ({ Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, 'Content-Type': 'application/json' });
const list = async () => makeApp().request('/api/v1/admin/mm/reports', { headers: await auth() }, testEnv());
const resolve = async () =>
  makeApp().request(`/api/v1/admin/mm/reports/${REPORT}/resolve`, { method: 'POST', headers: await auth(), body: JSON.stringify({ action: 'dismiss' }) }, testEnv());

describe('reportes del matchmaking', () => {
  it('un moderador: 403 al verlos y al resolverlos, sin llegar a la base', async () => {
    const rpcs = stub('moderator');
    expect((await list()).status).toBe(403);
    expect((await resolve()).status).toBe(403);
    expect(rpcs).toEqual([]);
  });

  it('el admin los ve y los resuelve', async () => {
    const rpcs = stub('admin');
    expect((await list()).status).toBe(200);
    expect((await resolve()).status).toBe(200);
    expect(rpcs).toEqual(['mm_admin_lists', 'mm_admin_resolve_report']);
  });
});
