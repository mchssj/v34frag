import { z } from '@hono/zod-openapi';
import { boolParam, dateParam, Envelope, listQuery } from '../lib/list';
import { PlayerStats } from './players';

// Perfiles sin reclamar, !claim y varios SteamID por ficha (plan docs/bitacora/2026-10-16-claim-steamid).

export const STEAM64 = /^(7656119[0-9]{10}|765612[0-9]{11})$/;
export const SteamParam = z.object({
  steamid: z.string().regex(STEAM64, 'SteamID64 inválido').openapi({ param: { name: 'steamid', in: 'path' }, example: '76561198000000001' }),
});

// ---------- perfil sin reclamar ----------

export const UnclaimedSummary = z
  .object({
    steam_id: z.string(),
    last_nick: z.string().nullable().openapi({ description: 'El último nombre que usó en el juego' }),
    nicks: z.array(z.string()).openapi({ description: 'Los últimos nombres que usó (hasta 5, el más reciente primero)' }),
    matches: z.number().int(),
    first_played: z.string().nullable(),
    last_played: z.string().nullable(),
    elo: z.number().int().nullable(),
    peak_elo: z.number().int().nullable(),
    elo_matches: z.number().int(),
    level: z.number().int().nullable(),
  })
  .openapi('UnclaimedSummary');

export const UnclaimedQuery = listQuery(['last_played', 'matches', 'elo', 'last_nick'], { sort: 'last_played', order: 'desc' }).extend({
  q: z.string().max(60).optional().openapi({ description: 'Busca en los nombres que usó y en el SteamID' }),
});
export const UnclaimedList = Envelope(UnclaimedSummary).openapi('UnclaimedList');

export const SteamProfile = z
  .object({
    steam_id: z.string(),
    claimed: z.boolean().openapi({ description: '`true`: ese SteamID ya es de una ficha (redirigir a `player_id`)' }),
    player_id: z.uuid().nullable(),
    profile: UnclaimedSummary.extend({ stats: PlayerStats.nullable() }).nullable().openapi({ description: 'Solo si no está reclamado' }),
  })
  .openapi('SteamProfile');

// ---------- código de !claim ----------

export const ClaimCode = z
  .object({
    code: z.string(),
    expires_at: z.string(),
    command: z.string().openapi({ example: '!claim K7P2QX', description: 'Lo que se escribe en el chat del servidor' }),
  })
  .openapi('ClaimCode');

export const MySteamStatus = z
  .object({
    steam_ids: z
      .array(
        z.object({
          steam_id: z.string(),
          is_primary: z.boolean(),
          added_at: z.string().nullable().openapi({ description: 'Cuándo se vinculó a la ficha. `null`: no se sabe (se vinculó antes de que se guardara la fecha)' }),
          unlink_pending: z.boolean().openapi({ description: '`true`: pidió desvincularlo y falta que lo apruebe un admin' }),
        }),
      )
      .openapi({ description: 'El principal primero' }),
    max_steam_ids: z.number().int().openapi({ description: 'Tope de SteamID por ficha que se pueden pedir con `!claim`' }),
    last_code: z
      .object({
        code: z.string(),
        status: z.enum(['pending', 'used', 'expired']).openapi({ description: '`pending`: sin usar y vigente' }),
        expires_at: z.string(),
        used_at: z.string().nullable(),
        used_steam_id: z.string().nullable(),
        result: z.string().nullable().openapi({ description: 'El mensaje que vio el jugador en el servidor' }),
      })
      .nullable(),
    pending_requests: z.number().int().openapi({ description: 'Pedidos pendientes (de SteamID adicional y de desvincular)' }),
  })
  .openapi('MySteamStatus');

