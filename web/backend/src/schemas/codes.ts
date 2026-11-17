import { z } from '@hono/zod-openapi';
import { Envelope } from '../lib/list';
import { Cosmetic } from './shop';

// Códigos canjeables para sorteos (replanteo 126, bitácora docs/bitacora/2026-11-16-codigos-canjeables).

const Reward = z.enum(['item', 'points', 'vip_coins', 'vip']).openapi({
  description: '`item` (artículo de la tienda), `points` (puntos), `vip_coins` (monedas VIP) o `vip` (días de VIP)',
});
const CodeState = z.enum(['scheduled', 'active', 'used_up', 'expired', 'revoked']).openapi({
  description: '`scheduled` (todavía no empieza), `active`, `used_up` (sin usos), `expired` o `revoked`',
});

/** Lo que da un código. */
export const CodePrize = z
  .object({
    reward: Reward,
    item: Cosmetic.nullable().openapi({ description: 'El artículo (solo `item`)' }),
    amount: z.number().int().nullable().openapi({ description: 'Puntos o monedas VIP (solo `points` y `vip_coins`)' }),
    days: z.number().int().nullable().openapi({ description: 'Días del artículo o del VIP; null en un artículo = para siempre' }),
  })
  .openapi('CodePrize');

const Account = z
  .object({ id: z.uuid(), alias: z.string().nullable(), player_id: z.uuid().nullable(), nick: z.string().nullable() })
  .openapi('CodeAccount', { description: 'Una cuenta: su alias y su ficha (si tiene)' });

// ---------- jugador ----------

export const RedeemBody = z
  .object({
    code: z
      .string()
      .trim()
      .min(4, 'Escribe el código')
      .max(40, 'El código es más corto')
      .regex(/^[A-Za-z0-9\s-]+$/, 'El código lleva solo letras, números y guiones'),
  })
  .openapi('RedeemBody', { description: 'El código, con o sin guiones y en mayúsculas o minúsculas. Nunca va en la URL' });

export const RedeemResult = CodePrize.extend({
  until: z.string().nullable().openapi({ description: 'Hasta cuándo le dura (artículo temporal o VIP); null si es para siempre' }),
  label: z.string().nullable().openapi({ description: 'El sorteo' }),
}).openapi('RedeemResult');

export const MyRedemption = CodePrize.extend({
  id: z.uuid(),
  redeemed_at: z.string(),
  label: z.string().nullable(),
  code_tail: z.string().openapi({ description: 'Los últimos 4 caracteres del código' }),
  until: z.string().nullable(),
  reverted_at: z.string().nullable().openapi({ description: 'Si un admin revirtió el canje' }),
}).openapi('MyRedemption');
export const MyRedemptions = z.object({ items: z.array(MyRedemption) }).openapi('MyRedemptions');

// ---------- admin ----------

export const CodeCreate = z
  .object({
    reward: Reward,
    item: z.string().regex(/^[a-z0-9-]{2,60}$/, 'Artículo inválido').optional(),
    amount: z.number().int().min(1).max(100_000).optional(),
    days: z.number().int().min(1).max(365).optional().openapi({ description: 'Días del artículo (sin días = para siempre) o del VIP (obligatorio)' }),
    max_uses: z.number().int().min(1).max(10_000).default(1),
    count: z.number().int().min(1).max(100).default(1).openapi({ description: 'Cuántos códigos con el mismo premio (lote)' }),
    starts_at: z.iso.datetime({ offset: true }).optional().openapi({ description: 'Desde cuándo sirve (por defecto, ya)' }),
    expires_at: z.iso.datetime({ offset: true }).optional().openapi({ description: 'Hasta cuándo sirve (opcional)' }),
    for_user: z.uuid().optional().openapi({ description: 'Solo para esa cuenta (un código de 1 uso)' }),
    custom: z
      .string()
      .trim()
      .max(30)
      .regex(/^[A-Za-z0-9-]+$/, 'Solo letras, números y guiones')
      .optional()
      .openapi({ description: 'Código personalizado (8 a 24 letras y números); solo de a uno' }),
    label: z.string().trim().max(80, 'Hasta 80 caracteres').optional().openapi({ description: 'El sorteo' }),
    note: z.string().trim().max(200, 'Hasta 200 caracteres').optional().openapi({ description: 'Nota interna' }),
  })
  .superRefine((v, ctx) => {
    if (v.reward === 'item' && !v.item) ctx.addIssue({ code: 'custom', path: ['item'], message: 'Elige el artículo' });
    if ((v.reward === 'points' || v.reward === 'vip_coins') && !v.amount) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Falta la cantidad' });
    if (v.reward === 'vip' && !v.days) ctx.addIssue({ code: 'custom', path: ['days'], message: 'Elige cuántos días de VIP' });
  })
  .openapi('CodeCreate', { description: 'Las demás reglas (premio completo, vencimiento, personalizado único) las valida la base' });
export const CodeCreated = z
  .object({ batch_id: z.uuid(), codes: z.array(z.object({ id: z.uuid(), code: z.string() })) })
  .openapi('CodeCreated');

export const AdminCode = z
  .object({
    id: z.uuid(),
    code: z.string().openapi({ description: 'Como se muestra: `CML-XXXX-XXXX-XXXX` o el personalizado' }),
    custom: z.boolean(),
    batch_id: z.uuid(),
    prize: CodePrize,
    max_uses: z.number().int(),
    uses: z.number().int(),
    for_user: Account.nullable(),
    starts_at: z.string(),
    expires_at: z.string().nullable(),
    label: z.string().nullable(),
    note: z.string().nullable(),
    created_by: Account.nullable(),
    created_at: z.string(),
    revoked_at: z.string().nullable(),
    revoke_reason: z.string().nullable(),
    state: CodeState,
  })
  .openapi('AdminCode');
export const AdminCodeQuery = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({ description: 'Página, desde 1' }),
  per: z.coerce.number().int().min(1).max(200).default(50).openapi({ description: 'Elementos por página (máximo 200)' }),
  q: z.string().trim().max(40).optional().openapi({ description: 'Busca en el código, el sorteo y la nota' }),
  state: CodeState.optional(),
});
export const AdminCodeList = Envelope(AdminCode).openapi('AdminCodeList', { description: 'Lo más nuevo primero' });
export const CodeIdParam = z.object({ id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }) });

export const AdminRedemption = z
  .object({
    id: z.uuid(),
    account: Account.nullable(),
    redeemed_at: z.string(),
    until: z.string().nullable(),
    reverted_at: z.string().nullable(),
    reverted_by: Account.nullable(),
    revert_reason: z.string().nullable(),
  })
  .openapi('AdminRedemption');
export const AdminRedemptionList = z.object({ items: z.array(AdminRedemption) }).openapi('AdminRedemptionList');

export const RedeemAttempts = z
  .object({
    last_hour: z.number().int(),
    last_day: z.number().int(),
    attempts: z.array(
      z.object({
        at: z.string(),
        account: Account.nullable(),
        ip: z.string().nullable(),
        typed: z.string().nullable().openapi({ description: 'Los primeros 4 caracteres de lo que escribió' }),
      }),
    ),
    blocked: z.array(z.object({ account: Account.nullable(), until: z.string() })).openapi({ description: 'Cuentas bloqueadas ahora' }),
  })
  .openapi('RedeemAttempts', { description: 'Canjes fallidos (código que no existe, revocado o sin empezar) y cuentas bloqueadas' });
export const AttemptsQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });
