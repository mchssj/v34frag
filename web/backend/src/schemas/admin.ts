import { z } from '@hono/zod-openapi';
import { boolParam, Envelope, listQuery } from '../lib/list';
import { VipStatus } from './vip';

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v))
    .openapi({ type: ['string', 'null'], description: '`null` o `""` lo borra' });

const force = z
  .boolean()
  .default(false)
  .openapi({ description: 'Guardar aunque el nombre contenga una palabra bloqueada (por un falso positivo)' });

export const Nick = z.string().trim().min(2).max(24).regex(/^[^<>]+$/, 'Sin < ni >');

export const AdminPlayerCreate = z
  .object({
    nick: Nick.openapi({ description: 'Nombre de un jugador sin cuenta. Si se vincula una cuenta, manda su alias' }),
    user_id: z.uuid().nullable().optional().openapi({ description: 'Cuenta a vincular (su alias pasa a ser el nombre)' }),
    privacy: z.enum(['public', 'private']).optional(),
    bio: optText(500),
    achievements: optText(500),
    team_history: optText(500),
    force,
  })
  .openapi('AdminPlayerCreate');

export const AdminPlayerPatch = z
  .object({
    nick: Nick.optional().openapi({ description: 'Solo en jugadores sin cuenta: en los vinculados manda el alias' }),
    user_id: z.uuid().nullable().optional().openapi({ description: 'Vincular (`uuid`) o desvincular (`null`) una cuenta' }),
    privacy: z.enum(['public', 'private']).optional(),
    bio: optText(500),
    achievements: optText(500),
    team_history: optText(500),
    force,
  })
  .refine((o) => Object.entries(o).some(([k, v]) => k !== 'force' && v !== undefined), { message: 'No hay nada para actualizar.' })
  .openapi('AdminPlayerPatch');

export const AdminPlayer = z
  .object({
    id: z.uuid(),
    nick: z.string(),
    user_id: z.uuid().nullable(),
    steam_id: z.string().nullable(),
    photo_url: z.string().nullable(),
    privacy: z.string(),
    bio: z.string().nullable(),
    achievements: z.string().nullable(),
    team_history: z.string().nullable(),
  })
  .openapi('AdminPlayer');

export const MedalBody = z
  .object({
    title: z.string().trim().min(1).max(80),
    icon: z.string().trim().min(1).max(8).default('🏆').openapi({ description: 'Un emoji' }),
  })
  .openapi('MedalBody');

export const SteamUnlinked = z
  .object({ steam_id: z.string(), last_nick: z.string().nullable(), matches: z.number().int(), last_played: z.string().nullable() })
  .openapi('SteamUnlinked');

export const SteamLinkBody = z
  .object({
    steam_id: z.string().trim().min(1).max(120).openapi({ description: 'SteamID64, STEAM_0:X:Y o link del perfil' }),
    player_id: z.uuid().nullable().openapi({ description: '`null` desvincula ese SteamID de su jugador' }),
  })
  .openapi('SteamLinkBody');

export const AdminUser = z
  .object({
    id: z.uuid(),
    alias: z.string(),
    role: z.string(),
    alias_changed_at: z.string().nullable(),
    player_id: z.uuid().nullable(),
    steam_id: z.string().nullable(),
    vip: VipStatus.nullable().openapi({ description: '`null` si nunca fue VIP' }),
  })
  .openapi('AdminUser');

export const AdminAliasBody = z
  .object({ alias: Nick, force })
  .openapi('AdminAliasBody');

export const BlockedWord = z
  .object({ id: z.uuid(), word: z.string().openapi({ description: 'Normalizada: minúsculas, sin tildes, espacios ni leetspeak' }), created_at: z.string() })
  .openapi('BlockedWord');

export const BlockedWordBody = z.object({ word: z.string().trim().min(2).max(40) }).openapi('BlockedWordBody');

export const BlockedHit = z
  .object({
    kind: z.enum(['alias', 'player', 'team']).openapi({ description: '`alias` de una cuenta, `player` sin cuenta o `team` (nombre o sigla)' }),
    id: z.uuid().openapi({ description: 'Id del usuario, del jugador o del equipo' }),
    name: z.string(),
    word: z.string(),
  })
  .openapi('BlockedHit');

