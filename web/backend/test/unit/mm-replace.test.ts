import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';
import { replaceLink, replaceText, runReplaceNotices, type ReplaceConfig, type ReplaceNotice } from '../../src/jobs/mm-replace';

// Reemplazos del matchmaking (replanteo 75): el aviso en Discord que publica el worker y las rutas de la página del link.
const HOOK = 'https://discord.com/api/webhooks/1/abc';
const ROLE = '1559045996535873557';
const CFG = { hook: HOOK, role: ROLE, frontendUrl: 'https://cmleague.lat/' };
const TOKEN = '0123456789abcdef0123456789abcdef';
const OPEN: ReplaceNotice = {
  id: 'r1', shown: 'open', message_id: null, token: TOKEN, mode: '5v5', map: 'de\_dust2',
  expires_at: '2026-11-05T22:10:00Z', score: { a: 7, b: 5 },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('replaceText', () => {
  it('abierto: menciona al rol, lleva el link y cuándo vence', () => {
    expect(replaceText(OPEN, CFG)).toBe(
      `<@&${ROLE}> **Se busca reemplazo** para un mix del matchmaking: 5v5 en de\\_dust2 (7-5).\n` +
        `Entra acá: https://cmleague.lat/mm/reemplazo/${TOKEN}\n` +
        'El primero que entre se lo queda. El link vence <t:1793916600:R>.',
    );
  });

  it('encontrado y cerrado: sin mención ni link', () => {
    const found = replaceText({ ...OPEN, shown: 'found', token: null }, CFG);
    const closed = replaceText({ ...OPEN, shown: 'closed', token: null, score: null }, CFG);
    expect(found).toBe('~~Se busca reemplazo~~ **Reemplazo encontrado** para el mix de 5v5 en de\\_dust2 (7-5).');
    expect(closed).toBe('~~Se busca reemplazo~~ El pedido de reemplazo para el mix de 5v5 en de\\_dust2 se cerró.');
    expect(found + closed).not.toMatch(/<@|http/);
  });

  it('limpia el markdown del mapa y arma el link sin barras de más', () => {
    expect(replaceText({ ...OPEN, map: 'de_*x*@here', score: null }, { ...CFG, role: undefined })).toContain(': 5v5 en de\\_\\*x\\*here.');
    expect(replaceLink('https://cmleague.lat//', 'abc')).toBe('https://cmleague.lat/mm/reemplazo/abc');
  });
});

describe('runReplaceNotices', () => {
  type Rpc = { fn: string; args?: Record<string, unknown> };
  const setup = (pending: ReplaceNotice[], discord: (url: string, init: RequestInit) => Response) => {
    const rpcs: Rpc[] = [];
    const calls: { url: string; method?: string; body: Record<string, unknown> }[] = [];
    const rpc = vi.fn(async (fn: string, args?: Record<string, unknown>) => {
      rpcs.push({ fn, args });
      return { data: fn === 'mm_replace_pending' ? pending : null, error: null };
    });
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      calls.push({ url: String(input), method: init.method, body: JSON.parse(String(init.body)) });
      return discord(String(input), init);
    }) as unknown as typeof fetch;
    return { rpcs, calls, run: (cfg: ReplaceConfig = CFG) => runReplaceNotices(rpc, cfg, fetchImpl) };
  };

  it('publica el abierto (con wait=true), guarda el id del mensaje y menciona solo al rol', async () => {
    const t = setup([OPEN], () => Response.json({ id: '999' }));
    expect(await t.run()).toBe(1);
    expect(t.calls[0]).toMatchObject({ url: `${HOOK}?wait=true`, method: 'POST', body: { allowed_mentions: { parse: [], roles: [ROLE] } } });
    expect(t.rpcs.at(-1)).toEqual({ fn: 'mm_replace_mark', args: { p_id: 'r1', p_shown: 'open', p_message_id: '999', p_ok: true } });
  });

  it('edita el mensaje ya publicado sin volver a mencionar', async () => {
    const t = setup([{ ...OPEN, shown: 'found', token: null, message_id: '999' }], () => Response.json({ id: '999' }));
    expect(await t.run()).toBe(1);
    expect(t.calls[0]).toMatchObject({ url: `${HOOK}/messages/999`, method: 'PATCH', body: { allowed_mentions: { parse: [], roles: [] } } });
    expect(t.rpcs.at(-1)?.args).toMatchObject({ p_shown: 'found', p_message_id: '999', p_ok: true });
  });

  it('si Discord falla, suma un intento', async () => {
    const t = setup([OPEN], () => new Response('no', { status: 500 }));
    expect(await t.run()).toBe(0);
    expect(t.rpcs.at(-1)?.args).toMatchObject({ p_id: 'r1', p_message_id: null, p_ok: false });
  });

  it('sin webhook no pide nada', async () => {
    const t = setup([OPEN], () => Response.json({ id: '1' }));
    expect(await t.run({ ...CFG, hook: undefined })).toBe(0);
    expect(t.rpcs).toEqual([]);
  });

  it('un cerrado que nunca se publicó no se publica', async () => {
    const t = setup([{ ...OPEN, shown: 'closed', token: null }], () => Response.json({ id: '1' }));
    expect(await t.run()).toBe(0);
    expect(t.calls).toEqual([]);
  });
});

describe('rutas /api/v1/mm/replace/{token}', () => {
  const USER = '75757575-7575-4575-8575-757575757575';
  let key: TestKey;
  beforeAll(async () => {
    key = await makeKey();
  });

  const stub = (takeError?: { code: string; message: string }) => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
        if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
        if (typeof init.body === 'string') bodies.push(JSON.parse(init.body));
        if (url.includes('/rpc/mm_replace_info')) return Response.json({ status: 'open', mode: '5v5', map: 'de\_dust2', reason: null });
        if (url.includes('/rpc/mm_replace_take')) return takeError ? Response.json(takeError, { status: 400 }) : Response.json('lobby-1');
        if (url.includes('/rpc/mm_my_live')) return Response.json({ lobby: { id: 'lobby-1' } });
        return new Response('no simulado: ' + url, { status: 599 });
      }),
    );
    return bodies;
  };
  const call = async (method: 'GET' | 'POST', token = TOKEN) =>
    makeApp().request(`/api/v1/mm/replace/${token}`, { method, headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` } }, testEnv());

  it('GET devuelve la info del link', async () => {
    const bodies = stub();
    const res = await call('GET');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'open', map: 'de\_dust2' });
    expect(bodies).toContainEqual({ p_token: TOKEN });
  });

  it('POST lo toma y devuelve el estado con la sala', async () => {
    stub();
    const res = await call('POST');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ lobby: { id: 'lobby-1' } });
  });

  it('si ya lo tomó otro, 409 con el mensaje de la base', async () => {
    stub({ code: 'V3901', message: 'Ya lo tomó otro jugador' });
    const res = await call('POST');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { message: 'Ya lo tomó otro jugador' } });
  });

  it('un token con otra forma no llega a la base', async () => {
    stub();
    expect((await call('GET', 'nada')).status).toBe(400);
  });

  it('sin sesión, 401', async () => {
    stub();
    const res = await makeApp().request(`/api/v1/mm/replace/${TOKEN}`, {}, testEnv());
    expect(res.status).toBe(401);
  });
});
