import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { MemoryRateLimiter, RATE_RULES, rateLimit, type RateRule } from '../../src/lib/ratelimit';
import { json, testEnv } from '../helpers';

const rule: RateRule = { name: 't', limit: 3, windowSec: 60, binding: 'RL_T' };

describe('MemoryRateLimiter', () => {
  it('permite hasta el límite y después bloquea con el tiempo restante', async () => {
    let now = 1_000_000;
    const rl = new MemoryRateLimiter(() => now);
    for (let i = 0; i < 3; i++) expect((await rl.hit(rule, 'ip')).ok).toBe(true);
    now += 15_000;
    expect(await rl.hit(rule, 'ip')).toEqual({ ok: false, retryAfter: 45 });
  });

  it('reinicia al terminar la ventana', async () => {
    let now = 0;
    const rl = new MemoryRateLimiter(() => now);
    for (let i = 0; i < 4; i++) await rl.hit(rule, 'ip');
    now += 60_000;
    expect((await rl.hit(rule, 'ip')).ok).toBe(true);
  });

  it('cuenta por separado cada clave y cada regla', async () => {
    const rl = new MemoryRateLimiter(() => 0);
    for (let i = 0; i < 3; i++) await rl.hit(rule, 'a');
    expect((await rl.hit(rule, 'a')).ok).toBe(false);
    expect((await rl.hit(rule, 'b')).ok).toBe(true);
    expect((await rl.hit({ ...rule, name: 'otra' }, 'a')).ok).toBe(true);
  });
});

describe('middleware rateLimit', () => {
  const build = () => {
    const app = createApp({ rateLimiter: new MemoryRateLimiter(() => 0) });
    app.post('/login', rateLimit(RATE_RULES.auth), (c) => c.json({ ok: true }));
    return app;
  };
  const post = (app: ReturnType<typeof build>, ip: string, env = testEnv({ CLIENT_IP_HEADER: 'x-forwarded-for' })) =>
    app.request('/login', { method: 'POST', headers: { 'X-Forwarded-For': ip } }, env);

  it('responde 429 con Retry-After después de 10 intentos de la misma IP', async () => {
    const app = build();
    for (let i = 0; i < 10; i++) expect((await post(app, '1.1.1.1')).status).toBe(200);
    const res = await post(app, '1.1.1.1, 10.0.0.1');
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
    expect((await json(res)).error.code).toBe('RATE_LIMITED');
    expect((await post(app, '2.2.2.2')).status).toBe(200);
  });

  it('sin CLIENT_IP_HEADER ignora el header (no se puede falsear la IP)', async () => {
    const app = build();
    const env = testEnv({ CLIENT_IP_HEADER: '' });
    for (let i = 0; i < 10; i++) await post(app, `9.9.9.${i}`, env);
    expect((await post(app, '9.9.9.200', env)).status).toBe(429);
  });

  it('usa el binding de Workers si está en el env', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const res = await build().request(
      '/login',
      { method: 'POST', headers: { 'CF-Connecting-IP': '3.3.3.3' } },
      { ...testEnv({ CLIENT_IP_HEADER: 'cf-connecting-ip' }), RL_AUTH: { limit } },
    );
    expect(res.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: 'auth:3.3.3.3' });
  });

  it('rechaza un CLIENT_IP_HEADER no soportado como configuración inválida', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post(build(), '1.1.1.1', testEnv({ CLIENT_IP_HEADER: 'x-cualquiera' }));
    expect((await json(res)).error.code).toBe('CONFIG_INVALID');
    vi.restoreAllMocks();
  });
});
