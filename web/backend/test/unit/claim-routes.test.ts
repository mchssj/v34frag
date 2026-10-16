import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Rutas de !claim con PostgREST simulado (sin Docker): valores por defecto cuando la base devuelve poco.
const USER = '77777777-7777-4777-8777-777777777777';
const S = '76561198000000001';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function postgrest(handler: (url: URL) => Response | undefined) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const raw = String(input instanceof Request ? input.url : input);
      if (raw.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      const url = new URL(raw);
      if (url.pathname.endsWith('/profiles')) return Response.json([{ role: 'admin' }]);
      return handler(url) ?? Response.json([]);
    }),
  );
}
const call = async (method: string, path: string, body?: unknown) =>
  makeApp().request(
    path,
    {
      method,
      headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    testEnv(),
  );

describe('!claim: valores por defecto', () => {
  it('perfil sin reclamar con columnas vacías', async () => {
    postgrest((url) => (url.pathname.endsWith('/steam_profile_list') ? Response.json([{ steam_id: S }]) : undefined));
    const body = await json(await call('GET', `/api/v1/players/steam/${S}`));
    expect(body).toEqual({
      steam_id: S, claimed: false, player_id: null,
      profile: { steam_id: S, last_nick: null, nicks: [], matches: 0, first_played: null, last_played: null, elo: null, peak_elo: null, elo_matches: 0, level: null, stats: null },
    });
  });

  it('estado sin ficha, sin código y sin configuración', async () => {
    postgrest(() => undefined);
    expect(await json(await call('GET', '/api/v1/me/claim-code'))).toEqual({ steam_ids: [], max_steam_ids: 3, last_code: null, pending_requests: 0 });
  });

  it('código vencido', async () => {
    postgrest((url) =>
      url.pathname.endsWith('/claim_codes') ? Response.json([{ code: 'ABCDEF', expires_at: '2020-01-01T00:00:00Z', used_at: null, used_steam_id: null, result: null }]) : undefined,
    );
    expect((await json(await call('GET', '/api/v1/me/claim-code'))).last_code).toMatchObject({ status: 'expired' });
  });

  it('la base no devuelve el código: 500', async () => {
    postgrest(() => undefined);
    expect((await call('POST', '/api/v1/me/claim-code')).status).toBe(500);
  });

  it('configuración sin fila y guardado sin respuesta', async () => {
    postgrest(() => undefined);
    expect(await json(await call('GET', '/api/v1/admin/steam/config'))).toEqual({ max_steam_ids: 3 });
    postgrest((url) => (url.pathname.endsWith('/rpc/set_claim_config') ? Response.json(null) : undefined));
    expect(await json(await call('PUT', '/api/v1/admin/steam/config', { max_steam_ids: 2 }))).toEqual({ max_steam_ids: 2 });
  });
});
