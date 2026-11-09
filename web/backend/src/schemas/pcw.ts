import { z } from '@hono/zod-openapi';
import { boolParam, dateParam, Envelope, listQuery } from '../lib/list';

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
  team_id: z.uuid().optional().openapi({ description: 'Jugar como este equipo oficial (capitán o dueño): todo el roster con cuenta tiene que ser de su plantel y la PCW ganada suma a su ranking. Sin `players` ni `guests`, el bando es el plantel (hasta 7, primero el capitán): en el servidor entra cualquiera de ellos' }),
  name: z.string().trim().max(24).optional().openapi({ description: 'Nombre del bando (por defecto, "Pick de <alias>")' }),
};

export const MapPoolNames = z
  .array(z.string().regex(/^[a-z0-9_]{2,40}$/))
  .min(1)
  .max(20)
  .nullable()
  .openapi({ description: 'Pool del veto (nombres del catálogo, disponibles y sin repetir; al menos el BO más alto). `null`: el pool por defecto' });

export const PcwPostBody = z
  .object({
    best_of: BestOf,
    maps: z.string().trim().max(120).optional(),
    starts_at: z.iso.datetime({ offset: true }).optional().openapi({ description: 'Sin hora: a convenir' }),
    note: z.string().trim().max(200).optional(),
    map_pool: MapPoolNames.optional(),
    ...Roster,
  })
  .openapi('PcwPostBody');

// (replanteo 92) Una oferta a un anuncio: el bando y, si quiere, otra hora.
export const PcwOfferBody = z
  .object({
    ...Roster,
    starts_at: z.iso.datetime({ offset: true }).optional().openapi({ description: 'Otra hora que propone; sin hora, la del anuncio' }),
  })
  .openapi('PcwOfferBody');

export const PcwSideSchema = z
  .object({
    team_id: z.uuid(),
    name: z.string(),
    plays_as: z.object({ id: z.uuid(), name: z.string(), tag: z.string().nullable() }).nullable(),
    rank: z.number().int().nullable().openapi({ description: 'Puesto en el ranking de equipos (total) del equipo con el que juega; null: mix de amigos o sin puesto' }),
    roster: z.array(
      z.object({
        player_id: z.uuid().nullable(),
        alias: z.string(),
        guest: z.boolean(),
        elo: z.number().int().nullable().openapi({ description: 'ELO actual; null: invitado o sin ELO' }),
      }),
    ),
  })
  .openapi('PcwSide');

export const PcwOffer = z
  .object({
    id: z.uuid(),
    post_id: z.uuid(),
    status: z.enum(['open', 'chosen', 'rejected', 'withdrawn']),
    starts_at: z.string().nullable().openapi({ description: 'Otra hora que propone; null: la del anuncio' }),
    created_at: z.string(),
    by: z.object({ user_id: z.uuid(), alias: z.string().nullable() }),
    side: PcwSideSchema,
  })
  .openapi('PcwOffer');

const MyOffer = z
  .object({ id: z.uuid(), starts_at: z.string().nullable(), created_at: z.string() })
  .openapi('PcwMyOffer', { description: 'Con sesión: la oferta abierta que mandé a este anuncio' });

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
    map_pool: z.array(z.string()).nullable().openapi({ description: 'Pool del veto; `null`: el pool por defecto. Con tantos mapas como el formato, se juegan esos sin veto' }),
    side: PcwSideSchema,
    my_offer: MyOffer.nullable().optional(),
    offers: z.array(PcwOffer).optional().openapi({ description: 'Solo en GET /me/pcw/post: las ofertas abiertas que llegaron' }),
  })
  .openapi('PcwPost');

// (replanteo 92) Lo mío para la página de PCW.
const CtxPlayer = z.object({ player_id: z.uuid(), alias: z.string(), elo: z.number().int().nullable() });
export const PcwContext = z
  .object({
    vip: z.boolean().openapi({ description: 'Puede publicar (VIP o admin)' }),
    me: CtxPlayer.nullable().openapi({ description: 'Mi ficha; null sin ficha' }),
    team: z
      .object({
        id: z.uuid(),
        name: z.string(),
        tag: z.string().nullable(),
        logo_url: z.string().nullable(),
        rank: z.number().int().nullable(),
        ban_until: z.string().nullable().openapi({ description: 'Sanción de PCW vigente del equipo' }),
        plantel: z.array(CtxPlayer.extend({ has_account: z.boolean() })),
      })
      .nullable()
      .openapi({ description: 'El equipo oficial con el que puedo jugar (capitán o dueño); null si no tengo' }),
    friends: z.array(CtxPlayer.extend({ teammate: z.boolean() })),
  })
  .openapi('PcwContext');

