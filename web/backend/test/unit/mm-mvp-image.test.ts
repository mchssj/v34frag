import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Imagen de la tarjeta del MVP (replanteo 54), con PostgREST y Storage simulados.
const USER = '55555555-5555-4555-8555-555555555555';
const OLD = 'http://supabase.test/storage/v1/object/public/photos/mm/1.png';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: string | null };

function stub(opts: { role?: 'admin' | 'user'; rpcFails?: boolean; current?: string | null } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
      const method = (input instanceof Request ? input.method : init.method) ?? 'GET';
      calls.push({ method, url, body: typeof init.body === 'string' ? init.body : null });
      if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      if (url.includes('/rest/v1/profiles')) return Response.json([{ role: opts.role ?? 'admin' }]);
      if (url.includes('/rpc/mm_mvp_image')) return Response.json(opts.current ?? null);
      if (url.includes('/rpc/mm_admin_set_mvp_image')) {
        return opts.rpcFails ? Response.json({ message: 'Solo admins', code: '42501' }, { status: 403 }) : Response.json(OLD);
      }
      if (url.includes('/storage/v1/object/photos/') && method === 'POST') return Response.json({ Key: 'photos/mm/x.png' });
      if (url.includes('/storage/v1/object/photos') && method === 'DELETE') return Response.json([]);
      return new Response('no simulado: ' + url, { status: 599 });
    }),
  );
  return calls;
}

/** Cabecera de un PNG con esas medidas (alcanza para el tipo y el tamaño). */
function png(width: number, height: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

const auth = async () => ({ Authorization: `Bearer ${await signToken(key, userClaims(USER))}` });
const upload = async (image: Uint8Array<ArrayBuffer>) => {
  const fd = new FormData();
  fd.append('file', new File([image], 'mvp.png', { type: 'image/png' }));
  return makeApp().request('/api/v1/admin/mm/mvp-image', { method: 'PUT', headers: await auth(), body: fd }, testEnv());
};

describe('GET /api/v1/mm/mvp-image', () => {
  it('devuelve la URL (o null)', async () => {
    stub({ current: OLD });
    const res = await makeApp().request('/api/v1/mm/mvp-image', { headers: await auth() }, testEnv());
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ url: OLD });
  });

  it('sin sesión: 401', async () => {
    stub();
    expect((await makeApp().request('/api/v1/mm/mvp-image', {}, testEnv())).status).toBe(401);
  });
});

describe('PUT /api/v1/admin/mm/mvp-image', () => {
  it('sube a photos/mm/, guarda la URL y borra la anterior', async () => {
    const calls = stub();
    const res = await upload(png(1600, 400));
    expect(res.status).toBe(200);
    const { url } = (await json(res)) as { url: string };
    expect(url).toMatch(/\/storage\/v1\/object\/public\/photos\/mm\/\d+\.png$/);
    expect(calls.find((c) => c.url.includes('/rpc/mm_admin_set_mvp_image'))!.body).toContain(url);
    await vi.waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/storage/v1/object/photos'))).toBe(true),
    );
  });

  it('una imagen que no es 4:1: 400 y no sube nada', async () => {
    const calls = stub();
    const res = await upload(png(1000, 1000));
    expect(res.status).toBe(400);
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('/storage/'))).toBe(false);
  });

  it('un usuario común: 403', async () => {
    const calls = stub({ role: 'user' });
    expect((await upload(png(1600, 400))).status).toBe(403);
    expect(calls.some((c) => c.url.includes('/storage/'))).toBe(false);
  });

  it('si la base la rechaza, borra el archivo recién subido', async () => {
    const calls = stub({ rpcFails: true });
    const res = await upload(png(1600, 400));
    expect(res.status).toBe(403);
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/storage/v1/object/photos'))).toBe(true);
  });
});

describe('DELETE /api/v1/admin/mm/mvp-image', () => {
  it('la quita y borra el archivo', async () => {
    const calls = stub();
    const res = await makeApp().request('/api/v1/admin/mm/mvp-image', { method: 'DELETE', headers: await auth() }, testEnv());
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ url: null });
    expect(calls.find((c) => c.url.includes('/rpc/mm_admin_set_mvp_image'))!.body).toContain('"p_url":null');
    await vi.waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/storage/v1/object/photos'))).toBe(true),
    );
  });
});
