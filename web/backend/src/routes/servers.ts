import { createRoute, z } from '@hono/zod-openapi';
import { notModified } from '../lib/etag';
import { AppError, fromPostgrest } from '../lib/errors';
import { createRouter } from '../lib/router';
import { anonClient } from '../lib/supabase';
import { errorResponses, json } from '../schemas/common';
import { ServerMode } from '../schemas/servers';
import { cachedServersStatus } from '../services/servers';

const ServerStatusItem = z
  .object({
    id: z.uuid(),
    name: z.string(),
    address: z.string().nullable().openapi({ description: 'Para el botón "Conectar" (`host:puerto`)' }),
    tv_address: z.string().nullable().openapi({ description: 'SourceTV (`host:puerto_tv`), para "Ver en TV". null si el servidor no tiene el puerto cargado' }),
    mode: ServerMode.nullable().openapi({ description: 'Modo de juego. null si no está cargado' }),
    region: z.string().nullable().openapi({ description: 'Región (texto libre). null si no está cargada' }),
    online: z.boolean().openapi({ description: 'Respondió a la consulta en 1,5 s' }),
    ping_ms: z.number().int().nullable().openapi({
      description: 'Latencia de la consulta desde el backend hasta el servidor, en ms. No es el ping del jugador. null si no respondió',
    }),
    map: z.string().nullable(),
    players: z.number().int().nullable().openapi({ description: 'Jugadores conectados, sin bots ni SourceTV. null si no respondió' }),
    max_players: z.number().int().nullable(),
    bots: z.number().int().nullable().openapi({ description: 'Bots, SourceTV incluido' }),
    live_matches: z.number().int().openapi({ description: 'Mixes en vivo en este servidor (con foto en los últimos 10 minutos)' }),
  })
  .openapi('ServerStatusItem');

const ServersStatus = z
  .object({
    servers: z.array(ServerStatusItem),
    totals: z.object({
      servers: z.number().int().openapi({ description: 'Servidores activos con licencia vigente' }),
      online: z.number().int().openapi({ description: 'Los que respondieron' }),
      players: z.number().int().openapi({ description: 'Jugadores conectados entre todos' }),
      live_matches: z.number().int().openapi({ description: 'Mixes en vivo entre todos' }),
    }),
    checked_at: z.string().openapi({ description: 'Cuándo se consultó (la respuesta se guarda 20 s)' }),
  })
  .openapi('ServersStatus');

const status = createRoute({
  method: 'get',
  path: '/api/v1/servers/status',
  tags: ['Servidores'],
  summary: 'Estado de los servidores',
  description:
    'Los servidores activos con licencia vigente, consultados con A2S (la consulta del navegador de servidores del juego): ' +
    'si están prendidos, latencia, mapa y jugadores conectados, con su modo, su región y los mixes en vivo, más los totales. La respuesta se guarda 20 s. Con `ETag` (`304` si no ' +
    'cambió). No es un listado paginado: son pocos servidores y es una foto completa.',
  responses: {
    200: { description: 'Estado', ...json(ServersStatus) },
    304: { description: 'Sin cambios desde el ETag enviado' },
    ...errorResponses(501),
  },
});

export const servers = createRouter().openapi(status, async (c) => {
  const udp = c.var.udp;
  if (!udp) throw new AppError(501, 'NOT_AVAILABLE', 'El estado de los servidores solo está disponible en el servidor de Node.');
  let body;
  try {
    body = await cachedServersStatus(anonClient(c.var.config), udp);
  } catch (e) {
    throw fromPostgrest(e as { message: string; code?: string });
  }
  if (await notModified(c, body)) return c.body(null, 304);
  return c.json(body, 200);
});
