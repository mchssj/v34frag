import { z } from '@hono/zod-openapi';

const BestOf = z.union([z.literal(1), z.literal(3), z.literal(5)]).openapi({ description: 'BO1, BO3 o BO5', example: 3 });

export const PcwFormats = z
  .object({
    formats: z.array(BestOf).openapi({ description: 'Formatos que se pueden elegir al publicar una PCW, de menor a mayor', example: [1, 3, 5] }),
  })
  .openapi('PcwFormats');

export const PcwFormatsBody = z
  .object({
    formats: z
      .array(BestOf)
      .min(1, 'Tiene que quedar al menos un formato habilitado')
      .max(3)
      .openapi({ description: 'Formatos habilitados (los repetidos se ignoran)', example: [1, 3] }),
  })
  .openapi('PcwFormatsBody');
