import { createRoute, z } from '@hono/zod-openapi';
import { notModified } from '../lib/etag';
import { AppError, fromPostgrest } from '../lib/errors';
import { createRouter } from '../lib/router';
import { anonClient } from '../lib/supabase';
import { errorResponses, json } from '../schemas/common';
import { ServerMode } from '../schemas/servers';
import { cachedDiscordCounts } from '../services/discord';
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
      in_queue: z.number().int().openapi({ description: 'Jugadores en la cola del matchmaking, de cualquier modo (replanteo 83)' }),
    }),
    mm_open: z.boolean().openapi({ description: 'Si la cola del matchmaking está abierta (replanteo 83)' }),
    checked_at: z.string().openapi({ description: 'Cuándo se consultó (la respuesta se guarda 20 s)' }),
  })
  .openapi('ServersStatus');

const status = createRoute({
  method: 'get',
  path: '/api/v1/servers/status',
  tags: ['Servidores'],
  summary: 'Estado de los servidores',
  description:
    'Los servidores activos con licencia vigente que salen en el inicio (`listed`), con su nombre público, consultados con A2S (la consulta del navegador de servidores del juego): ' +
    'si están prendidos, latencia, mapa y jugadores conectados, con su modo, su región y los mixes en vivo, más los totales y la cola del matchmaking (cuántos hay y si está abierta). La respuesta se guarda 20 s. Con `ETag` (`304` si no ' +
    'cambió). No es un listado paginado: son pocos servidores y es una foto completa.',
  responses: {
    200: { description: 'Estado', ...json(ServersStatus) },
    304: { description: 'Sin cambios desde el ETag enviado' },
    ...errorResponses(501),
  },
});

const DiscordCounts = z
  .object({
    online: z.number().int().nullable().openapi({ description: 'Conectados ahora. null si Discord no respondió' }),
    members: z.number().int().nullable().openapi({ description: 'Miembros del servidor. null si Discord no respondió' }),
    invite_url: z.string().openapi({ description: 'La invitación de la comunidad' }),
  })
  .openapi('DiscordCounts');

const discord = createRoute({
  method: 'get',
  path: '/api/v1/community/discord',
  tags: ['Servidores'],
  summary: 'Números del Discord de la comunidad',
  description:
    'Conectados y miembros, de la invitación pública de Discord (`invites/<código>?with_counts=true`), para la tarjeta del inicio. ' +
    'La respuesta se guarda 10 minutos. Si Discord no responde, los dos números van en `null` y la web muestra la tarjeta sin ellos.',
  responses: { 200: { description: 'Números', ...json(DiscordCounts) } },
});

export const servers = createRouter()
  .openapi(discord, async (c) => c.json(await cachedDiscordCounts(c.var.config.DISCORD_INVITE_CODE), 200))
  .openapi(status, async (c) => {
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
