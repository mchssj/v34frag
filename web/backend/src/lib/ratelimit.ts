import type { Context, MiddlewareHandler } from 'hono';
import { AppError } from './errors';
import type { AppEnv } from './types';

export type RateRule = {
  name: string;
  limit: number;
  windowSec: 10 | 60; // los únicos períodos que admite el binding de Workers
  binding: string; // nombre del binding [[ratelimits]] en wrangler.toml
};

export const RATE_RULES = {
  // Login y registro: 10 intentos por minuto por IP (los dos endpoints comparten el contador).
  auth: { name: 'auth', limit: 10, windowSec: 60, binding: 'RL_AUTH' },
  // Cambio de contraseña: 5 intentos por minuto por cuenta (frena a quien prueba claves con una sesión robada).
  password: { name: 'password', limit: 5, windowSec: 60, binding: 'RL_PASSWORD' },
} as const satisfies Record<string, RateRule>;

export type RateResult = { ok: boolean; retryAfter: number };

export interface RateLimiter {
  hit(rule: RateRule, key: string): Promise<RateResult>;
}

/**
 * Ventana fija en memoria. Es lo que se usa en Node (VPS): un solo proceso, así que el contador es
 * exacto. Si algún día se corre más de un proceso (cluster), cada uno tendría su propio contador.
 */
export class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private now: () => number = Date.now) {}

  async hit(rule: RateRule, key: string): Promise<RateResult> {
    const now = this.now();
    if (this.hits.size > 10_000) this.sweep(now);
    const id = `${rule.name}:${key}`;
    let e = this.hits.get(id);
    if (!e || e.resetAt <= now) this.hits.set(id, (e = { count: 0, resetAt: now + rule.windowSec * 1000 }));
    e.count++;
    return { ok: e.count <= rule.limit, retryAfter: Math.max(1, Math.ceil((e.resetAt - now) / 1000)) };
  }

  private sweep(now: number) {
    for (const [k, e] of this.hits) if (e.resetAt <= now) this.hits.delete(k);
  }
}

// Binding de rate limiting de Cloudflare Workers (cuando la app corre como Worker).
type WorkersBinding = { limit(opts: { key: string }): Promise<{ success: boolean }> };
const isWorkersBinding = (b: unknown): b is WorkersBinding =>
  typeof b === 'object' && b !== null && typeof (b as WorkersBinding).limit === 'function';

/**
 * IP del cliente según CLIENT_IP_HEADER:
 *   x-forwarded-for   detrás de Caddy/nginx en el VPS (el proxy la pisa, no la manda el cliente)
 *   cf-connecting-ip  en Workers o detrás del proxy de Cloudflare
 * Sin la variable, no se confía en ningún header y todos comparten el contador "unknown".
 */
export function clientIp(c: Context<AppEnv>): string {
  const header = c.var.config.CLIENT_IP_HEADER;
  const raw = header ? c.req.header(header) : undefined;
  const ip = raw?.split(',')[0]?.trim();
  return ip ? ip.slice(0, 64) : 'unknown';
}

/** Por defecto cuenta por IP; keyOf permite contar por otra cosa (por ejemplo, la cuenta, después de requireUser). */
export const rateLimit =
  (rule: RateRule, keyOf: (c: Context<AppEnv>) => string = clientIp): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const key = keyOf(c);
    const binding = c.env?.[rule.binding];
    const res = isWorkersBinding(binding)
      ? { ok: (await binding.limit({ key: `${rule.name}:${key}` })).success, retryAfter: rule.windowSec }
      : await c.var.rateLimiter.hit(rule, key);
    if (!res.ok) {
      throw new AppError(429, 'RATE_LIMITED', 'Demasiados intentos. Espera un momento y vuelve a probar.', undefined, {
        'Retry-After': String(res.retryAfter),
      });
    }
    await next();
  };
