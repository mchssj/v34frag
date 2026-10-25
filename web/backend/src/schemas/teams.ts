import { z } from '@hono/zod-openapi';
import { boolParam, Envelope, listQuery } from '../lib/list';
import { TeamRef } from './players';

export const MAX_ROSTER = 10;

export const TeamListQuery = listQuery(['name', 'members'], { sort: 'name', order: 'asc' }).extend({
  kind: z.enum(['official', 'pcw']).default('official').openapi({ description: '`official` (por defecto) o `pcw`' }),
  q: z.string().max(60).optional().openapi({ description: 'Busca en el nombre y la sigla, sin distinguir mayúsculas ni tildes' }),
  has_space: boolParam('`true`: equipos oficiales con lugar (menos de 10 jugadores)'),
});

const PlayerRef = z
  .object({ player_id: z.uuid(), alias: z.string() })
  .openapi('PlayerRef');

export const TeamSummary = z
  .object({
    id: z.uuid(),
    name: z.string(),
    tag: z.string().nullable(),
    kind: z.enum(['official', 'pcw']),
    captain: PlayerRef.nullable().openapi({ description: 'null si el capitán no tiene jugador vinculado' }),
    members: z.number().int().openapi({ description: `Jugadores activos (máximo ${MAX_ROSTER} en un equipo oficial)` }),
    max_members: z.number().int().nullable().openapi({ description: `${MAX_ROSTER} en los oficiales; null en los bandos de PCW` }),
    plays_as: z.uuid().nullable().openapi({ description: 'Bandos de PCW: equipo oficial con el que juega (suma al ranking)' }),
  })
  .openapi('TeamSummary');

export const TeamList = Envelope(TeamSummary).openapi('TeamList');

export const RosterEntry = z
  .object({
    player_id: z.uuid(),
    alias: z.string(),
    photo_url: z.string().nullable(),
    has_steam: z.boolean(),
    elo: z.number().int().nullable(),
    level: z.number().int().nullable(),
    role: z.string().openapi({ description: '`player`, `sub` o `coach`' }),
    is_captain: z.boolean(),
    joined_at: z.string().nullable(),
    left_at: z.string().nullable(),
  })
  .openapi('RosterEntry');

export const MemberQuery = listQuery(['alias', 'joined_at', 'left_at', 'elo'], { sort: 'alias', order: 'asc' }).extend({
  active: boolParam('`true` el plantel actual; `false` los ex integrantes'),
  role: z.enum(['player', 'sub', 'coach']).optional(),
});
export const MemberList = Envelope(RosterEntry).openapi('MemberList');

export const Record_ = z
  .object({
    official: z.object({ played: z.number().int(), won: z.number().int(), lost: z.number().int(), points: z.number().int() }),
    pcw: z.object({ played: z.number().int(), won: z.number().int(), lost: z.number().int(), points: z.number().int() }),
  })
  .openapi('TeamRecord');

export const TeamDetail = TeamSummary.extend({
  record: Record_.nullable().openapi({ description: 'Récord del ranking (solo equipos oficiales)' }),
  viewer: z
    .object({ is_captain: z.boolean(), is_member: z.boolean(), is_admin: z.boolean() })
    .nullable()
    .openapi({ description: 'Qué puede hacer quien consulta (null sin sesión)' }),
}).openapi('TeamDetail', {
  description: 'El plantel y los ex integrantes van en /teams/{id}/members; las partidas, en /matches?team={id}',
});

export const Invite = z
  .object({
    id: z.uuid(),
    kind: z.enum(['invite', 'request']).openapi({ description: '`invite`: el capitán invitó; `request`: el jugador pidió entrar' }),
    status: z.string(),
    team: TeamRef,
    player: z.object({ id: z.uuid(), alias: z.string(), photo_url: z.string().nullable() }),
    created_at: z.string(),
    expires_at: z.string(),
  })
  .openapi('Invite');

export const InviteQuery = listQuery(['created_at', 'expires_at'], { sort: 'created_at', order: 'desc' }).extend({
  kind: z.enum(['invite', 'request']).optional().openapi({ description: '`invite` (invitaciones del capitán) o `request` (pedidos para entrar)' }),
  team: z.uuid().optional(),
});
export const InviteList = Envelope(Invite).openapi('InviteList');

