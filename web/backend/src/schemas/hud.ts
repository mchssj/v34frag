import { z } from '@hono/zod-openapi';
import { boolParam, Envelope, listQuery } from '../lib/list';

// Relay del HUD en el VPS (plan docs/bitacora/2026-10-29-hud-relay-vps, replanteo 36): el HUD de cada servidor, los
// streamers y su link de OBS.

const UserRef = z.object({ id: z.uuid(), alias: z.string() });

export const ServerHud = z
  .object({
    port: z.number().int().nullable().openapi({ description: 'Puerto UDP del relay para este servidor (27500 a 27519). `null`: sin HUD' }),
    enabled: z.boolean().openapi({ description: 'El relay atiende este servidor. Necesita `port` y la SourceTV (`connect_address` y `tv_port`)' }),
    key: z.string().nullable().openapi({ description: 'Clave del HUD de este servidor (`csstv_hud_key`)' }),
    can_enable: z.boolean().openapi({ description: 'Tiene la SourceTV cargada: sin ella no se puede activar' }),
    last_packet_at: z.string().nullable().openapi({ description: 'Último paquete que recibió el relay' }),
    receiving: z.boolean().openapi({ description: 'El relay recibió un paquete en el último minuto' }),
    streaming: z.array(UserRef).openapi({ description: 'Streamers con el HUD abierto en este servidor ahora' }),
    cfg: z.string().nullable().openapi({ description: 'Las líneas de `cfg/sourcemod/csstv_hud.cfg` para ese servidor. `null` sin puerto' }),
  })
  .openapi('ServerHud');

export const ServerHudBody = z
  .object({
    port: z.number().int().min(27500, 'Un puerto entre 27500 y 27519').max(27519, 'Un puerto entre 27500 y 27519').nullable()
      .openapi({ description: '`null` saca el HUD del servidor (y borra la clave)' }),
    enabled: z.boolean(),
  })
  .openapi('ServerHudBody');

export const Streamer = z
  .object({
    user: UserRef,
    active: z.boolean().openapi({ description: '`false`: se la quitaron' }),
    granted_at: z.string(),
    granted_by: z.string().nullable().openapi({ description: 'Alias del admin que la dio' }),
    revoked_at: z.string().nullable(),
    has_link: z.boolean().openapi({ description: 'Ya generó su link de OBS' }),
    link_created_at: z.string().nullable(),
  })
  .openapi('Streamer');

export const StreamerList = Envelope(Streamer).openapi('StreamerList');

export const StreamerQuery = listQuery(['alias', 'granted_at'], { sort: 'alias', order: 'asc' }).extend({
  q: z.string().max(60).optional().openapi({ description: 'Busca en el alias' }),
  active: boolParam('Solo las activas (`true`) o solo las quitadas (`false`)'),
});

export const MyStreamer = z
  .object({
    since: z.string(),
    has_link: z.boolean(),
    link_created_at: z.string().nullable(),
  })
  .openapi('MyStreamer');

export const HudLink = z
  .object({
    hud_url: z.string().openapi({ description: 'Para la fuente Navegador de OBS (1920×1080). **Se muestra una sola vez**' }),
    control_url: z.string().openapi({ description: 'Panel del streamer: servidor, jugador enfocado y qué se muestra' }),
    created_at: z.string(),
  })
  .openapi('HudLink');
