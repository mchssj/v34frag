import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { optionalUser, requireSupport, requireUser } from '../lib/auth';
import { must } from '../lib/db';
import { Envelope, envelope, listQuery } from '../lib/list';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { bearer, errorResponses, json } from '../schemas/common';

// Tierlists de jugadores y equipos (replanteo 137, bitácora docs/bitacora/2026-11-22-tierlists-jugadores-equipos). Las
// reglas (topes, dueño, dos niveles de comentarios, me gusta, copiar, denuncias) las aplica la base.

type C = Context<AppEnv>;
const rpc = async (c: C, fn: string, args: Record<string, unknown> = {}) =>
  must(await c.var.sb.rpc(fn as never, args as never)) as unknown;

const Id = z.uuid();
const IdParam = z.object({ id: Id.openapi({ param: { name: 'id', in: 'path' } }) });
const Kind = z.enum(['players', 'teams']).openapi({ description: '`players` (jugadores) o `teams` (equipos)' });
const Name = z.string().trim().min(1).max(40);

const Author = z
  .object({
    player_id: Id,
    nick: z.string(),
    photo_url: z.string().nullable(),
    level: z.number().int(),
    verified: z.enum(['gray', 'gold']).nullable(),
  });
// Sin nombre en la OpenAPI: un esquema con nombre y nullable sale como allOf y openapi-typescript lo tipa mal.

export const TierlistSummary = z
  .object({
    id: Id,
    name: z.string(),
    kind: Kind,
    featured: z.boolean(),
    updated_at: z.string(),
    likes: z.number().int(),
    comments: z.number().int().openapi({ description: 'Comentarios visibles (0 si están cerrados)' }),
    items: z.number().int(),
  })
  .openapi('TierlistSummary');
export const TierlistsOf = z
  .object({
    is_owner: z.boolean(),
    limit: z.number().int().openapi({ description: 'Tope de tierlists por cuenta (10)' }),
    count: z.number().int().openapi({ description: 'Cuántas tiene la cuenta que consulta' }),
    items: z.array(TierlistSummary).openapi({ description: 'La destacada primero y después la última editada' }),
  })
  .openapi('TierlistsOf');

const Item = z
  .object({
    kind: z.enum(['player', 'team', 'external']),
    id: Id.nullable().openapi({ description: 'La ficha o el equipo; null si es externo' }),
    name: z.string().openapi({ description: 'Nick, nombre del equipo o nombre externo, al día' }),
    tag: z.string().nullable(),
    image_url: z.string().nullable(),
  })
  .openapi('TierlistItem');
export const Tierlist = z
  .object({
    id: Id,
    name: z.string(),
    kind: Kind,
    featured: z.boolean(),
    comments_open: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
    owner: Author,
    copied_from: z.object({ id: Id, name: z.string(), nick: z.string() }).nullable().openapi({ description: 'La original, si es una copia y sigue existiendo' }),
    likes: z.number().int(),
    liked: z.boolean(),
    is_owner: z.boolean(),
    can_like: z.boolean(),
    can_copy: z.boolean().openapi({ description: 'Con sesión y ficha, no es la propia y no llegó al tope de 10' }),
    can_comment: z.boolean(),
    can_report: z.boolean(),
    restriction: z.enum(['banned', 'blocked']).nullable(),
    tiers: z.array(z.object({ id: Id, label: z.string(), items: z.array(Item) })),
    bank: z.array(Item).openapi({ description: 'Los ítems que no están en ningún tier' }),
  })
  .openapi('Tierlist');

const Comment = z
  .object({
    id: Id,
    deleted: z.boolean().openapi({ description: 'Borrado pero con respuestas: sin texto ni autor' }),
    body: z.string().nullable(),
    created_at: z.string(),
    author: Author.nullable(),
    mine: z.boolean(),
    can_report: z.boolean(),
    can_delete: z.boolean(),
  })
  .openapi('TierlistComment');
export const TierlistComments = z
  .object({
    total: z.number().int().openapi({ description: 'Comentarios y respuestas visibles' }),
    threads: z.number().int().openapi({ description: 'Comentarios (sin las respuestas) que se paginan, para "Ver más"' }),
    items: z.array(Comment.extend({ replies: z.array(Comment) })).openapi({ description: 'Los más nuevos primero, 20 por página, con todas sus respuestas' }),
  })
  .openapi('TierlistComments');

