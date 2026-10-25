import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';
import { notificationPrefsOf } from '../../src/schemas/notifications';

// /api/v1/notifications* con PostgREST simulado (sin Docker). La lógica de quién recibe qué está en la base
// (pruebas SQL del replanteo 28).
const USER = '44444444-4444-4444-8444-444444444444';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: string | null };

function postgrest(handler: (url: URL, method: string) => Response | undefined) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const raw = String(input instanceof Request ? input.url : input);
      const method = (input instanceof Request ? input.method : init.method) ?? 'GET';
      calls.push({ method, url: decodeURIComponent(raw), body: typeof init.body === 'string' ? init.body : null });
      if (raw.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      return handler(new URL(raw), method) ?? new Response('no simulado: ' + raw, { status: 599 });
    }),
  );
  return calls;
}

const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  makeApp().request(
    path,
    {
      method,
      headers: {
        Authorization: `Bearer ${await signToken(key, userClaims(USER))}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    testEnv(),
  );

const row = {
  id: 7,
  type: 'team_invite',
  category: 'team',
  data: { invite_id: 'x', team: { id: 't', name: 'Alfa', tag: 'A' } },
  actionable: true,
  resolution: null,
  created_at: '2026-10-25T12:00:00Z',
  read_at: null,
  actor_id: '11111111-1111-4111-8111-111111111111',
  actor_alias: 'Lider',
};

describe('GET /api/v1/notifications', () => {
  it('lista con el autor y "read", ordenada por fecha e id', async () => {
    const calls = postgrest((url) =>
      url.pathname.endsWith('/notification_list')
        ? new Response(JSON.stringify([row, { ...row, id: 6, actor_id: null, actor_alias: null, read_at: '2026-10-25T13:00:00Z' }]), {
            headers: { 'content-range': '0-1/2' },
          })
        : undefined,
    );
    const res = await call('GET', '/api/v1/notifications?unread=true&category=team');
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.total).toBe(2);
    expect(body.items[0]).toEqual({
      id: 7,
      type: 'team_invite',
      category: 'team',
      data: row.data,
      actionable: true,
      resolution: null,
      actor: { id: row.actor_id, alias: 'Lider' },
      created_at: row.created_at,
      read: false,
    });
    expect(body.items[1]).toMatchObject({ actor: null, read: true });
    const q = new URL(calls.find((c) => c.url.includes('/notification_list'))!.url).searchParams;
    expect(q.get('read_at')).toBe('is.null');
    expect(q.get('category')).toBe('eq.team');
    expect(q.get('order')).toBe('created_at.desc.nullslast,id.desc.nullslast');
  });

  it('actionable=true: solo las de aceptar o rechazar sin resolver', async () => {
    const calls = postgrest((url) => (url.pathname.endsWith('/notification_list') ? Response.json([]) : undefined));
    await call('GET', '/api/v1/notifications?actionable=true');
    const q = new URL(calls.find((c) => c.url.includes('/notification_list'))!.url).searchParams;
    expect(q.get('actionable')).toBe('eq.true');
    expect(q.get('resolution')).toBe('is.null');
  });

  it('400 con una categoría que no existe; 401 sin sesión', async () => {
    postgrest(() => undefined);
    expect((await call('GET', '/api/v1/notifications?category=chat')).status).toBe(400);
    expect((await makeApp().request('/api/v1/notifications', {}, testEnv())).status).toBe(401);
  });
});

describe('GET /api/v1/notifications/unread-count', () => {
  const world = (last: number) => (url: URL) =>
    url.pathname.endsWith('/rpc/notifications_unread') ? Response.json({ unread: 3, actionable: 1, last_id: last }) : undefined;

  it('el contador con ETag; 304 si no cambió; otro ETag si llegó una nueva aunque el número sea igual', async () => {
    postgrest(world(10));
    const first = await call('GET', '/api/v1/notifications/unread-count');
    expect(first.status).toBe(200);
    expect(await json(first)).toEqual({ unread: 3, actionable: 1 });
    const etag = first.headers.get('ETag')!;
    expect(etag).toMatch(/^W\//);
    expect((await call('GET', '/api/v1/notifications/unread-count', undefined, { 'If-None-Match': etag })).status).toBe(304);
    postgrest(world(11));
    expect((await call('GET', '/api/v1/notifications/unread-count', undefined, { 'If-None-Match': etag })).status).toBe(200);
  });
});

describe('POST /api/v1/notifications/read', () => {
  it('por ids o todas', async () => {
    const calls = postgrest((url) => (url.pathname.endsWith('/rpc/notifications_mark_read') ? Response.json(2) : undefined));
    expect((await call('POST', '/api/v1/notifications/read', { ids: [1, 2] })).status).toBe(204);
    expect((await call('POST', '/api/v1/notifications/read', { all: true })).status).toBe(204);
    const bodies = calls.filter((c) => c.url.includes('/rpc/notifications_mark_read')).map((c) => JSON.parse(c.body!));
    expect(bodies).toEqual([{ p_ids: [1, 2] }, { p_all: true }]);
  });

  it('400 sin ids, con ids vacíos o con las dos cosas', async () => {
    const calls = postgrest(() => undefined);
    for (const body of [{}, { ids: [] }, { ids: [1], all: true }, { all: false }]) {
      expect((await call('POST', '/api/v1/notifications/read', body)).status).toBe(400);
    }
    expect(calls.some((c) => c.url.includes('/rpc/'))).toBe(false);
  });
});

describe('notificationPrefsOf', () => {
  it('valores por defecto, lo guardado encima e ignora lo desconocido', () => {
    expect(notificationPrefsOf(null)).toMatchObject({ team: true, news: false, admin: true });
    expect(notificationPrefsOf({ notifications: { news: true, pcw: false, x: true, elo: 1 } })).toMatchObject({
      news: true,
      pcw: false,
      elo: true,
    });
  });
});
