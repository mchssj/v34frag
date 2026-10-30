import { z } from '@hono/zod-openapi';
import { boolParam, Envelope, listQuery } from '../lib/list';
import { ServerHud } from './hud';

// Admin de servidores de juego (plan docs/bitacora/2026-10-16-api-admin-servidores).
// Los formatos son los mismos `check` de game_servers.

const nullable = <T extends z.ZodType>(s: T, description: string) =>
  z
    .union([s, z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' ? null : v))
    .openapi({ description: `${description}. \`null\` o \`""\` lo borra` });

const Name = z.string().trim().min(2, 'Entre 2 y 40 caracteres').max(40, 'Entre 2 y 40 caracteres');
const Address = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9.-]+:[0-9]{1,5}$/, 'Formato host:puerto, por ejemplo 45.235.98.10:27015');
const PanelId = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{8,36}$/, 'El id del servidor en el panel (de 8 a 36 letras, números o guiones)');
const Ip = z.string().trim().pipe(z.union([z.ipv4(), z.ipv6()], { error: 'No es una IP válida (sin máscara)' }));
const Expires = z.iso.datetime({ offset: true });

/** Modos de juego (replanteo 20). El frontend los traduce. */
export const SERVER_MODES = ['mix', 'competitive', 'public', 'deathmatch', 'retakes', 'practice'] as const;
export const ServerMode = z.enum(SERVER_MODES).openapi({
  description: '`mix`, `competitive` (torneos y PCW), `public`, `deathmatch`, `retakes` o `practice`',
});
const Region = z.string().trim().min(2, 'Entre 2 y 30 caracteres').max(30, 'Entre 2 y 30 caracteres');
const TvPort = z.number().int().min(1, 'Un puerto entre 1 y 65535').max(65535, 'Un puerto entre 1 y 65535');

const fields = {
  connect_address: nullable(Address, 'Dirección para el botón "Conectar" (`host:puerto`)'),
  panel_server_id: nullable(PanelId, 'Id del servidor en el panel de Pterodactyl (lo usa el Worker de demos)'),
  license_expires_at: nullable(Expires, 'Vencimiento de la licencia (ISO 8601). Sin valor, no vence'),
  allowed_ip: nullable(Ip, 'Única IP desde la que se acepta el token. Sin valor, cualquiera'),
  mode: nullable(ServerMode, 'Modo de juego'),
  region: nullable(Region, 'Región para mostrar en la web, texto libre (por ejemplo "Argentina")'),
  tv_port: nullable(TvPort, 'Puerto de SourceTV (`tv_port` del servidor, por ejemplo 27020): "Ver en TV" en los mixes en vivo'),
};

export const ServerCreate = z
  .object({ name: Name.openapi({ description: 'Único, sin distinguir mayúsculas' }), ...fields })
  .openapi('AdminServerCreate');

export const ServerPatch = z
  .object({
    name: Name.optional(),
    ...fields,
    active: z.boolean().optional().openapi({ description: '`false` revoca (el token deja de funcionar), `true` reactiva' }),
  })
  .refine((o) => Object.values(o).some((v) => v !== undefined), { message: 'No hay nada para actualizar.' })
  .openapi('AdminServerPatch');

export const LICENSE_STATES = ['ok', 'expiring', 'expired', 'revoked'] as const;

export const AdminServer = z
  .object({
    id: z.uuid(),
    name: z.string(),
    active: z.boolean(),
    license_state: z.enum(LICENSE_STATES).openapi({
      description: '`ok`; `expiring`: vence en 7 días o menos; `expired`: vencida; `revoked`: revocado',
    }),
    license_expires_at: z.string().nullable(),
    allowed_ip: z.string().nullable(),
    online: z.boolean().openapi({ description: 'Validó la licencia en los últimos 35 minutos' }),
    last_seen_at: z.string().nullable(),
    last_ip: z.string().nullable().openapi({ description: 'IP de la última conexión válida (para cargar `allowed_ip`)' }),
    plugin_version: z.string().nullable(),
    connect_address: z.string().nullable(),
    panel_server_id: z.string().nullable(),
    mode: ServerMode.nullable(),
    region: z.string().nullable(),
    tv_port: z.number().int().nullable().openapi({ description: 'Puerto de SourceTV' }),
    matches: z.number().int().openapi({ description: 'Partidas jugadas o asignadas en el servidor' }),
    last_match_at: z.string().nullable(),
    created_at: z.string(),
    hud: ServerHud.openapi({ description: 'HUD del relay en el VPS (se configura con `PUT …/hud`)' }),
  })
  .openapi('AdminServer');

export const ServerToken = z
  .object({
    id: z.uuid(),
    token: z.string().openapi({ description: 'Se muestra una sola vez: la base guarda solo su hash' }),
    cfg: z.string().openapi({ description: 'Las líneas para pegar en el cfg del servidor' }),
    build_command: z.string().openapi({ description: 'Comando del build licenciado para un servidor externo' }),
  })
  .openapi('AdminServerToken');

export const AdminServerQuery = listQuery(['name', 'created_at', 'last_seen_at', 'license_expires_at', 'matches'], {
  sort: 'name',
  order: 'asc',
}).extend({
  q: z.string().max(60).optional().openapi({ description: 'Busca en el nombre, la dirección, las IPs, la versión del plugin y la región' }),
  active: boolParam('Activos o revocados'),
  license: z.enum(LICENSE_STATES).optional().openapi({ description: 'Estado de la licencia' }),
  online: boolParam('En línea (validó la licencia en los últimos 35 minutos)'),
  has_panel: boolParam('Con id del panel cargado'),
  mode: ServerMode.optional(),
});
export const AdminServerList = Envelope(AdminServer).openapi('AdminServerList');
