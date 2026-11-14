import { createRoute } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { z } from '@hono/zod-openapi';
import { requireAdmin, requireModerator, requireUser } from '../lib/auth';
import { inBackground } from '../lib/background';
import { must, mustHave, notFound } from '../lib/db';
import { AppError } from '../lib/errors';
import { envelope } from '../lib/list';
import { ANIMATED_MAX_BYTES, ANIMATED_MAX_SECONDS, parseCrop, readAnimated } from '../lib/media';
import { createRouter } from '../lib/router';
import { serviceClient, type Db } from '../lib/supabase';
import type { AppEnv } from '../lib/types';
import { checkShape, readImage, storageError, type ImageShape } from '../lib/uploads';
import { IdParam } from '../schemas/admin';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  AdminCustom,
  CUSTOM_AVATAR_HELP,
  CUSTOM_BG_HELP,
  CustomIdParam,
  CustomKindParam,
  CustomMedia,
  CustomResult,
  CustomUpload,
  MediaReportBody,
  MediaReportList,
  MediaReportQuery,
  MediaReportResolve,
  MyCustom,
  Reason,
  type MediaReport,
} from '../schemas/shop';
import { userExists, vipStatusOf } from '../services/vip';
import { readConfig, readPoints } from './shop';

// Lo propio (bitácora docs/bitacora/2026-11-13-avatar-y-fondo-propios, replanteo 113): cada jugador sube su fondo fijo
// (puntos) y, siendo VIP, su avatar y su fondo animados (monedas VIP), y paga cada vez. La API convierte lo animado con
// ffmpeg (solo en Node) y guarda los archivos en el bucket cosmetics; la base cobra, guarda y se lo pone
// (custom_cosmetic_set). Lo subido queda guardado, hasta un tope por tipo (bitácora 2026-11-14-inventario-de-lo-propio):
// ponerse uno guardado es PUT /me/cosmetics con `custom:<id>`. Las denuncias de imágenes del perfil (avatar, fondo y
// portada) las resuelven moderadores y admins.

type C = Context<AppEnv>;
type Kind = 'avatar' | 'background';
const tags = ['Tienda'];

const BUCKET = 'cosmetics';
const MARKER = `/storage/v1/object/public/${BUCKET}/`;
/** El fondo de miniperfil fijo, recortado en la web con la proporción de la tarjeta del grupo en Jugar (1:2, vertical). */
const STATIC_BG_MAX_BYTES = 2 * 1024 * 1024;
const BG_SHAPE: ImageShape = {
  what: 'El fondo de miniperfil', ratio: 0.5, tolerance: 0.05, shape: 'de proporción 1:2 (vertical)', min: [240, 480], max: [960, 1920],
};
/** Tamaño final de lo animado. */
const SIZE: Record<Kind, { width: number; height: number }> = { avatar: { width: 256, height: 256 }, background: { width: 256, height: 512 } };

// ---------- rutas: la cuenta ----------

const uploadLimit = bodyLimit({
  maxSize: ANIMATED_MAX_BYTES + 64 * 1024,
  onError: () => {
    throw new AppError(413, 'FILE_TOO_LARGE', `El archivo pesa más de ${ANIMATED_MAX_BYTES / 1024 / 1024} MB.`);
  },
});
const myCustom = createRoute({
  method: 'get', path: '/api/v1/me/custom', tags, security: bearer, middleware: [requireUser] as const,
  summary: 'Mis avatares y fondos de miniperfil propios',
  description: 'Lo subido y guardado (con cuál está puesto), los topes, los precios de hoy y si se pueden subir animaciones.',
  responses: { 200: { description: 'Lo propio', ...json(MyCustom) }, ...errorResponses(401) },
});
const upload = createRoute({
  method: 'post', path: '/api/v1/me/custom/{kind}', tags, security: bearer, middleware: [requireUser, uploadLimit] as const,
  summary: 'Subir un avatar o un fondo de miniperfil',
  description:
    '`multipart/form-data`. Cobra cada vez, lo guarda (los anteriores siguen guardados) y se lo pone. Si ya guarda el tope de ese ' +
    `tipo, \`BUSINESS_RULE\` sin cobrar. Avatar: ${CUSTOM_AVATAR_HELP} Fondo: ${CUSTOM_BG_HELP} ` +
    'Lo animado es para los VIP y se paga con monedas VIP; el fondo fijo, con puntos. Si el precio cambió, no alcanza el saldo o ' +
    'falta el VIP: `BUSINESS_RULE` o `VIP_REQUIRED`, sin cobrar. Sin ffmpeg en el servidor, lo animado responde `NOT_AVAILABLE`.',
  request: {
    params: CustomKindParam,
    body: { required: true, content: { 'multipart/form-data': { schema: CustomUpload } } },
  },
  responses: { 200: { description: 'Subido y puesto', ...json(CustomResult) }, ...errorResponses(400, 401, 403, 413, 501) },
});
const deleteCustom = createRoute({
  method: 'delete', path: '/api/v1/me/custom/items/{cid}', tags, security: bearer, middleware: [requireUser] as const,
  summary: 'Borrar una subida guardada', description: 'Puesta o no. Se borra el archivo. No devuelve lo pagado.',
  request: { params: CustomIdParam },
  responses: { 200: { description: 'Lo propio', ...json(MyCustom) }, ...errorResponses(400, 401, 404) },
});
const report = createRoute({
  method: 'post', path: '/api/v1/players/{id}/media-reports', tags: ['Comunidad'], security: bearer, middleware: [requireUser] as const,
  summary: 'Denunciar una imagen del perfil',
  description: 'El avatar o el fondo propios, o la portada, tal como se ven hoy. Una vez por imagen y hasta 20 denuncias por día.',
  request: { params: IdParam, body: { required: true, ...json(MediaReportBody) } },
  responses: { 204: { description: 'Denunciada' }, ...errorResponses(400, 401, 404) },
});