const SaveItem = z
  .union([z.object({ player: Id }), z.object({ team: Id }), z.object({ name: Name })])
  .openapi('TierlistSaveItem', { description: '`{player}` en una de jugadores, `{team}` en una de equipos o `{name}` (externo) en las dos' });
const Save = z
  .object({
    name: Name,
    tiers: z.array(z.object({ label: Name, items: z.array(SaveItem) })).min(1).max(10),
    bank: z.array(SaveItem),
  })
  .openapi('TierlistSave');
const Create = z.object({ name: Name, kind: Kind }).openapi('TierlistCreate');
const Flag = z.object({ on: z.boolean() }).openapi('TierlistFlag');
const Open = z.object({ open: z.boolean() }).openapi('TierlistCommentsOpen');
const NewComment = z
  .object({ body: z.string().min(1).max(280), parent_id: Id.optional().openapi({ description: 'Para responder un comentario (no una respuesta)' }) })
  .openapi('TierlistNewComment');
const REASONS = ['toxic', 'spam', 'harassment', 'other'] as const;
const ReportBody = z
  .object({
    reason: z.enum(REASONS),
    note: z.string().trim().max(300).optional(),
    comment_id: Id.optional().openapi({ description: 'Para denunciar un comentario; sin esto, la tierlist' }),
  })
  .openapi('TierlistReportBody');
const Created = z.object({ id: Id }).openapi('TierlistCreated');

const Ref = z.object({ id: Id, alias: z.string() });
const Report = z
  .object({
    id: Id,
    target: z.enum(['tierlist', 'comment']),
    reason: z.enum(REASONS),
    note: z.string().nullable(),
    created_at: z.string(),
    status: z.enum(['open', 'dismissed', 'removed']),
    resolved_at: z.string().nullable(),
    resolved_by: Ref.nullable(),
    reporter: Ref.nullable(),
    reports: z.number().int(),
    tierlist_id: Id.nullable().openapi({ description: 'null si la tierlist se borró' }),
    tierlist_name: z.string().nullable(),
    text: z.string().openapi({ description: 'El nombre de la tierlist o el comentario, como estaba al denunciarlo' }),
    removed: z.boolean().openapi({ description: 'Si ya se borró lo denunciado' }),
    author: Ref.nullable(),
  })
  .openapi('TierlistReport');
const ReportQuery = listQuery(['created_at'], { sort: 'created_at', order: 'desc' }).extend({
  status: z.enum(['open', 'resolved', 'all']).default('open'),
  reason: z.enum(REASONS).optional(),
});
const Resolve = z.object({ action: z.enum(['dismiss', 'delete']) }).openapi('TierlistReportResolve');
const CommentsQuery = z.object({ before: z.string().datetime({ offset: true }).optional() });

const T = ['Tierlists'];