export const STEAM_REQUEST_STATES = ['pending', 'approved', 'rejected', 'expired'] as const;
export const STEAM_REQUEST_KINDS = ['add', 'remove'] as const;
export const MySteamRequest = z
  .object({
    id: z.number().int(),
    kind: z.enum(STEAM_REQUEST_KINDS).openapi({ description: '`add`: SteamID adicional (con `!claim`); `remove`: desvincularlo de la ficha' }),
    steam_id: z.string(),
    nick: z.string().nullable(),
    status: z.enum(STEAM_REQUEST_STATES),
    note: z.string().nullable().openapi({ description: 'Motivo que escribió el jugador al pedir desvincularlo' }),
    reason: z.string().nullable().openapi({ description: 'Motivo del rechazo' }),
    created_at: z.string(),
    resolved_at: z.string().nullable(),
  })
  .openapi('MySteamRequest');
export const MySteamRequestQuery = listQuery(['created_at'], { sort: 'created_at', order: 'desc' }).extend({
  status: z.enum(STEAM_REQUEST_STATES).optional(),
  kind: z.enum(STEAM_REQUEST_KINDS).optional(),
});
export const UnlinkBody = z
  .object({ reason: z.string().trim().max(200).optional().openapi({ description: 'Por qué lo quiere desvincular (lo ve el admin)' }) })
  .openapi('SteamUnlinkRequest');
export const MySteamRequestList = Envelope(MySteamRequest).openapi('MySteamRequestList');

// ---------- admin ----------

export const AdminSteamRequest = MySteamRequest.extend({
  player: z.object({ id: z.uuid(), nick: z.string() }),
  user: z.object({ id: z.uuid(), alias: z.string().nullable() }).nullable(),
  server: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  matches: z.number().int().openapi({ description: 'Partidas jugadas con ese SteamID' }),
  player_steam_count: z.number().int().openapi({ description: 'SteamID que ya tiene la ficha' }),
  shares_match: z.boolean().openapi({ description: '`true`: jugó una partida junto a otro SteamID de la ficha (no se puede aprobar). Siempre `false` en `remove`' }),
}).openapi('AdminSteamRequest');
export const AdminSteamRequestQuery = listQuery(['status', 'created_at'], { sort: 'status', order: 'asc' }).extend({
  status: z.enum(STEAM_REQUEST_STATES).optional(),
  kind: z.enum(STEAM_REQUEST_KINDS).optional(),
  q: z.string().max(60).optional().openapi({ description: 'Busca en el nick, la ficha, el alias y el SteamID' }),
});
export const AdminSteamRequestList = Envelope(AdminSteamRequest).openapi('AdminSteamRequestList');
export const RequestIdParam = z.object({ id: z.coerce.number().int().positive().openapi({ param: { name: 'id', in: 'path' } }) });
export const RejectBody = z
  .object({ reason: z.string().trim().max(200).optional().openapi({ description: 'Lo ve el jugador' }) })
  .openapi('SteamRequestReject');

export const ClaimLogItem = z
  .object({
    id: z.number().int(),
    created_at: z.string(),
    ok: z.boolean(),
    result: z.string(),
    steam_id: z.string().nullable(),
    nick: z.string().nullable(),
    user: z.object({ id: z.uuid(), alias: z.string().nullable() }).nullable(),
    player: z.object({ id: z.uuid(), nick: z.string() }).nullable(),
    server: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  })
  .openapi('ClaimLogItem');
export const ClaimLogQuery = listQuery(['created_at'], { sort: 'created_at', order: 'desc' }).extend({
  ok: boolParam('Aceptados o rechazados'),
  steam_id: z.string().regex(STEAM64).optional(),
  q: z.string().max(60).optional().openapi({ description: 'Busca en el nick, el alias, la ficha y el SteamID' }),
  from: dateParam('Desde'),
  to: dateParam('Hasta'),
});
export const ClaimLogList = Envelope(ClaimLogItem).openapi('ClaimLogList');

export const SteamConfig = z
  .object({ max_steam_ids: z.number().int().min(1, 'Entre 1 y 4').max(4, 'Entre 1 y 4').openapi({ description: 'Tope de SteamID por ficha que se pueden pedir con `!claim` (de 1 a 4)' }) })
  .openapi('SteamConfig');
