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
export const errorResponses = (...statuses: (400 | 401 | 403 | 404 | 409 | 413 | 429 | 501)[]) =>
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
  501: 'No disponible en este despliegue',
} as const;

export const Paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    per: z.number().int(),
  });

// Doble confirmación de acciones delicadas (recalcular el ELO, rotar el token del Worker de demos): el frontend
// pregunta si está seguro y pide escribir este texto; la API también lo exige.
export const CONFIRM_TEXT = 'estoy seguro';
export const confirmField = (action: string) =>
  z
    .string()
    .openapi({ description: `Doble confirmación: el texto \`${CONFIRM_TEXT}\` que escribió el admin` })
    .refine((v) => v.trim().toLowerCase() === CONFIRM_TEXT, { message: `Para ${action}, escribe "${CONFIRM_TEXT}".` });

/** Clutches ganados por cantidad de rivales (replanteo 29): `{ "1": 3, "2": 1, "3": 0, "4": 0, "5": 0 }`. */
export const Clutches = z
  .object({ '1': z.number().int(), '2': z.number().int(), '3': z.number().int(), '4': z.number().int(), '5': z.number().int() })
  .openapi('Clutches', { description: 'Clutches ganados: la clave es la cantidad de rivales (1v1 a 1v5). Solo los ganados' });

/** Revisión del ELO de un mix interrumpido por una caída. */
export const ReviewStatus = z.enum(['pending', 'applied', 'discarded']);