const ofPlayer = createRoute({
  method: 'get', path: '/api/v1/players/{id}/tierlists', tags: T, middleware: [optionalUser] as const,
  summary: 'Las tierlists de un jugador', description: 'También sin sesión.',
  request: { params: IdParam },
  responses: { 200: { description: 'Tierlists', ...json(TierlistsOf) }, ...errorResponses(400, 401, 404) },
});
const get = createRoute({
  method: 'get', path: '/api/v1/tierlists/{id}', tags: T, middleware: [optionalUser] as const,
  summary: 'Una tierlist', description: 'También sin sesión. Los `can_*` dependen de quién consulta.',
  request: { params: IdParam },
  responses: { 200: { description: 'Tierlist', ...json(Tierlist) }, ...errorResponses(400, 401, 404) },
});
const create = createRoute({
  method: 'post', path: '/api/v1/tierlists', tags: T, security: bearer, middleware: [requireUser] as const,
  summary: 'Crear una tierlist', description: 'Con ficha. Trae los tiers S, A, B, C y D. Hasta 10 por cuenta (`400`).',
  request: { body: { required: true, ...json(Create) } },
  responses: { 201: { description: 'Creada', ...json(Created) }, ...errorResponses(400, 401, 403) },
});
const save = createRoute({
  method: 'put', path: '/api/v1/tierlists/{id}', tags: T, security: bearer, middleware: [requireUser] as const,
  summary: 'Guardar una tierlist', description: 'Solo el dueño. Reemplaza el nombre, los tiers y los ítems. Hasta 10 tiers y 100 ítems.',
  request: { params: IdParam, body: { required: true, ...json(Save) } },
  responses: { 200: { description: 'Tierlist', ...json(Tierlist) }, ...errorResponses(400, 401, 403, 404) },
});
const remove = createRoute({
  method: 'delete', path: '/api/v1/tierlists/{id}', tags: T, security: bearer, middleware: [requireUser] as const,
  summary: 'Borrar una tierlist', description: 'Solo el dueño. Se van sus comentarios y me gusta.',
  request: { params: IdParam },
  responses: { 204: { description: 'Borrada' }, ...errorResponses(400, 401, 403, 404) },
});
const feature = createRoute({
  method: 'put', path: '/api/v1/tierlists/{id}/featured', tags: T, security: bearer, middleware: [requireUser] as const,
  summary: 'Destacar una tierlist', description: 'Solo el dueño. Una destacada por perfil: la anterior deja de estarlo.',
  request: { params: IdParam, body: { required: true, ...json(Flag) } },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401, 403, 404) },
});
const commentsOpen = createRoute({
  method: 'put', path: '/api/v1/tierlists/{id}/comments-open', tags: T, security: bearer, middleware: [requireUser] as const,
  summary: 'Abrir o cerrar los comentarios', description: 'Solo el dueño. Cerrados, no se ven ni se dejan.',
  request: { params: IdParam, body: { required: true, ...json(Open) } },
  responses: { 204: { description: 'Hecho' }, ...errorResponses(400, 401, 403, 404) },
});
const like = createRoute({
  method: 'put', path: '/api/v1/tierlists/{id}/like', tags: T, security: bearer, middleware: [requireUser] as const,
  summary: 'Me gusta', description: '`on: false` lo saca. No a la propia.',
  request: { params: IdParam, body: { required: true, ...json(Flag) } },
  responses: { 200: { description: 'Tierlist', ...json(Tierlist) }, ...errorResponses(400, 401, 403, 404) },
});
const copy = createRoute({
  method: 'post', path: '/api/v1/tierlists/{id}/copy', tags: T, security: bearer, middleware: [requireUser] as const,
  summary: 'Copiar una tierlist ajena', description: 'Con tiers e ítems, sin comentarios ni me gusta. Cuenta para el tope de 10.',
  request: { params: IdParam },
  responses: { 201: { description: 'La copia', ...json(Created) }, ...errorResponses(400, 401, 403, 404) },
});
const comments = createRoute({
  method: 'get', path: '/api/v1/tierlists/{id}/comments', tags: T, middleware: [optionalUser] as const,
  summary: 'Comentarios de una tierlist', description: 'También sin sesión. Vacía si están cerrados.',
  request: { params: IdParam, query: CommentsQuery },
  responses: { 200: { description: 'Comentarios', ...json(TierlistComments) }, ...errorResponses(400, 401, 404) },
});
const addComment = createRoute({
  method: 'post', path: '/api/v1/tierlists/{id}/comments', tags: T, security: bearer, middleware: [requireUser] as const,
  summary: 'Comentar o responder',
  description: 'Hasta 280 caracteres, 30 segundos entre comentarios y 30 por día (`400`). Una respuesta no se responde (`400`).',
  request: { params: IdParam, body: { required: true, ...json(NewComment) } },
  responses: { 200: { description: 'Comentarios', ...json(TierlistComments) }, ...errorResponses(400, 401, 403, 404) },
});
const deleteComment = createRoute({
  method: 'delete', path: '/api/v1/tierlist-comments/{id}', tags: T, security: bearer, middleware: [requireUser] as const,
  summary: 'Borrar un comentario', description: 'El autor, el dueño de la tierlist, soporte, moderadores y admins.',
  request: { params: IdParam },
  responses: { 204: { description: 'Borrado' }, ...errorResponses(400, 401, 403, 404) },
});
const report = createRoute({
  method: 'post', path: '/api/v1/tierlists/{id}/report', tags: T, security: bearer, middleware: [requireUser] as const,
  summary: 'Denunciar una tierlist o un comentario', description: 'Ajenos, una vez por cuenta; 20 denuncias por día.',
  request: { params: IdParam, body: { required: true, ...json(ReportBody) } },
  responses: { 204: { description: 'Denunciada' }, ...errorResponses(400, 401, 404) },
});
const reports = createRoute({
  method: 'get', path: '/api/v1/admin/tierlist-reports', tags: ['Admin'], security: bearer, middleware: [requireUser, requireSupport] as const,
  summary: 'Tierlists y comentarios de tierlists denunciados', description: 'Soporte, moderadores y admins.',
  request: { query: ReportQuery },
  responses: { 200: { description: 'Denuncias', ...json(Envelope(Report).openapi('TierlistReportList')) }, ...errorResponses(400, 401, 403) },
});
const resolve = createRoute({
  method: 'post', path: '/api/v1/admin/tierlist-reports/{id}/resolve', tags: ['Admin'], security: bearer, middleware: [requireUser, requireSupport] as const,
  summary: 'Resolver una denuncia de tierlist',
  description: 'Cierra las abiertas de lo mismo. `delete` borra el comentario (queda guardado) o la tierlist entera.',
  request: { params: IdParam, body: { required: true, ...json(Resolve) } },
  responses: { 204: { description: 'Resuelta' }, ...errorResponses(400, 401, 403, 404) },
});

