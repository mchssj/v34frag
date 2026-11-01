import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readImage, sniffImage, storageError } from '../../src/lib/uploads';
import { cleanFaceit, cleanSteam, ProfilePatch } from '../../src/schemas/profile';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe('sniffImage', () => {
  it.each([
    ['JPEG', bytes(0xff, 0xd8, 0xff, 0xe0), 'image/jpeg'],
    ['PNG', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'image/png'],
    ['WebP', bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50), 'image/webp'],
  ])('reconoce %s', (_n, b, mime) => expect(sniffImage(b)?.mime).toBe(mime));

  it.each([
    ['GIF', new TextEncoder().encode('GIF89a..........')],
    ['ejecutable', bytes(0x4d, 0x5a)],
    ['RIFF que no es WebP (WAV)', bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45)],
    ['vacío', new Uint8Array()],
  ])('rechaza %s', (_n, b) => expect(sniffImage(b)).toBeNull());
});

describe('readImage', () => {
  it('400 si el archivo está vacío', async () => {
    await expect(readImage(new File([], 'a.png'), 10)).rejects.toMatchObject({ status: 400, code: 'INVALID_FILE' });
  });
  it('413 si supera el máximo', async () => {
    await expect(readImage(new File([new Uint8Array(11)], 'a.png'), 10)).rejects.toMatchObject({ status: 413 });
  });
});

describe('storageError', () => {
  it.each([
    [{ statusCode: '413', message: 'too big' }, 413, 'FILE_TOO_LARGE'],
    [{ statusCode: 415, message: 'x' }, 400, 'INVALID_FILE'],
    [{ message: 'mime type not supported' }, 400, 'INVALID_FILE'],
    [{ statusCode: '403', message: 'rls' }, 403, 'FORBIDDEN'],
    [{ statusCode: '500', message: 'x' }, 500, 'INTERNAL'],
  ])('%o → %i %s', (e, status, code) => expect(storageError(e)).toMatchObject({ status, code }));
});

describe('cleanSteam / cleanFaceit (mismas reglas que la web)', () => {
  it.each([
    ['76561198000000000', '76561198000000000'],
    ['STEAM_0:1:12345', 'STEAM_0:1:12345'],
    ['http://steamcommunity.com/profiles/76561198000000000/', 'https://steamcommunity.com/profiles/76561198000000000/'],
    ['mecha_css', 'mecha_css'],
    ['https://steamcommunity.com/groups/x', null],
    ['con espacios', null],
  ])('steam %s → %s', (v, out) => expect(cleanSteam(v)).toBe(out));

  it.each([
    ['http://faceit.com/es/players/mecha', 'https://faceit.com/es/players/mecha'],
    ['mecha', 'mecha'],
    ['https://evil.com/faceit.com', null],
    ['m', null],
  ])('faceit %s → %s', (v, out) => expect(cleanFaceit(v)).toBe(out));
});

describe('ProfilePatch', () => {
  it('normaliza: recorta, "" pasa a null y omite lo no enviado', () => {
    const r = ProfilePatch.parse({ tag: ' Ab ', discord: '', country: '', real_name: null });
    expect(r).toEqual({ tag: 'Ab', discord: null, country: null, real_name: null });
    expect('steam' in r && r.steam !== undefined).toBe(false);
  });

  it('descarta campos desconocidos (como user_id)', () => {
    expect(ProfilePatch.parse({ discord: 'abc', user_id: 'x' })).not.toHaveProperty('user_id');
  });

  it.each([
    [{ real_name: 'R2-D2 <script>' }, 'real_name'],
    [{ discord: 'con espacio' }, 'discord'],
    [{ game_role: 'Cocinero' }, 'game_role'],
    [{ tag: 'x'.repeat(25) }, 'tag'],
    [{ faceit: 'f'.repeat(121) }, 'faceit'],
  ])('rechaza %o', (body, path) => {
    const r = ProfilePatch.safeParse(body);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual([path]);
  });

  it('rechaza un cuerpo sin cambios', () => {
    expect(ProfilePatch.safeParse({}).success).toBe(false);
  });
});

// Avatar: si falla guardar la URL en el perfil, se borra el archivo recién subido.
describe('POST /api/v1/me/avatar con Supabase simulado', () => {
  const USER = '33333333-3333-4333-8333-333333333333';
  let key: TestKey;
  beforeAll(async () => {
    key = await makeKey();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stub(opts: { upsertFails?: boolean; uploadStatus?: number; previous?: string }) {
    const calls: { method: string; url: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const url = String(input instanceof Request ? input.url : input);
        const method = (input instanceof Request ? input.method : init.method) ?? 'GET';
        calls.push({ method, url });
        if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
        if (url.includes('/rest/v1/profile_details') && method === 'GET')
          return Response.json(opts.previous ? [{ avatar_url: opts.previous }] : []);
        if (url.includes('/rest/v1/profile_details') && method === 'POST')
          return opts.upsertFails ? Response.json({ code: '23514', message: 'check' }, { status: 400 }) : new Response(null, { status: 201 });
        if (url.includes('/storage/v1/object/avatars/') && method === 'POST')
          return opts.uploadStatus
            ? Response.json({ statusCode: String(opts.uploadStatus), error: 'x', message: 'falló' }, { status: opts.uploadStatus })
            : Response.json({ Key: 'avatars/x', Id: '1' });
        if (url.includes('/storage/v1/object/avatars') && method === 'DELETE') return Response.json([]);
        return new Response('no simulado ' + url, { status: 599 });
      }),
    );
    return calls;
  }

  const send = async () => {
    const fd = new FormData();
    fd.append('file', new File([bytes(0xff, 0xd8, 0xff)], 'a.jpg'));
    return makeApp().request(
      '/api/v1/me/avatar',
      { method: 'POST', headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` }, body: fd },
      testEnv(),
    );
  };

  it('borra el archivo subido si no se pudo guardar en el perfil', async () => {
    const calls = stub({ upsertFails: true });
    const res = await send();
    expect(res.status).toBe(400);
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/storage/v1/object/avatars'))).toBe(true);
  });

  it('traduce el error de Storage (403 → FORBIDDEN) y no toca el perfil', async () => {
    const calls = stub({ uploadStatus: 403 });
    const res = await send();
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe('FORBIDDEN');
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('/rest/v1/profile_details'))).toBe(false);
  });

  it('no intenta borrar un avatar anterior que no está en la carpeta del usuario', async () => {
    const calls = stub({ previous: 'https://otro.sitio/foto.jpg' });
    expect((await send()).status).toBe(200);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });
});
