import { createRoute, z } from '@hono/zod-openapi';
import { optionalUser, requireAdmin, requireUser } from '../lib/auth';
import { must } from '../lib/db';
import { createRouter } from '../lib/router';
import type { ImageShape } from '../lib/uploads';
import { bearer, errorResponses, json } from '../schemas/common';
import { dropPhoto, removePhoto, savePhoto } from '../services/photos';

// Imagen del panel de Iniciar sesión, Registro y Bienvenida (replanteo 67, bitácora 2026-11-03-imagen-login).
// La lee cualquiera (el login se ve sin sesión); la cambia un admin. Sin imagen, la web deja el panel gris.

export const AUTH_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
// La web la guarda en 1600×2000; se aceptan otras medidas 4:5 dentro del rango.
const AUTH_IMAGE_SHAPE: ImageShape = {
  what: 'La imagen del inicio de sesión',
  ratio: 0.8,
  tolerance: 0.03,
  shape: 'de proporción 4:5 (vertical)',
  min: [800, 1000],
  max: [3200, 4000],
};

const AuthImage = z.object({ url: z.string().nullable() }).openapi('AuthImage');
const ImageForm = z.object({ file: z.instanceof(File).openapi({ type: 'string', format: 'binary' }) });

const getImage = createRoute({
  method: 'get',
  path: '/api/v1/site/auth-image',
  tags: ['Sitio'],
  summary: 'Imagen del inicio de sesión',
  description: 'La URL de la imagen del panel de Iniciar sesión, Registro y Bienvenida, o null (panel gris). Pública.',
  middleware: [optionalUser] as const,
  responses: { 200: { description: 'Imagen', ...json(AuthImage) }, ...errorResponses(401) },
});

const putImage = createRoute({
  method: 'put',
  path: '/api/v1/admin/site/auth-image',
  tags: ['Sitio'],
  summary: 'Subir la imagen del inicio de sesión',
  description: 'JPG, PNG o WebP de proporción 4:5, entre 800×1000 y 3200×4000 y hasta 4 MB. Reemplaza la anterior y la borra del bucket.',
  security: bearer,
  middleware: [requireUser, requireAdmin] as const,
  request: { body: { required: true, content: { 'multipart/form-data': { schema: ImageForm } } } },
  responses: { 200: { description: 'Imagen nueva', ...json(AuthImage) }, ...errorResponses(400, 401, 403, 413) },
});

const deleteImage = createRoute({
  method: 'delete',
  path: '/api/v1/admin/site/auth-image',
  tags: ['Sitio'],
  summary: 'Quitar la imagen del inicio de sesión',
  description: 'El panel vuelve a quedar gris. Borra el archivo del bucket.',
  security: bearer,
  middleware: [requireUser, requireAdmin] as const,
  responses: { 200: { description: 'Sin imagen', ...json(AuthImage) }, ...errorResponses(401, 403) },
});

export const site = createRouter()
  .openapi(getImage, async (c) => {
    const url = must(await c.var.sb.rpc('site_auth_image' as never)) as string | null;
    return c.json({ url: url ?? null }, 200);
  })
  .openapi(putImage, async (c) => {
    const { file } = c.req.valid('form') as { file: File };
    const { url, path } = await savePhoto(c, 'site', file, AUTH_IMAGE_MAX_BYTES, AUTH_IMAGE_SHAPE);
    let old: unknown;
    try {
      old = must(await c.var.sb.rpc('site_admin_set_auth_image' as never, { p_url: url } as never));
    } catch (e) {
      await dropPhoto(c, path);
      throw e;
    }
    removePhoto(c, typeof old === 'string' ? old : null);
    return c.json({ url }, 200);
  })
  .openapi(deleteImage, async (c) => {
    const old = must(await c.var.sb.rpc('site_admin_set_auth_image' as never, { p_url: null } as never));
    removePhoto(c, typeof old === 'string' ? old : null);
    return c.json({ url: null }, 200);
  });
