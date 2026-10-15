import { z } from '@hono/zod-openapi';

export const ErrorResponse = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
      message: z.string().openapi({ example: 'Los datos enviados no son válidos.' }),
      details: z.unknown().optional().openapi({ description: 'Detalle por campo en los errores de validación.' }),
      requestId: z.string().nullable().openapi({ description: 'Id del request (también en el header X-Request-Id).' }),
    }),
  })
  .openapi('Error');

// Cuerpo JSON y seguridad para createRoute.
export const json = <T>(schema: T) => ({ content: { 'application/json': { schema } } });
export const bearer = [{ bearerAuth: [] }];

// Respuestas de error comunes, para declararlas en cada ruta.
export const errorResponses = (...statuses: (400 | 401 | 403 | 404 | 409 | 413 | 429)[]) =>
  Object.fromEntries(
    statuses.map((s) => [s, { description: ERROR_DESC[s], content: { 'application/json': { schema: ErrorResponse } } }]),
  );

const ERROR_DESC = {
  400: 'Datos inválidos',
  401: 'Sin sesión o sesión vencida',
  403: 'Sin permiso',
  404: 'No existe',
  409: 'Conflicto con un registro existente',
  413: 'Archivo demasiado grande',
  429: 'Demasiados intentos',
} as const;

export const Paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    per: z.number().int(),
  });
