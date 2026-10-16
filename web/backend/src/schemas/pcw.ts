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

const Roster = {
  players: z.array(z.uuid()).max(7).default([]).openapi({ description: 'Jugadores de la lista (al menos 4 con cuenta en total)' }),
  guests: z
    .array(z.string().trim().min(2).max(24).regex(/^[^<>]+$/, 'Sin < ni >'))
    .max(7)
    .default([])
    .openapi({ description: 'Tags de jugadores sin ficha (stand-ins)' }),
  team_id: z.uuid().optional().openapi({ description: 'Jugar como este equipo oficial (capitán o dueño): todo el roster con cuenta tiene que ser de su plantel y la PCW ganada suma a su ranking' }),
  name: z.string().trim().max(24).optional().openapi({ description: 'Nombre del bando (por defecto, "Pick de <alias>")' }),
};

export const PcwPostBody = z
  .object({
    best_of: BestOf,
    maps: z.string().trim().max(120).optional(),
    starts_at: z.iso.datetime({ offset: true }).optional().openapi({ description: 'Sin hora: a convenir' }),
    note: z.string().trim().max(200).optional(),
    ...Roster,
  })
  .openapi('PcwPostBody');

export const PcwAcceptBody = z.object(Roster).openapi('PcwAcceptBody');

const Side = z
  .object({
    team_id: z.uuid(),
    name: z.string(),
    plays_as: z.object({ id: z.uuid(), name: z.string(), tag: z.string().nullable() }).nullable(),
    roster: z.array(z.object({ player_id: z.uuid().nullable(), alias: z.string(), guest: z.boolean() })),
  })
  .openapi('PcwSide');

export const PcwPost = z
  .object({
    id: z.uuid(),
    by: z.object({ user_id: z.uuid(), alias: z.string().nullable() }),
    best_of: BestOf,
    maps: z.string().nullable(),
    starts_at: z.string().nullable(),
    note: z.string().nullable(),
    status: z.string(),
    match_id: z.uuid().nullable(),
    created_at: z.string(),
    side: Side,
  })
  .openapi('PcwPost');

export const PostParam = z.object({ id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }) });

export const MapPoolItem = z
  .object({
    name: z.string().regex(/^[a-z0-9_]{2,40}$/).openapi({ example: 'de_inferno' }),
    versions: z.array(z.string().regex(/^[a-z0-9_]{2,40}$/)).min(1).max(5).optional().openapi({ description: 'Versiones del servidor; la primera es el nombre. Por defecto, solo el nombre' }),
    active: z.boolean().default(true),
  })
  .openapi('MapPoolItem');
export const MapPoolBody = z.object({ maps: z.array(MapPoolItem).min(2).max(20) }).openapi('MapPoolBody');