const tierlistOf = async (c: C, id: string) => c.json((await rpc(c, 'tierlist_get', { p_id: id })) as z.infer<typeof Tierlist>, 200);
const commentsOf = async (c: C, id: string, before: string | null = null) =>
  c.json((await rpc(c, 'tierlist_comments_list', { p_id: id, p_before: before })) as z.infer<typeof TierlistComments>, 200);

export const tierlists = createRouter()
  .openapi(ofPlayer, async (c) =>
    c.json((await rpc(c, 'tierlists_of', { p_player: c.req.valid('param').id })) as z.infer<typeof TierlistsOf>, 200))
  .openapi(get, async (c) => tierlistOf(c, c.req.valid('param').id))
  .openapi(create, async (c) => {
    const { name, kind } = c.req.valid('json');
    return c.json({ id: (await rpc(c, 'tierlist_create', { p_name: name, p_kind: kind })) as string }, 201);
  })
  .openapi(save, async (c) => {
    const { id } = c.req.valid('param');
    await rpc(c, 'tierlist_save', { p_id: id, p_data: c.req.valid('json') });
    return tierlistOf(c, id);
  })
  .openapi(remove, async (c) => {
    await rpc(c, 'tierlist_delete', { p_id: c.req.valid('param').id });
    return c.body(null, 204);
  })
  .openapi(feature, async (c) => {
    await rpc(c, 'tierlist_feature', { p_id: c.req.valid('param').id, p_on: c.req.valid('json').on });
    return c.body(null, 204);
  })
  .openapi(commentsOpen, async (c) => {
    await rpc(c, 'tierlist_comments_set', { p_id: c.req.valid('param').id, p_open: c.req.valid('json').open });
    return c.body(null, 204);
  })
  .openapi(like, async (c) => {
    const { id } = c.req.valid('param');
    await rpc(c, 'tierlist_like', { p_id: id, p_on: c.req.valid('json').on });
    return tierlistOf(c, id);
  })
  .openapi(copy, async (c) => c.json({ id: (await rpc(c, 'tierlist_copy', { p_id: c.req.valid('param').id })) as string }, 201))
  .openapi(comments, async (c) => commentsOf(c, c.req.valid('param').id, c.req.valid('query').before ?? null))
  .openapi(addComment, async (c) => {
    const { id } = c.req.valid('param');
    const { body, parent_id } = c.req.valid('json');
    await rpc(c, 'tierlist_comment_add', { p_id: id, p_body: body, p_parent: parent_id ?? null });
    return commentsOf(c, id);
  })
  .openapi(deleteComment, async (c) => {
    await rpc(c, 'tierlist_comment_delete', { p_id: c.req.valid('param').id });
    return c.body(null, 204);
  })
  .openapi(report, async (c) => {
    const { reason, note, comment_id } = c.req.valid('json');
    await rpc(c, 'tierlist_report', { p_id: c.req.valid('param').id, p_comment: comment_id ?? null, p_reason: reason, p_note: note ?? null });
    return c.body(null, 204);
  })
  .openapi(reports, async (c) => {
    const p = c.req.valid('query');
    const res = (await rpc(c, 'tierlist_reports_admin', {
      p_status: p.status === 'all' ? null : p.status,
      p_reason: p.reason ?? null,
      p_order: p.order,
      p_limit: p.per,
      p_offset: (p.page - 1) * p.per,
    })) as { total: number; items: z.infer<typeof Report>[] };
    return c.json(envelope(res.items, res.total, p), 200);
  })
  .openapi(resolve, async (c) => {
    await rpc(c, 'tierlist_report_resolve', { p_report: c.req.valid('param').id, p_action: c.req.valid('json').action });
    return c.body(null, 204);
  });
