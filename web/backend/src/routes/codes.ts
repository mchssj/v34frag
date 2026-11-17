import { createRoute } from '@hono/zod-openapi';
import type { z } from '@hono/zod-openapi';
import { requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave } from '../lib/db';
import { AppError, type ErrorCode } from '../lib/errors';
import { clientIp, RATE_RULES, rateLimit } from '../lib/ratelimit';
import { createRouter } from '../lib/router';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  AdminCode,
  AdminCodeList,
  AdminCodeQuery,
  AdminRedemptionList,
  AttemptsQuery,
  CodeCreate,
  CodeCreated,
  CodeIdParam,
  MyRedemptions,
  RedeemAttempts,
  RedeemBody,
  RedeemResult,
} from '../schemas/codes';
import { IdParam } from '../schemas/admin';
import { Reason } from '../schemas/shop';

// Códigos canjeables para sorteos (replanteo 126, bitácora docs/bitacora/2026-11-16-codigos-canjeables). Las reglas
// (usos, vencimiento, una vez por cuenta, topes por cuenta, premios) las valida la base. El código va siempre en el
// cuerpo, nunca en la URL, y no se registra (requestLog no guarda cuerpos).

const tags = ['Tienda'];

/** Los motivos con que code_redeem rechaza un código, y cómo se responden. */
const REDEEM_ERRORS: Record<string, [400 | 403 | 404 | 409, ErrorCode]> = {
  code_invalid: [404, 'CODE_INVALID'],
  code_expired: [409, 'CODE_EXPIRED'],
  code_used_up: [409, 'CODE_USED_UP'],
  code_already_redeemed: [409, 'CODE_ALREADY_REDEEMED'],
  code_not_for_you: [403, 'CODE_NOT_FOR_YOU'],
  code_already_owned: [409, 'CODE_ALREADY_OWNED'],
  code_vip_lifetime: [409, 'CODE_VIP_LIFETIME'],
  code_no_player: [403, 'CODE_NO_PLAYER'],
  code_banned: [403, 'CODE_BANNED'],
};

type RedeemRow = z.infer<typeof RedeemResult> & { ok: boolean; error?: string; message?: string; retry_after?: number };

/** La respuesta de code_redeem: el premio, o el error con su motivo. */
export function redeemOutcome(r: RedeemRow): z.infer<typeof RedeemResult> {
  if (r.ok) return { reward: r.reward, item: r.item ?? null, amount: r.amount ?? null, days: r.days ?? null, until: r.until ?? null, label: r.label ?? null };
  const message = r.message ?? 'No se pudo canjear el código.';
  if (r.error === 'code_rate_limited') {
    const wait = Math.max(1, r.retry_after ?? 60);
    throw new AppError(429, 'RATE_LIMITED', message, { retry_after: wait }, { 'Retry-After': String(wait) });
  }
  const [status, code] = REDEEM_ERRORS[r.error ?? ''] ?? [400, 'BUSINESS_RULE'];
  throw new AppError(status, code, message);
}

// ---------- rutas: jugador ----------

const redeem = createRoute({
  method: 'post', path: '/api/v1/me/redeem', tags, security: bearer,
  middleware: [requireUser, rateLimit(RATE_RULES.redeem)] as const,
  summary: 'Canjear un código',
  description:
    'Da el premio del código (artículo, puntos, monedas VIP o VIP) y avisa a la cuenta. Errores en `error.code`: ' +
    '`CODE_INVALID` (no existe, revocado o todavía no empieza: cuenta como fallo), `CODE_EXPIRED`, `CODE_USED_UP`, ' +
    '`CODE_ALREADY_REDEEMED`, `CODE_NOT_FOR_YOU`, `CODE_ALREADY_OWNED` (no se gasta), `CODE_VIP_LIFETIME`, `CODE_NO_PLAYER`, ' +
    '`CODE_BANNED` y `RATE_LIMITED` (10 por minuto por IP, o 5 fallos en 15 minutos o 20 en 24 horas por cuenta; ' +
    '`Retry-After` y `details.retry_after` en segundos).',
  request: { body: { required: true, ...json(RedeemBody) } },
  responses: { 200: { description: 'Canjeado', ...json(RedeemResult) }, ...errorResponses(400, 401, 403, 404, 409, 429) },
});
const myRedemptions = createRoute({
  method: 'get', path: '/api/v1/me/redemptions', tags, security: bearer, middleware: [requireUser] as const,
  summary: 'Mis canjes', description: 'Lo más nuevo primero, sin el código entero (los últimos 4 caracteres).',
  responses: { 200: { description: 'Canjes', ...json(MyRedemptions) }, ...errorResponses(401) },
});

// ---------- rutas: admin ----------