export const AdminTeamCreate = z
  .object({
    name: z.string().trim().min(2).max(40),
    tag: z.string().trim().min(1).max(6).transform((v) => v.toUpperCase()),
    captain_player_id: z.uuid().optional().openapi({ description: 'Jugador con cuenta: queda como dueño, capitán y primer miembro' }),
    force,
  })
  .openapi('AdminTeamCreate');

export const AdminTeamPatch = z
  .object({
    name: z.string().trim().min(2).max(40).optional(),
    tag: z.string().trim().min(1).max(6).transform((v) => v.toUpperCase()).optional(),
    captain_player_id: z.uuid().optional().openapi({ description: 'Nuevo capitán (jugador con cuenta)' }),
    force,
  })
  .refine((o) => o.name !== undefined || o.tag !== undefined || o.captain_player_id !== undefined, { message: 'No hay nada para actualizar.' })
  .openapi('AdminTeamPatch');

export const MemberBody = z
  .object({ player_id: z.uuid(), role: z.enum(['player', 'sub', 'coach']).default('player') })
  .openapi('MemberBody');

export const RoleBody = z.object({ role: z.enum(['player', 'sub', 'coach']) }).openapi('RoleBody');

export const AdminTeamRequest = z
  .object({
    user_id: z.uuid(),
    alias: z.string().nullable(),
    has_steam: z.boolean(),
    name: z.string(),
    tag: z.string().nullable(),
    status: z.string(),
  })
  .openapi('AdminTeamRequest');

export const RankingConfig = z
  .object({
    win_official: z.number().int().min(0).max(1000).openapi({ description: 'Puntos por partida de torneo ganada' }),
    win_pcw: z.number().int().min(0).max(1000).openapi({ description: 'Puntos por PCW ganada (jugada como el equipo)' }),
  })
  .openapi('RankingConfig');

export const IdParam = z.object({ id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }) });
export const UserIdParam = z.object({ userId: z.uuid().openapi({ param: { name: 'userId', in: 'path' } }) });
export const TeamPlayerParam = IdParam.extend({ playerId: z.uuid().openapi({ param: { name: 'playerId', in: 'path' } }) });

// ---------- listados ----------

export const SteamUnlinkedQuery = listQuery(['last_played', 'matches', 'last_nick'], { sort: 'last_played', order: 'desc' }).extend({
  q: z.string().max(60).optional().openapi({ description: 'Busca en el último nombre y en el SteamID' }),
});
export const SteamUnlinkedList = Envelope(SteamUnlinked).openapi('SteamUnlinkedList');

export const AdminUserQuery = listQuery(['alias', 'role'], { sort: 'alias', order: 'asc' }).extend({
  q: z.string().max(60).optional().openapi({ description: 'Busca en el alias' }),
  role: z.enum(['user', 'organizer', 'moderator', 'admin']).optional(),
  has_player: boolParam('Con o sin jugador vinculado'),
  has_steam: boolParam('Con o sin SteamID vinculado'),
});
export const AdminUserList = Envelope(AdminUser).openapi('AdminUserList');

export const BlockedWordQuery = listQuery(['word', 'created_at'], { sort: 'word', order: 'asc' }).extend({
  q: z.string().max(40).optional(),
});
export const BlockedWordList = Envelope(BlockedWord).openapi('BlockedWordList');

export const BlockedHitQuery = listQuery(['kind', 'name'], { sort: 'kind', order: 'asc' }).extend({
  kind: z.enum(['alias', 'player', 'team']).optional(),
});
export const BlockedHitList = Envelope(BlockedHit).openapi('BlockedHitList');

export const TeamRequestQuery = listQuery(['status', 'name'], { sort: 'status', order: 'asc' }).extend({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  q: z.string().max(60).optional().openapi({ description: 'Busca en el nombre, la sigla y el alias de quien pidió' }),
});
export const AdminTeamRequestList = Envelope(AdminTeamRequest).openapi('AdminTeamRequestList');
