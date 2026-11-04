import { describe, expect, it } from 'vitest';
import { isAllowedOrigin, parseOrigins } from '../../src/lib/cors';
import { makeApp, testEnv } from '../helpers';

describe('parseOrigins / isAllowedOrigin', () => {
  const allowed = parseOrigins('https://csstv.pages.dev, https://*.csstv.pages.dev, http://localhost:*');

  it.each([
    'https://csstv.pages.dev',
    'https://pr-12.csstv.pages.dev',
    'https://abc123.csstv.pages.dev',
    'http://localhost:5173',
    'http://localhost',
  ])('permite %s', (o) => expect(isAllowedOrigin(o, allowed)).toBe(true));

  it.each([
    'https://evil.dev',
    'https://csstv.pages.dev.evil.dev',
    'https://a.b.csstv.pages.dev', // el comodín es un solo nivel
    'http://csstv.pages.dev', // otro esquema
    'https://csstv.pages.dev:8443', // otro puerto
    'https://xcsstv.pages.dev',
    'http://localhost.evil.dev:5173',
  ])('rechaza %s', (o) => expect(isAllowedOrigin(o, allowed)).toBe(false));

  it('lista vacía no permite nada', () => {
    expect(isAllowedOrigin('https://csstv.pages.dev', parseOrigins(''))).toBe(false);
  });

  it.each(['csstv.pages.dev', 'https://cs*tv.pages.dev', 'ftp://x.dev', 'https://x.dev/ruta'])(
    'falla con un patrón inválido: %s',
    (p) => expect(() => parseOrigins(p)).toThrow(/origen inválido/),
  );
});

describe('CORS en la app', () => {
  const preflight = (origin: string) =>
    makeApp().request(
      '/api/health',
      { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' } },
      testEnv(),
    );

  it('responde el preflight a un origen permitido', async () => {
    const res = await preflight('https://pr-3.csstv.pages.dev');
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://pr-3.csstv.pages.dev');
    expect(res.headers.get('access-control-allow-headers')).toContain('Authorization');
  });

  it('no devuelve Allow-Origin a un origen no permitido', async () => {
    const res = await preflight('https://evil.dev');
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('expone X-Request-Id en las respuestas normales', async () => {
    const res = await makeApp().request('/api/health', { headers: { Origin: 'http://localhost:5173' } }, testEnv());
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(res.headers.get('access-control-expose-headers')).toContain('X-Request-Id');
  });
});
