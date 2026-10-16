import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, makeApp, testEnv } from '../helpers';

afterEach(() => vi.unstubAllGlobals());

describe('GET /api/health', () => {
  it('responde ok con entorno, versión y request id', async () => {
    const res = await makeApp().request('/api/health', {}, testEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-request-id')).toBeTruthy();
    const body = await json(res);
    expect(body).toMatchObject({ status: 'ok', env: 'test', version: 'abc1234' });
    expect(body.supabase).toBeUndefined();
  });

  it('con deep=1 consulta a Supabase Auth', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const body = await json(await makeApp().request('/api/health?deep=1', {}, testEnv()));
    expect(body.supabase).toBe('ok');
    expect(fetchMock).toHaveBeenCalledWith('http://supabase.test/auth/v1/health', expect.anything());
  });

  it('con deep=1 informa error si Supabase no responde', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('sin red'); }));
    const body = await json(await makeApp().request('/api/health?deep=1', {}, testEnv()));
    expect(body.supabase).toBe('error');
  });

  it('rechaza un query inválido con el formato de error', async () => {
    const res = await makeApp().request('/api/health?deep=2', {}, testEnv());
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details[0].path).toBe('deep');
    expect(body.error.requestId).toBe(res.headers.get('x-request-id'));
  });
});

describe('documentación', () => {
  it('publica la OpenAPI 3.1 con health y el esquema bearer', async () => {
    const res = await makeApp().request('http://api.test/api/openapi.json', {}, testEnv());
    expect(res.status).toBe(200);
    const doc = await json(res);
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.version).toBe('abc1234');
    expect(doc.servers[0].url).toBe('http://api.test');
    expect(doc.paths['/api/health'].get).toBeDefined();
    for (const p of ['/auth/signup', '/auth/login', '/auth/refresh', '/auth/logout']) expect(doc.paths[p].post).toBeDefined();
    expect(doc.paths['/auth/me'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(doc.components.schemas.Session).toBeDefined();
    expect(doc.paths['/api/v1/me/profile'].get).toBeDefined();
    expect(doc.paths['/api/v1/me/profile'].patch).toBeDefined();
    expect(doc.paths['/api/v1/me/avatar'].post.requestBody.content['multipart/form-data']).toBeDefined();
    expect(doc.paths['/api/v1/me/profile-requests']).toBeUndefined();
    expect(doc.paths['/api/v1/me/profile'].get.deprecated).toBeUndefined();
    expect(doc.paths['/api/v1/pcw/formats'].get).toBeDefined();
    expect(doc.paths['/api/v1/admin/pcw/formats'].put.security).toEqual([{ bearerAuth: [] }]);
    expect(doc.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
    expect(doc.components.schemas.Error).toBeDefined();
  });

  it('sirve la página de Scalar en /api/docs', async () => {
    const res = await makeApp().request('/api/docs', {}, testEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('/api/openapi.json');
  });
});

describe('rutas inexistentes y configuración', () => {
  it('404 con el formato de error', async () => {
    const res = await makeApp().request('/api/v1/nada', {}, testEnv());
    expect(res.status).toBe(404);
    expect((await json(res)).error.code).toBe('NOT_FOUND');
  });

  it('500 CONFIG_INVALID si falta una variable, sin filtrar valores', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await makeApp().request('/api/health', {}, testEnv({ SUPABASE_URL: undefined }));
    expect(res.status).toBe(500);
    const body = await json(res);
    expect(body.error.code).toBe('CONFIG_INVALID');
    const logged = String(err.mock.calls[0]?.[0]);
    expect(logged).toContain('SUPABASE_URL');
    expect(logged).not.toContain('anon-key-de-prueba');
    err.mockRestore();
  });

  it('500 CONFIG_INVALID si CORS_ORIGINS tiene un patrón mal escrito', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await makeApp().request('/api/health', {}, testEnv({ CORS_ORIGINS: 'csstv.pages.dev' }));
    expect((await json(res)).error.code).toBe('CONFIG_INVALID');
    vi.restoreAllMocks();
  });
});