// ---------- rutas: moderación y admin ----------

const reports = createRoute({
  method: 'get', path: '/api/v1/admin/profile-media-reports', tags: ['Admin'], security: bearer, middleware: [requireUser, requireModerator] as const,
  summary: 'Imágenes denunciadas', description: 'Moderadores y admins. La base pagina, filtra y ordena.',
  request: { query: MediaReportQuery },
  responses: { 200: { description: 'Denuncias', ...json(MediaReportList) }, ...errorResponses(400, 401, 403) },
});
const resolve = createRoute({
  method: 'post', path: '/api/v1/admin/profile-media-reports/{id}/resolve', tags: ['Admin'], security: bearer,
  middleware: [requireUser, requireModerator] as const,
  summary: 'Resolver una denuncia de una imagen',
  description:
    'Cierra todas las denuncias abiertas de esa imagen. Con `remove`, la saca del perfil (si sigue puesta), borra el archivo y avisa ' +
    'al dueño con el motivo. No devuelve lo pagado.',
  request: { params: IdParam, body: { required: true, ...json(MediaReportResolve) } },
  responses: { 204: { description: 'Resuelta' }, ...errorResponses(400, 401, 403, 404) },
});
const adminCustom = createRoute({
  method: 'get', path: '/api/v1/admin/users/{id}/custom', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Avatares y fondos de miniperfil propios de una cuenta', description: 'Todo lo guardado, con cuál está puesto.',
  request: { params: IdParam },
  responses: { 200: { description: 'Lo propio', ...json(AdminCustom) }, ...errorResponses(401, 403, 404) },
});
const adminClear = createRoute({
  method: 'post', path: '/api/v1/admin/users/{id}/custom/items/{cid}/clear', tags: ['Admin'], security: bearer,
  middleware: [requireUser, requireAdmin] as const,
  summary: 'Sacar una subida propia de una cuenta',
  description:
    'Puesta o no, con motivo. Borra el archivo, cierra sus denuncias y avisa a la cuenta. Las demás guardadas siguen. No devuelve lo pagado.',
  request: { params: IdParam.extend(CustomIdParam.shape), body: { required: true, ...json(Reason) } },
  responses: { 204: { description: 'Sacado' }, ...errorResponses(400, 401, 403, 404) },
});

// ---------- ayudas ----------

type CustomRow = {
  id: string; kind: string; animated: boolean; url: string; poster_url: string | null; price: number; currency: string; created_at: string;
};
const CUSTOM_FIELDS = 'id, kind, animated, url, poster_url, price, currency, created_at';

/** Lo propio guardado de una cuenta, lo más nuevo primero (el dueño o un admin, por la RLS). */
async function readCustom(sb: Db, uid: string) {
  const [rows, eq, vip] = await Promise.all([
    sb.from('custom_cosmetics').select(CUSTOM_FIELDS).eq('user_id', uid).is('cleared_at', null)
      .order('created_at', { ascending: false }).then(mustHave),
    sb.from('user_cosmetics').select('avatar_custom, background_custom').eq('user_id', uid).maybeSingle().then(must),
    vipStatusOf(sb, [uid]).then((m) => !!m.get(uid)?.active),
  ]);
  const worn = new Set([eq?.avatar_custom, eq?.background_custom].filter(Boolean));
  const list = (kind: Kind): z.infer<typeof CustomMedia>[] =>
    (rows as CustomRow[])
      .filter((r) => r.kind === kind)
      .map((r) => ({
        id: r.id, kind, animated: r.animated, url: r.url, poster_url: r.poster_url, price: r.price,
        currency: r.currency as 'points' | 'vip', created_at: r.created_at, equipped: worn.has(r.id), visible: !r.animated || vip,
      }));
  return { avatar: list('avatar'), background: list('background') };
}

