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

export const MedalKey = z.string().regex(/^[a-z0-9_]{1,60}$/).openapi({ description: 'Clave del catálogo de dibujos (`/medallas/catalogo.json` del frontend)' });

export const MedalBody = z
  .object({
    title: z.string().trim().min(1).max(80),
    icon: z.string().trim().min(1).max(8).default('🏆').openapi({ description: 'Un emoji (para la web vieja y si no hay dibujo)' }),
    medal_key: MedalKey.optional(),
    season_id: z.uuid().optional().openapi({ description: 'Temporada de la medalla; sin esto, es de carrera' }),
  })
  .openapi('MedalBody');

export const SteamUnlinked = z
  .object({ steam_id: z.string(), last_nick: z.string().nullable(), matches: z.number().int(), last_played: z.string().nullable() })
  .openapi('SteamUnlinked');

// IPs de una ficha (replanteo 38, plan docs/bitacora/2026-10-29-ips-jugadores). Solo admin.
export const PlayerIp = z
  .object({
    ip: z.string(),
    steam_id: z.string().openapi({ description: 'SteamID64 de la ficha desde el que entró' }),
    first_seen_at: z.string(),
    last_seen_at: z.string(),
    times: z.number().int().openapi({ description: 'Veces que entró al servidor con ese SteamID desde esa IP' }),
    last_nick: z.string().nullable().openapi({ description: 'Nick con el que entró la última vez' }),
    others: z.array(z.object({ id: z.uuid(), alias: z.string() })).openapi({ description: 'Otras fichas que entraron desde la misma IP' }),
    others_unlinked: z.number().int().openapi({ description: 'SteamID sin ficha que entraron desde la misma IP' }),
  })
  .openapi('PlayerIp');
export const PlayerIpList = z.object({ items: z.array(PlayerIp) }).openapi('PlayerIpList');

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
    streamer: z.boolean().openapi({ description: 'Tiene la marca de streamer del HUD' }),
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

const reason = z.string().trim().max(300).optional().openapi({ description: 'Motivo (opcional): lo ve el líder en el aviso y queda en el historial' });

export const AdminTeamPatch = z
  .object({
    name: z.string().trim().min(2).max(40).optional(),
    tag: z.string().trim().min(1).max(6).transform((v) => v.toUpperCase()).optional(),
    captain_player_id: z.uuid().optional().openapi({ description: 'Nuevo líder, del plantel y con cuenta (solo admin)' }),
    force,
    reason,
  })
  .refine((o) => o.name !== undefined || o.tag !== undefined || o.captain_player_id !== undefined, { message: 'No hay nada para actualizar.' })
  .openapi('AdminTeamPatch');

export const MemberBody = z
  .object({ player_id: z.uuid(), role: z.enum(['player', 'sub', 'coach']).default('player'), reason })
  .openapi('MemberBody');

export const RoleBody = z.object({ role: z.enum(['player', 'sub', 'coach']), reason }).openapi('RoleBody');

export const ReasonBody = z.object({ reason }).openapi('ReasonBody');

export const AdminTeamQuery = listQuery(['name', 'last_change', 'members'], { sort: 'name', order: 'asc' }).extend({
  q: z.string().max(60).optional().openapi({ description: 'Busca en el nombre, la sigla y los jugadores del plantel' }),
  filter: z.enum(['blocked', 'incomplete', 'no_leader', 'in_event']).optional().openapi({
    description: '`blocked`: nombre o sigla con una palabra bloqueada; `incomplete`: menos de 5 jugadores o suplentes; `no_leader`: sin líder; `in_event`: inscrito en un torneo abierto o en curso',
  }),
});

export const AdminTeamRow = z
  .object({
    id: z.uuid(),
    name: z.string(),
    tag: z.string().nullable(),
    logo_url: z.string().nullable(),
    founded_at: z.string().nullable(),
    captain: z.object({ player_id: z.uuid(), alias: z.string() }).nullable(),
    members: z.number().int(),
    players: z.number().int().openapi({ description: 'Jugadores y suplentes (sin el coach)' }),
    events_active: z.number().int().openapi({ description: 'Torneos abiertos o en curso en los que está inscrito' }),
    blocked: z.boolean().openapi({ description: 'El nombre o la sigla tiene una palabra bloqueada' }),
    last_change_at: z.string().nullable(),
  })
  .openapi('AdminTeamRow');
export const AdminTeamList = Envelope(AdminTeamRow).openapi('AdminTeamList');

export const TeamAuditEntry = z
  .object({
    id: z.number().int(),
    at: z.string(),
    actor: z.object({ user_id: z.uuid().nullable(), alias: z.string().nullable() }),
    actor_role: z.enum(['team', 'moderator', 'admin', 'system']),
    action: z.string().openapi({
      description: '`created`, `renamed`, `logo_changed`, `logo_removed`, `captain_changed`, `member_added`, `member_removed`, `member_left`, `role_changed` o `dissolved`',
    }),
    data: z.record(z.string(), z.unknown()).openapi({ description: 'Detalle: nombres de antes y después, jugador, rol…' }),
    reason: z.string().nullable(),
  })
  .openapi('TeamAuditEntry');
export const TeamAuditQuery = listQuery(['at'], { sort: 'at', order: 'desc' });
export const TeamAuditList = Envelope(TeamAuditEntry).openapi('TeamAuditList');

export const RankingConfig = z
  .object({
    win_official: z.number().int().min(0).max(1000).openapi({ description: 'Puntos por partida de torneo ganada' }),
    win_pcw: z.number().int().min(0).max(1000).openapi({ description: 'Puntos por PCW ganada (jugada como el equipo)' }),
  })
  .openapi('RankingConfig');

export const IdParam = z.object({ id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }) });
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
  streamer: boolParam('Con o sin la marca de streamer del HUD'),
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

