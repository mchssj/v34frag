import { z } from '@hono/zod-openapi';
import { boolParam, dateParam, Envelope, listQuery } from '../lib/list';

const num = z.number().nullable();

export const TeamRef = z
  .object({ id: z.uuid(), name: z.string(), tag: z.string().nullable() })
  .openapi('TeamRef');

export const PlayerListQuery = listQuery(['elo', 'alias', 'elo_matches', 'rating', 'kd', 'wins'], { sort: 'elo', order: 'desc' }).extend({
  q: z.string().max(60).optional().openapi({ description: 'Busca en el alias y en los equipos actuales, sin distinguir mayúsculas ni tildes' }),
  team: z.uuid().optional().openapi({ description: 'Jugadores activos de un equipo oficial' }),
  has_account: boolParam('Con o sin cuenta en la web'),
  has_steam: boolParam('Con o sin SteamID vinculado'),
  elo_min: z.coerce.number().int().optional(),
  elo_max: z.coerce.number().int().optional(),
});

export const PlayerSummary = z
  .object({
    id: z.uuid(),
    alias: z.string().openapi({ description: 'Alias de la cuenta, o el nick que puso el admin si no tiene cuenta' }),
    has_account: z.boolean(),
    has_steam: z.boolean().openapi({ description: 'Si tiene SteamID vinculado (hace falta para entrar a un equipo)' }),
    photo_url: z.string().nullable(),
    elo: z.number().int().nullable().openapi({ description: 'null si todavía no jugó con su SteamID' }),
    level: z.number().int().min(1).max(10).nullable().openapi({ description: 'Nivel 1 a 10 según el ELO' }),
    elo_matches: z.number().int(),
    maps: num,
    rating: num,
    kd: num,
    wins: num,
    losses: num,
    teams: z.array(TeamRef).openapi({ description: 'Equipos oficiales donde está hoy (puede ser más de uno)' }),
  })
  .openapi('PlayerSummary');

export const PlayerList = Envelope(PlayerSummary).openapi('PlayerList');

export const PlayerStats = z
  .object({
    maps: num, rounds: num, kills: num, deaths: num, assists: num, damage: num,
    rating: num, kd: num, hs: num, adr: num, wins: num, losses: num,
  })
  .openapi('PlayerStats');

export const PlayerMapStats = z
  .object({ map: z.string(), maps: num, rating: num, kd: num, adr: num, wins: num, losses: num })
  .openapi('PlayerMapStats');
export const MapStatsQuery = listQuery(['maps', 'rating', 'kd', 'adr', 'wins'], { sort: 'maps', order: 'desc' }).extend({
  map: z.string().max(40).optional().openapi({ description: 'Mapa (contiene)' }),
});
export const PlayerMapStatsList = Envelope(PlayerMapStats).openapi('PlayerMapStatsList');

export const Medal = z
  .object({ id: z.uuid(), title: z.string(), icon: z.string().nullable(), created_at: z.string() })
  .openapi('Medal');
export const MedalQuery = listQuery(['created_at', 'title'], { sort: 'created_at', order: 'desc' });
export const MedalList = Envelope(Medal).openapi('MedalList');

export const TeamStint = z
  .object({
    team: TeamRef,
    role: z.string().openapi({ description: '`player`, `sub` o `coach`' }),
    joined_at: z.string().nullable().openapi({ description: 'null en los planteles migrados (no había fecha)' }),
    left_at: z.string().nullable().openapi({ description: 'null = sigue en el equipo' }),
  })
  .openapi('TeamStint');
export const StintQuery = listQuery(['joined_at', 'left_at', 'name'], { sort: 'joined_at', order: 'desc' }).extend({
  active: boolParam('`true` solo los equipos actuales; `false`, los anteriores'),
});
export const TeamStintList = Envelope(TeamStint).openapi('TeamStintList');

export const PublicDetails = z
  .object({
    avatar_url: z.string().nullable(),
    real_name: z.string().nullable(),
    country: z.string().nullable(),
    game_role: z.string().nullable(),
    steam: z.string().nullable(),
    faceit: z.string().nullable(),
    discord: z.string().nullable(),
    joined_at: z.string().nullable(),
    last_seen: z.string().nullable(),
  })
  .openapi('PublicDetails');

export const PlayerDetail = PlayerSummary.extend({
  steam_id: z.string().nullable(),
  bio: z.string().nullable(),
  achievements: z.string().nullable(),
  team_history_text: z.string().nullable().openapi({ description: 'Historial cargado a mano por el admin (texto libre)' }),
  privacy: z.enum(['public', 'private']),
  peak_elo: z.number().int().nullable(),
  stats: PlayerStats.nullable().openapi({ description: 'null si no jugó partidas terminadas' }),
  details: PublicDetails.nullable().openapi({ description: 'Datos personales. null si no tiene cuenta o si su perfil es privado' }),
  private: z.boolean().openapi({ description: 'true si los datos personales están ocultos por privacidad' }),
}).openapi('PlayerDetail', {
  description: 'Stats por mapa, medallas, historial de equipos y partidas van en sus listados: /players/{id}/map-stats, /medals, /teams y /matches',
});

export const PlayerMatch = z
  .object({
    match_id: z.uuid(),
    kind: z.enum(['mix', 'pcw', 'official']),
    played_at: z.string().nullable(),
    map: z.string().nullable(),
    side1_name: z.string().nullable(),
    side2_name: z.string().nullable(),
    score1: num,
    score2: num,
    side: z.number().int().nullable().openapi({ description: 'Bando del jugador (1 o 2)' }),
    won: z.boolean().nullable().openapi({ description: 'null si empató' }),
    parent_match_id: z.uuid().nullable().openapi({ description: 'Partida de torneo o PCW a la que pertenece este mapa (`!match`)' }),
    game_nick: z.string().nullable().openapi({ description: 'Nombre que usó en el juego' }),
    kills: num, deaths: num, assists: num, headshots: num, damage: num, rounds: num, rating: num,
    elo_before: num, elo_after: num, elo_delta: num,
    demo_status: z.string().nullable(),
  })
  .openapi('PlayerMatch');

export const PlayerMatchQuery = listQuery(['played_at', 'rating', 'kills', 'elo_delta'], { sort: 'played_at', order: 'desc' }).extend({
  kind: z.enum(['mix', 'pcw', 'official']).optional(),
  result: z.enum(['won', 'lost', 'draw']).optional(),
  map: z.string().max(40).optional().openapi({ description: 'Mapa (contiene)' }),
  from: dateParam('Jugadas desde'),
  to: dateParam('Jugadas hasta'),
});
export const PlayerMatchList = Envelope(PlayerMatch).openapi('PlayerMatchList');

export const IdParam = z.object({ id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }) });