export const InviteBody = z
  .object({
    player_id: z.uuid().optional(),
    alias: z.string().trim().min(2).max(24).optional(),
  })
  .refine((b) => !!b.player_id !== !!b.alias, { message: 'Mandá `player_id` o `alias` (uno solo).' })
  .openapi('InviteBody');

export const CaptainBody = z.object({ player_id: z.uuid() }).openapi('CaptainBody');

export const Created = z.object({ id: z.uuid() }).openapi('Created');

export const TeamParam = z.object({ id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }) });
export const TeamPlayerParam = TeamParam.extend({
  playerId: z.uuid().openapi({ param: { name: 'playerId', in: 'path' } }),
});

export const TeamRequestBody = z
  .object({
    name: z.string().trim().min(2).max(40).openapi({ example: 'Titanes' }),
    tag: z
      .string()
      .trim()
      .min(1)
      .max(6)
      .transform((v) => v.toUpperCase())
      .openapi({ example: 'TIT', description: 'Sigla (se guarda en mayúsculas)' }),
  })
  .openapi('TeamRequestBody');

export const TeamRequest = z
  .object({
    name: z.string(),
    tag: z.string().nullable(),
    status: z.enum(['pending', 'approved', 'rejected']),
  })
  .openapi('TeamRequest');

// ---------- ranking ----------

export const RankingQuery = listQuery(['points', 'won', 'played', 'name'], { sort: 'points', order: 'desc' }).extend({
  pcw: z
    .enum(['0', '1'])
    .default('0')
    .transform((v) => v === '1')
    .openapi({ type: 'string', enum: ['0', '1'], description: '`1` suma también las PCW jugadas como el equipo' }),
  q: z.string().max(60).optional().openapi({ description: 'Busca en el nombre y la sigla' }),
});

export const RankingItem = z
  .object({
    position: z.number().int().openapi({ description: 'Posición (empatados en puntos, victorias y derrotas comparten posición)' }),
    team: TeamRef,
    played: z.number().int(),
    won: z.number().int(),
    lost: z.number().int(),
    points: z.number().int(),
    win_rate: z.number().nullable().openapi({ description: '% de victorias (0 a 100). null sin partidas' }),
    trend: z.number().int().nullable().openapi({
      description: 'Puestos que subió (positivo) o bajó (negativo) desde hace 30 días. null si hace 30 días no tenía partidas en este modo',
    }),
    form: z.array(z.enum(['W', 'L'])).openapi({ description: 'Últimos 5 resultados en este modo, del más viejo al más nuevo' }),
  })
  .openapi('RankingItem');

export const Ranking = Envelope(RankingItem)
  .extend({
    pcw: z.boolean(),
    points_per_win: z.object({
      official: z.number().int().openapi({ description: 'Puntos por partida de torneo ganada' }),
      pcw: z.number().int().openapi({ description: 'Puntos por PCW ganada' }),
    }),
  })
  .openapi('Ranking');

// ---------- alias ----------

export const AliasBody = z
  .object({ alias: z.string().trim().min(2).max(24).openapi({ example: 'Mecha' }) })
  .openapi('AliasBody');

export const AliasResult = z
  .object({
    alias: z.string(),
    changed_at: z.string().nullable(),
    next_change_at: z.string().nullable().openapi({ description: 'Desde cuándo puede volver a cambiarlo (15 días después del último cambio)' }),
  })
  .openapi('AliasResult');

export const AliasParam = z.object({ alias: z.string().max(100).openapi({ param: { name: 'alias', in: 'path' } }) });

export const AliasAvailability = z
  .object({
    alias: z.string(),
    available: z.boolean(),
    reason: z
      .enum(['length', 'chars', 'blocked', 'taken'])
      .nullable()
      .openapi({ description: '`length` (2 a 24), `chars` (sin < ni >), `blocked` (palabra no permitida) o `taken` (en uso)' }),
  })
  .openapi('AliasAvailability');