const adminList = createRoute({
  method: 'get', path: '/api/v1/admin/codes', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Códigos', description: 'Con su estado calculado. Lo más nuevo primero.',
  request: { query: AdminCodeQuery },
  responses: { 200: { description: 'Códigos', ...json(AdminCodeList) }, ...errorResponses(400, 401, 403) },
});
const adminCreate = createRoute({
  method: 'post', path: '/api/v1/admin/codes', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Crear códigos', description: 'Uno o un lote (hasta 100) con el mismo premio; un personalizado, de a uno.',
  request: { body: { required: true, ...json(CodeCreate) } },
  responses: { 201: { description: 'Creados', ...json(CodeCreated) }, ...errorResponses(400, 401, 403) },
});
const adminAttempts = createRoute({
  method: 'get', path: '/api/v1/admin/codes/attempts', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Canjes fallidos y cuentas bloqueadas', request: { query: AttemptsQuery },
  responses: { 200: { description: 'Fallos', ...json(RedeemAttempts) }, ...errorResponses(400, 401, 403) },
});
const adminRedemptions = createRoute({
  method: 'get', path: '/api/v1/admin/codes/{id}/redemptions', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Canjes de un código', request: { params: CodeIdParam },
  responses: { 200: { description: 'Canjes', ...json(AdminRedemptionList) }, ...errorResponses(400, 401, 403) },
});
const adminRevoke = createRoute({
  method: 'post', path: '/api/v1/admin/codes/{id}/revoke', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Revocar un código', description: 'Deja de servir; lo ya canjeado sigue.',
  request: { params: CodeIdParam, body: { required: true, ...json(Reason) } },
  responses: { 204: { description: 'Revocado' }, ...errorResponses(400, 401, 403) },
});
const adminRevert = createRoute({
  method: 'post', path: '/api/v1/admin/redemptions/{id}/revert', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Revertir un canje',
  description:
    'Quita los puntos o las monedas (con una fila negativa), revoca el período VIP o quita el artículo (o sus días) si sigue ' +
    'siendo del código. El código recupera el uso; esa cuenta no lo puede volver a canjear. Avisa a la cuenta.',
  request: { params: IdParam, body: { required: true, ...json(Reason) } },
  responses: { 204: { description: 'Revertido' }, ...errorResponses(400, 401, 403) },
});

type AdminCodeRow = Omit<z.infer<typeof AdminCode>, 'prize'> & { reward: z.infer<typeof AdminCode>['prize']; total: number };

export const codes = createRouter()
  .openapi(redeem, async (c) => {
    const ip = clientIp(c);
    const r = mustHave(
      await c.var.sb.rpc('code_redeem' as never, { p_code: c.req.valid('json').code, p_ip: ip === 'unknown' ? null : ip } as never),
    ) as unknown as RedeemRow;
    return c.json(redeemOutcome(r), 200);
  })
  .openapi(myRedemptions, async (c) => {
    const items = mustHave(await c.var.sb.rpc('my_redemptions' as never)) as unknown as z.infer<typeof MyRedemptions>['items'];
    return c.json({ items }, 200);
  })
  .openapi(adminList, async (c) => {
    const p = c.req.valid('query');
    const rows = mustHave(
      await c.var.sb.rpc('admin_codes' as never, {
        p_q: p.q || null, p_state: p.state ?? null, p_limit: p.per, p_offset: (p.page - 1) * p.per,
      } as never),
    ) as unknown as AdminCodeRow[];
    const items = rows.map(({ reward, total: _t, ...r }) => ({ ...r, prize: reward }));
    return c.json({ items, total: rows[0]?.total ?? 0, page: p.page, per: p.per, sort: 'created_at', order: 'desc' as const }, 200);
  })
  .openapi(adminCreate, async (c) => {
    const b = c.req.valid('json');
    const r = mustHave(
      await c.var.sb.rpc('admin_code_create' as never, {
        p_reward: b.reward, p_item: b.item ?? null, p_amount: b.amount ?? null, p_days: b.days ?? null, p_max_uses: b.max_uses,
        p_count: b.count, p_starts_at: b.starts_at ?? null, p_expires_at: b.expires_at ?? null, p_for_user: b.for_user ?? null,
        p_custom: b.custom || null, p_label: b.label || null, p_note: b.note || null,
      } as never),
    ) as unknown as z.infer<typeof CodeCreated>;
    return c.json(r, 201);
  })
  .openapi(adminAttempts, async (c) => {
    const r = mustHave(await c.var.sb.rpc('admin_redeem_attempts' as never, { p_limit: c.req.valid('query').limit } as never));
    return c.json(r as unknown as z.infer<typeof RedeemAttempts>, 200);
  })
  .openapi(adminRedemptions, async (c) => {
    const items = mustHave(await c.var.sb.rpc('admin_code_redemptions' as never, { p_code: c.req.valid('param').id } as never));
    return c.json({ items: items as unknown as z.infer<typeof AdminRedemptionList>['items'] }, 200);
  })
  .openapi(adminRevoke, async (c) => {
    must(await c.var.sb.rpc('admin_code_revoke' as never, { p_code: c.req.valid('param').id, p_reason: c.req.valid('json').reason } as never));
    return c.body(null, 204);
  })
  .openapi(adminRevert, async (c) => {
    must(
      await c.var.sb.rpc('admin_redemption_revert' as never, { p_redemption: c.req.valid('param').id, p_reason: c.req.valid('json').reason } as never),
    );
    return c.body(null, 204);
  });

