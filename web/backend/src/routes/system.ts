import { createRoute, z } from '@hono/zod-openapi';
import { createRouter } from '../lib/router';
import { errorResponses } from '../schemas/common';

const Health = z
  .object({
    status: z.literal('ok'),
    env: z.string().openapi({ example: 'production' }),
    version: z.string().openapi({ description: 'Commit desplegado', example: '04270ae' }),
    time: z.string().openapi({ example: '2026-10-14T22:00:00.000Z' }),
    supabase: z.enum(['ok', 'error']).optional().openapi({ description: 'Solo con ?deep=1' }),
  })
  .openapi('Health');

const health = createRoute({
  method: 'get',
  path: '/api/health',
  tags: ['Sistema'],
  summary: 'Estado del servicio',
  description: 'Responde siempre que el Worker esté arriba. Con `?deep=1` además consulta a Supabase Auth.',
  request: {
    query: z.object({
      deep: z.enum(['0', '1']).optional().openapi({ description: '1 = también verifica Supabase' }),
    }),
  },
  responses: {
    200: { description: 'Servicio arriba', content: { 'application/json': { schema: Health } } },
    ...errorResponses(400),
  },
});

export const system = createRouter().openapi(health, async (c) => {
  const cfg = c.var.config;
  const body: z.infer<typeof Health> = {
    status: 'ok',
    env: cfg.APP_ENV,
    version: cfg.GIT_SHA,
    time: new Date().toISOString(),
  };
  if (c.req.valid('query').deep === '1') body.supabase = await pingSupabase(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  c.header('Cache-Control', 'no-store');
  return c.json(body, 200);
});

async function pingSupabase(url: string, key: string): Promise<'ok' | 'error'> {
  try {
    const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key }, signal: AbortSignal.timeout(3000) });
    return r.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}