export const OfferParam = z.object({ id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }) });

export const PostParam = z.object({ id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }) });

export const MapPoolItem = z
  .object({
    name: z.string().regex(/^[a-z0-9_]{2,40}$/).openapi({ example: 'de_inferno' }),
    versions: z.array(z.string().regex(/^[a-z0-9_]{2,40}$/)).min(1).max(5).optional().openapi({ description: 'Versiones del servidor; la primera es el nombre. Por defecto, solo el nombre' }),
    active: z.boolean().default(true).openapi({ description: 'Disponible. Un mapa no se borra: se retira con `false`' }),
    mixes: z.boolean().optional().openapi({ description: 'Sale en el select de Mixes. Si no viene, queda como estaba (en un mapa nuevo, como `active`)' }),
    veto_default: z.boolean().optional().openapi({ description: 'Pool por defecto del veto. Si no viene, queda como estaba (en un mapa nuevo, como `active`)' }),
  })
  .openapi('MapPoolItem');
export const MapPoolBody = z
  .object({ maps: z.array(MapPoolItem).min(2).max(40).openapi({ description: 'El catálogo completo, en orden: tiene que traer todos los mapas que ya existen' }) })
  .openapi('MapPoolBody');
export const MapNameParam = z.object({ name: z.string().regex(/^[a-z0-9_]{2,40}$/).openapi({ param: { name: 'name', in: 'path' }, example: 'de_inferno' }) });
export const MapImageUpload = z
  .object({
    file: z
      .custom<File>((v) => typeof File !== 'undefined' && v instanceof File, { message: 'Falta el archivo (campo "file").' })
      .openapi({ type: 'string', format: 'binary', description: 'JPEG, PNG o WebP, máximo 2 MB. Captura horizontal sin HUD, idealmente 1920×1080.' }),
  })
  .openapi('MapImageUpload');

export const PcwPostQuery = listQuery(['created_at', 'starts_at'], { sort: 'created_at', order: 'desc' }).extend({
  best_of: z.coerce.number().int().refine((v) => [1, 3, 5].includes(v), 'BO1, BO3 o BO5').optional(),
  q: z.string().max(60).optional().openapi({ description: 'Busca en el bando y el equipo con el que juega' }),
  from: dateParam('Hora de inicio desde'),
  to: dateParam('Hora de inicio hasta'),
});
export const PcwPostList = Envelope(PcwPost).openapi('PcwPostList');

export const MapQuery = listQuery(['position', 'name'], { sort: 'position', order: 'asc' }).extend({
  q: z.string().max(40).optional(),
  include_inactive: boolParam('Incluir los mapas retirados (para el admin y para las fotos de las salas viejas)'),
  mixes: boolParam('`true` solo los del select de Mixes'),
  veto_default: boolParam('`true` solo los del pool por defecto del veto'),
});
export const MapItem = z
  .object({
    name: z.string(),
    versions: z.array(z.string()),
    active: z.boolean().openapi({ description: 'Disponible (`false`: retirado)' }),
    position: z.number().int(),
    mixes: z.boolean().openapi({ description: 'Sale en el select de Mixes' }),
    veto_default: z.boolean().openapi({ description: 'En el pool por defecto del veto (PCW y torneos sin pool propio)' }),
    image_url: z.string().nullable().openapi({ description: 'Foto del mapa: fondo del marcador de la sala. Vale para todas sus versiones' }),
  })
  .openapi('MapItem');
export const MapList = Envelope(MapItem).openapi('MapList');

export const ServerQuery = listQuery(['name'], { sort: 'name', order: 'asc' }).extend({ q: z.string().max(60).optional() });
export const ServerItem = z.object({ id: z.uuid(), name: z.string(), address: z.string().nullable() }).openapi('ServerItem');
export const ServerList = Envelope(ServerItem).openapi('ServerList');