/** ¿Ya guarda el tope de ese tipo? */
async function atLimit(sb: Db, uid: string, kind: Kind, max: number) {
  const r = await sb.from('custom_cosmetics').select('id', { count: 'exact', head: true })
    .eq('user_id', uid).eq('kind', kind).is('cleared_at', null);
  must(r);
  return (r.count ?? 0) >= max;
}

async function readMine(c: C) {
  const [mine, cfg, available] = await Promise.all([
    readCustom(c.var.sb, c.var.user.id),
    readConfig(c),
    c.var.media ? c.var.media.available() : Promise.resolve(false),
  ]);
  return {
    ...mine,
    max: { avatar: cfg.custom_max_avatar, background: cfg.custom_max_background },
    prices: { avatar: cfg.custom_avatar_price, background_animated: cfg.custom_bg_animated_price, background_static: cfg.custom_bg_static_price },
    animated_available: available,
  };
}

/** Borra del bucket cosmetics los archivos que ya no se usan, sin demorar la respuesta. */
function dropFiles(c: C, urls: (string | null | undefined)[], sb: Db | null = c.var.sb) {
  const paths = urls
    .filter((u): u is string => !!u?.includes(MARKER))
    .map((u) => decodeURIComponent(u.split(MARKER)[1]!.split('?')[0]!));
  if (!paths.length || !sb) return;
  inBackground(
    c,
    sb.storage.from(BUCKET).remove(paths).then((r) => {
      if (r.error) throw new Error(`borrar ${paths.join(', ')}: ${r.error.message}`);
    }),
  );
}

type Files = { url: string | null; poster_url: string | null };

// ---------- router ----------

