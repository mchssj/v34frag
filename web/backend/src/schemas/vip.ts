import { z } from '@hono/zod-openapi';
import { Envelope, listQuery } from '../lib/list';

// VIP, fase 0 (plan docs/bitacora/2026-10-28-vip-fase-0, migración 20261028120000_vip.sql y replanteo 32).

const STATUS = ['lifetime', 'active', 'revoked', 'expired'] as const;

export const VipStatus = z
  .object({
    active: z.boolean().openapi({ description: 'Es VIP hoy' }),
    lifetime: z.boolean().openapi({ description: 'VIP sin fecha de fin' }),
    until: z.string().nullable().openapi({ description: 'Hasta cuándo, si está activo y no es lifetime' }),
    since: z.string().openapi({ description: 'Inicio del primer período (también si después se revocó o venció)' }),
  })
  .openapi('VipStatus');

export const AdminVip = z
  .object({
    user: z.object({ id: z.uuid(), alias: z.string() }),
    player: z.object({ id: z.uuid(), photo_url: z.string().nullable() }).nullable().openapi({ description: 'Ficha de la cuenta, si tiene' }),
    status: z.enum(STATUS).openapi({ description: '`lifetime`, `active`, `revoked` (el último período se quitó) o `expired`' }),
    active: z.boolean(),
    lifetime: z.boolean(),
    until: z.string().nullable().openapi({ description: 'Fin del VIP vigente; `null` si es lifetime o no está activo' }),
    since: z.string(),
    last_change: z.string().openapi({ description: 'Último período cargado o quitado' }),
  })
  .openapi('AdminVip');
export const AdminVipList = Envelope(AdminVip).openapi('AdminVipList');

export const AdminVipQuery = listQuery(['until', 'since', 'alias', 'last_change'], { sort: 'until', order: 'asc' }).extend({
  status: z.enum(STATUS).optional(),
  q: z.string().max(40).optional().openapi({ description: 'Busca en el alias' }),
  expiring: z.coerce.number().int().min(1).max(90).optional().openapi({
    description: 'Solo los temporales activos que vencen en los próximos N días (de 1 a 90)',
  }),
});

export const VipPeriod = z
  .object({
    id: z.uuid(),
    starts_at: z.string(),
    ends_at: z.string().nullable().openapi({ description: '`null`: lifetime' }),
    source: z.enum(['manual', 'import']).openapi({ description: '`manual` (desde el admin) o `import` (carga inicial)' }),
    note: z.string().nullable(),
    granted_by: z.object({ id: z.uuid(), alias: z.string() }).nullable(),
    created_at: z.string(),
    revoked: z
      .object({ at: z.string(), reason: z.string().nullable(), by: z.object({ id: z.uuid(), alias: z.string() }).nullable() })
      .nullable(),
  })
  .openapi('VipPeriod');

export const AdminUserVip = z
  .object({
    vip: VipStatus.nullable().openapi({ description: '`null` si nunca fue VIP' }),
    periods: z.array(VipPeriod).openapi({ description: 'Del más nuevo al más viejo' }),
  })
  .openapi('AdminUserVip');

export const VipGrant = z
  .object({
    months: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]).optional().openapi({
      description: '1, 3, 6 o 12. Si ya es VIP, se suman desde donde termina el actual',
    }),
    until: z.iso.datetime({ offset: true }).optional().openapi({ description: 'Fecha de fin. Si ya es VIP, tiene que pasar el fin actual' }),
    lifetime: z.literal(true).optional().openapi({ description: 'Sin fecha de fin' }),
    note: z.string().trim().max(200, 'Hasta 200 caracteres').optional().openapi({ description: 'Por ejemplo, "pagó 3 meses"' }),
  })
  .superRefine((v, ctx) => {
    if ([v.months, v.until, v.lifetime].filter((x) => x !== undefined).length !== 1)
      ctx.addIssue({ code: 'custom', path: ['months'], message: 'Elegí una duración: `months`, `until` o `lifetime`, una de las tres' });
  })
  .openapi('VipGrant');

export const VipRevoke = z
  .object({ reason: z.string().trim().min(1, 'El motivo es obligatorio').max(200, 'Hasta 200 caracteres') })
  .openapi('VipRevoke');
