import { createRoute, z } from '@hono/zod-openapi';
import { AppError } from '../lib/errors';
import { requireUser, userRole } from '../lib/auth';
import { aplicarMarcadores, imagenPara, indiceDe, paginaPara, SECCIONES, type ManualValores } from '../lib/manual';
import type { AppEnv } from '../lib/types';
import type { Context } from 'hono';
import { createRouter } from '../lib/router';
import { bearer, errorResponses, json } from '../schemas/common';

// Manual de usuario (plan docs/bitacora/2026-11-02-manual-usuario). Solo con sesión, y cada cuenta recibe solo las
// secciones de su rol (lib/manual.ts). Lo que no puede ver responde igual que lo que no existe.

const SeccionId = z.enum(SECCIONES.map((s) => s.id) as [string, ...string[]]);
const Indice = z
  .object({
    inicio: SeccionId.openapi({ description: 'La sección con la que abre la ayuda: la del rol más alto de la cuenta.' }),
    secciones: z.array(
      z.object({
        id: SeccionId,
        titulo: z.string(),
        paginas: z.array(
          z.object({
            tarea: z.string(),
            titulo: z.string(),
            resumen: z.string(),
            texto: z.string().openapi({ description: 'El cuerpo de la página en texto plano, para buscar: sin Markdown y sin los marcadores ({{…}}).' }),
          }),
        ),
      }),
    ),
  })
  .openapi('ManualIndice');
const Pagina = z
  .object({
    seccion: SeccionId,
    tarea: z.string(),
    titulo: z.string(),
    resumen: z.string(),
    markdown: z.string().openapi({
      description: 'El texto en Markdown (GFM), con los marcadores (`{{mm.aceptar}}`) ya reemplazados por los valores vigentes de la configuración. Las capturas van como `img/<archivo>`: se piden a `/api/v1/manual/{seccion}/img/{archivo}`.',
    }),
  })
  .openapi('ManualPagina');
const Nombre = z.string().max(80);

// Valores de la configuración para los marcadores ({{mm.aceptar}}; plan docs/bitacora/2026-11-03-manual-valores-reales).
// Son los mismos para todos: se leen con la sesión del que pide y quedan 60 s en memoria. Si la base falla, los últimos
// que se leyeron; si nunca se leyeron, null (aplicarMarcadores usa los de por defecto). Un error también se recuerda 60 s,
// para no pedirle a la base (ni ensuciar el log) en cada página.
const VALORES_MS = 60_000;
let valores: { datos: ManualValores | null; hasta: number } | null = null;

export async function valoresDelManual(c: Context<AppEnv>, ahora = Date.now()): Promise<ManualValores | null> {
  if (valores && valores.hasta > ahora) return valores.datos;
  const { data, error } = await c.var.sb.rpc('manual_valores' as never);
  if (error || !data || typeof data !== 'object') {
    console.warn(`manual: no se pudieron leer los valores de la configuración (${error?.message ?? 'respuesta vacía'})`);
    valores = { datos: valores?.datos ?? null, hasta: ahora + VALORES_MS };
    return valores.datos;
  }
  valores = { datos: data as ManualValores, hasta: ahora + VALORES_MS };
  return valores.datos;
}

/** Solo para las pruebas. */
export const olvidarValores = () => { valores = null; };

const noExiste = () => new AppError(404, 'NOT_FOUND', 'No existe esa página del manual.');
const PRIVADO = 'private, max-age=300';

const indice = createRoute({
  method: 'get', path: '/api/v1/manual', tags: ['Manual'], security: bearer, middleware: [requireUser] as const,
  summary: 'Índice del manual',
  description: 'Las secciones que ve la cuenta según su rol, con sus páginas en orden. Sin las páginas ocultas ni las secciones vacías.',
  responses: { 200: { description: 'Índice', ...json(Indice) }, ...errorResponses(401) },
});
const pagina = createRoute({
  method: 'get', path: '/api/v1/manual/{seccion}/{tarea}', tags: ['Manual'], security: bearer, middleware: [requireUser] as const,
  summary: 'Una página del manual',
  description: 'El texto de la página. 404 si no existe, si está oculta o si es de una sección que la cuenta no ve.',
  request: { params: z.object({ seccion: Nombre, tarea: Nombre }) },
  responses: { 200: { description: 'Página', ...json(Pagina) }, ...errorResponses(401, 404) },
});
const imagen = createRoute({
  method: 'get', path: '/api/v1/manual/{seccion}/img/{archivo}', tags: ['Manual'], security: bearer, middleware: [requireUser] as const,
  summary: 'Una captura del manual',
  description: 'La imagen, con caché privada. 404 si no existe o si es de una sección que la cuenta no ve.',
  request: { params: z.object({ seccion: Nombre, archivo: Nombre }) },
  responses: {
    200: { description: 'Captura', content: { 'image/webp': { schema: z.string().openapi({ format: 'binary' }) } } },
    ...errorResponses(401, 404),
  },
});

export const manual = createRouter()
  .openapi(indice, async (c) => {
    c.header('Cache-Control', PRIVADO);
    return c.json(indiceDe(c.var.manual, await userRole(c)), 200);
  })
  .openapi(imagen, async (c) => {
    const { seccion, archivo } = c.req.valid('param');
    const img = imagenPara(c.var.manual, await userRole(c), seccion, archivo);
    if (!img) throw noExiste();
    const datos = await img.leer();
    return c.body(datos as Uint8Array<ArrayBuffer>, 200, { 'Content-Type': img.tipo, 'Cache-Control': 'private, max-age=3600' }) as never;
  })
  .openapi(pagina, async (c) => {
    const { seccion, tarea } = c.req.valid('param');
    const p = paginaPara(c.var.manual, await userRole(c), seccion, tarea);
    if (!p) throw noExiste();
    c.header('Cache-Control', PRIVADO);
    const markdown = aplicarMarcadores(p.markdown, await valoresDelManual(c));
    return c.json({ seccion: p.seccion, tarea: p.tarea, titulo: p.titulo, resumen: p.resumen, markdown }, 200);
  });