export const custom = createRouter()
  .openapi(myCustom, async (c) => c.json(await readMine(c), 200))
  .openapi(upload, async (c) => {
    const { sb, user: u } = c.var;
    const kind = c.req.valid('param').kind;
    const form = c.req.valid('form');
    const animated = kind === 'avatar' ? true : form.animated;

    // Antes de convertir (es lo caro): tope, precio, VIP y saldo. La base lo vuelve a revisar al cobrar, con el lock por cuenta.
    const [cfg, pts] = await Promise.all([readConfig(c), readPoints(c)]);
    const price = kind === 'avatar' ? cfg.custom_avatar_price : animated ? cfg.custom_bg_animated_price : cfg.custom_bg_static_price;
    if (!pts.has_player) throw new AppError(400, 'BUSINESS_RULE', 'Necesitas tu ficha de jugador vinculada para usar la tienda');
    const max = kind === 'avatar' ? cfg.custom_max_avatar : cfg.custom_max_background;
    if (await atLimit(sb, u.id, kind, max)) {
      throw new AppError(
        400, 'BUSINESS_RULE', `Llegaste a ${max} ${kind === 'avatar' ? 'avatares' : 'fondos de miniperfil'} guardados: borra uno para subir otro`,
      );
    }
    if (animated && !pts.vip) throw new AppError(403, 'VIP_REQUIRED', 'El avatar y el fondo animados propios son para los VIP');
    if (form.price !== price) throw new AppError(400, 'BUSINESS_RULE', `El precio cambió: ahora cuesta ${price}`);
    const balance = animated ? pts.vip_coins.balance : pts.points.balance;
    if (balance < price) {
      throw new AppError(400, 'BUSINESS_RULE', `Te faltan ${price - balance} ${animated ? 'monedas VIP' : 'puntos'}`);
    }

    // Los archivos: <uid>/<tipo>-<hora>.webm y .webp (animado) o la imagen recortada (fijo).
    const stamp = `${u.id}/${kind}-${Date.now()}`;
    let files: { path: string; bytes: Uint8Array; mime: string }[];
    if (animated) {
      if (!c.var.media || !(await c.var.media.available())) {
        throw new AppError(501, 'NOT_AVAILABLE', 'La subida de animaciones no está disponible por ahora. No se te cobró nada.');
      }
      const { bytes, type } = await readAnimated(form.file);
      const out = await c.var.media.animate(bytes, type, { ...SIZE[kind], crop: parseCrop(form), maxSeconds: ANIMATED_MAX_SECONDS });
      files = [
        { path: `${stamp}.webm`, bytes: out.video, mime: 'video/webm' },
        { path: `${stamp}.webp`, bytes: out.poster, mime: 'image/webp' },
      ];
    } else {
      const { bytes, type } = await readImage(form.file, STATIC_BG_MAX_BYTES);
      checkShape(bytes, type, BG_SHAPE);
      files = [{ path: `${stamp}.${type.ext}`, bytes, mime: type.mime }];
    }

    // La política de Storage solo deja escribir en la carpeta <uid>/ del propio usuario.
    const bucket = sb.storage.from(BUCKET);
    const done: string[] = [];
    for (const f of files) {
      const up = await bucket.upload(f.path, f.bytes, { contentType: f.mime, upsert: false });
      if (up.error) {
        if (done.length) await bucket.remove(done);
        throw storageError(up.error);
      }
      done.push(f.path);
    }
    const [url, poster] = done.map((p) => bucket.getPublicUrl(p).data.publicUrl);
    const res = await sb.rpc('custom_cosmetic_set', {
      p_kind: kind, p_animated: animated, p_url: url!, p_poster: animated ? poster! : (null as unknown as string), p_price: form.price,
    });
    if (res.error) {
      await bucket.remove(done);
      must(res);
    }
    // Lo anterior queda guardado: no se borra ningún archivo.
    const r = res.data as { id: string; price_paid: number; currency: 'points' | 'vip'; balance: number };
    return c.json({ ...(await readMine(c)), id: r.id, price_paid: r.price_paid, currency: r.currency, balance: r.balance }, 200);
  })
  .openapi(deleteCustom, async (c) => {
    const r = mustHave(await c.var.sb.rpc('custom_cosmetic_delete', { p_id: c.req.valid('param').cid })) as unknown as Files;
    dropFiles(c, [r.url, r.poster_url]);
    return c.json(await readMine(c), 200);
  })
  .openapi(report, async (c) => {
    const b = c.req.valid('json');
    must(
      await c.var.sb.rpc('profile_media_report', {
        p_player: c.req.valid('param').id, p_kind: b.kind, p_reason: b.reason, p_note: (b.note ?? null) as unknown as string,
      }),
    );
    return c.body(null, 204);
  })
  .openapi(reports, async (c) => {
    const p = c.req.valid('query');
    const res = mustHave(
      await c.var.sb.rpc('profile_media_reports_admin', {
        p_status: (p.status === 'all' ? null : p.status) as unknown as string,
        p_kind: (p.kind ?? null) as unknown as string,
        p_reason: (p.reason ?? null) as unknown as string,
        p_order: p.order,
        p_limit: p.per,
        p_offset: (p.page - 1) * p.per,
      }),
    ) as unknown as { total: number; items: z.infer<typeof MediaReport>[] };
    return c.json(envelope(res.items, res.total, p), 200);
  })
  .openapi(resolve, async (c) => {
    const r = mustHave(
      await c.var.sb.rpc('profile_media_report_resolve', { p_report: c.req.valid('param').id, p_action: c.req.valid('json').action }),
    ) as unknown as Files;
    // Los archivos son de la carpeta del dueño: solo la clave de servicio los puede borrar. Sin ella, quedan en el bucket.
    const service = serviceClient(c.var.config);
    if (r.url?.includes('/storage/v1/object/public/avatars/')) {
      // La portada está en el bucket avatars (la sube /me/cover).
      const path = decodeURIComponent(r.url.split('/storage/v1/object/public/avatars/')[1]!.split('?')[0]!);
      if (service) inBackground(c, service.storage.from('avatars').remove([path]).then(() => undefined));
    } else dropFiles(c, [r.url, r.poster_url], service);
    return c.body(null, 204);
  })
  .openapi(adminCustom, async (c) => {
    const id = c.req.valid('param').id;
    if (!(await userExists(c.var.sb, id))) throw notFound('ese usuario');
    return c.json(await readCustom(c.var.sb, id), 200);
  })
  .openapi(adminClear, async (c) => {
    const { id, cid } = c.req.valid('param');
    if (!(await userExists(c.var.sb, id))) throw notFound('ese usuario');
    const r = mustHave(
      await c.var.sb.rpc('admin_custom_clear', { p_user: id, p_id: cid, p_reason: c.req.valid('json').reason }),
    ) as unknown as Files;
    dropFiles(c, [r.url, r.poster_url], serviceClient(c.var.config));
    return c.body(null, 204);
  });
