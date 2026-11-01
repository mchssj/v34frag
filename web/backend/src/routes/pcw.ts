import { createRoute, type z } from '@hono/zod-openapi';
import { requireAdmin, requireUser } from '../lib/auth';
import { AppError, fromPostgrest } from '../lib/errors';
import { createRouter } from '../lib/router';
import { anonClient } from '../lib/supabase';
import { bearer, errorResponses, json } from '../schemas/common';
import { PcwFormats, PcwFormatsBody } from '../schemas/pcw';

type Formats = z.infer<typeof PcwFormats>['formats'];
const sorted = (v: number[]) => [...new Set(v)].sort((a, b) => a - b) as Formats;

// ---------- rutas ----------

const getFormats = createRoute({
  method: 'get',
  path: '/api/v1/pcw/formats',
  tags: ['PCW'],
  summary: 'Formatos de PCW habilitados',
  description: 'Los formatos (BO1, BO3, BO5) que se pueden elegir al publicar una PCW. Los decide un admin. No pide sesión.',
  responses: {
    200: { description: 'Formatos habilitados', ...json(PcwFormats) },
  },
});

const putFormats = createRoute({
  method: 'put',
  path: '/api/v1/admin/pcw/formats',
  tags: ['Admin'],
  summary: 'Cambiar los formatos de PCW habilitados',
  description:
    'Solo admin. Las PCW ya publicadas o aceptadas conservan su formato aunque se deshabilite. ' +
    'Tiene que quedar al menos uno.',
  request: { body: { required: true, ...json(PcwFormatsBody) } },
  responses: {
    200: { description: 'Formatos guardados', ...json(PcwFormats) },
    ...errorResponses(400, 401, 403),
  },
  security: bearer,
  middleware: [requireUser, requireAdmin] as const,
});

export const pcw = createRouter()
  .openapi(getFormats, async (c) => {
    const { data, error } = await anonClient(c.var.config).from('pcw_config').select('best_of').eq('id', 1).maybeSingle();
    if (error) throw fromPostgrest(error);
    if (!data) throw new AppError(500, 'INTERNAL', 'Falta la configuración de PCW.');
    c.header('Cache-Control', 'no-store');
    return c.json({ formats: sorted(data.best_of) }, 200);
  })
  .openapi(putFormats, async (c) => {
    const { formats } = c.req.valid('json');
    const { data, error } = await c.var.sb.rpc('set_pcw_formats', { p_best_of: formats });
    if (error) throw fromPostgrest(error);
    return c.json({ formats: sorted(data ?? []) }, 200);
  });
