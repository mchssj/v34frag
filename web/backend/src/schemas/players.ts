import { z } from '@hono/zod-openapi';
import { boolParam, dateParam, Envelope, listQuery } from '../lib/list';
import { Clutches } from './common';

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
    vip: z.boolean().openapi({ description: 'Es VIP hoy (solo el estado; las fechas, en Mi perfil y en el admin)' }),
  })
  .openapi('PlayerSummary');

export const PlayerList = Envelope(PlayerSummary).openapi('PlayerList');

export const PlayerStats = z
  .object({
    maps: num, rounds: num, kills: num, deaths: num, assists: num, damage: num,
    rating: num, kd: num, hs: num, adr: num, wins: num, losses: num,
  })
  .openapi('PlayerStats');

// (replanteo 29) La ficha suma los totales de "Estilo de juego"; el perfil sin reclamar sigue con PlayerStats.
export const PlayerStatsDetail = PlayerStats.extend({
  k2: num, k3: num, k4: num, k5: num, first_kills: num, first_deaths: num, plants: num, defuses: num,
  clutches: Clutches.openapi({ description: 'Clutches ganados en mixes, con todos sus SteamID' }),
}).openapi('PlayerStatsDetail');

export const PlayerMapStats = z
  .object({ map: z.string(), maps: num, rating: num, kd: num, adr: num, wins: num, losses: num })
  .openapi('PlayerMapStats');
export const MapStatsQuery = listQuery(['maps', 'rating', 'kd', 'adr', 'wins'], { sort: 'maps', order: 'desc' }).extend({
  map: z.string().max(40).optional().openapi({ description: 'Mapa (contiene)' }),
});
export const PlayerMapStatsList = Envelope(PlayerMapStats).openapi('PlayerMapStatsList');

export const Medal = z
  .object({
    id: z.uuid(),
    title: z.string(),
    icon: z.string().nullable(),
    created_at: z.string(),
    season: z
      .object({ id: z.uuid(), number: z.number().int(), name: z.string() })
      .nullable()
      .openapi({ description: 'Temporada en la que la ganó; `null` en las medallas que da el admin a mano' }),
    rank: z.number().int().nullable().openapi({ description: 'Puesto en esa temporada' }),
  })
  .openapi('Medal');
export const MedalQuery = listQuery(['created_at', 'title'], { sort: 'created_at', order: 'desc' });
export const MedalList = Envelope(Medal).openapi('MedalList');

export const TeamStint = z
  .object({
    team: TeamRef,
    role: z.string().openapi({ description: '`player`, `sub` o `coach`' }),
    is_captain: z.boolean().openapi({ description: 'Es (o era) el líder del equipo' }),
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

// Baneo activo (plan docs/bitacora/2026-10-25-baneos-web). El resto de los baneos está en schemas/bans.ts.
export const ActiveBan = z
  .object({
    id: z.uuid(),
    reason: z.string(),
    created_at: z.string(),
    expires_at: z.string().nullable().openapi({ description: '`null`: permanente' }),
  })
  .openapi('ActiveBan', { description: 'Baneo activo en los servidores' });

export const PlayerDetail = PlayerSummary.extend({
  steam_id: z.string().nullable().openapi({ description: 'SteamID principal. Solo para el dueño y los admins: para los demás, null' }),
  steam_ids: z.array(z.string()).openapi({ description: 'Todos sus SteamID, el principal primero. Solo para el dueño y los admins: para los demás, vacío' }),
  bio: z.string().nullable(),
  achievements: z.string().nullable(),
  team_history_text: z.string().nullable().openapi({ description: 'Historial cargado a mano por el admin (texto libre)' }),
  privacy: z.enum(['public', 'private']),
  peak_elo: z.number().int().nullable(),
  stats: PlayerStatsDetail.nullable().openapi({ description: 'null si no jugó partidas terminadas' }),
  details: PublicDetails.nullable().openapi({ description: 'Datos personales. null si no tiene cuenta o si su perfil es privado' }),
  private: z.boolean().openapi({ description: 'true si los datos personales están ocultos por privacidad' }),
  ban: ActiveBan.nullable().openapi({ description: 'Baneo activo en los servidores; null si no está baneado. Historial: /players/{id}/bans' }),
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
    event: z.object({ id: z.uuid(), name: z.string() }).nullable().openapi({
      description: 'Torneo de la partida (en un mapa jugado con `!match`, el de su partida). null en mixes y PCW',
    }),
    label: z.string().nullable().openapi({ description: 'Fase en el torneo ("Final", "Grupo A · fecha 2"…). null fuera de un torneo' }),
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

/** Las rutas públicas de un jugador aceptan su id o su nick (sin distinguir mayúsculas). */
export const IdParam = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .openapi({ param: { name: 'id', in: 'path' }, description: 'Id de la ficha o su nick (sin distinguir mayúsculas)', example: 'Mecha' }),
});

// ---------- historial de ELO, palmarés y medallas agrupadas (plan docs/bitacora/2026-10-24-api-mixes-perfil-ranking) ----------

export const EloHistoryQuery = listQuery(['at'], { sort: 'at', order: 'desc' }).extend({
  per: z.coerce.number().int().min(1).max(100).default(30).openapi({ description: 'Elementos por página (máximo 100)' }),
});
export const EloPoint = z
  .object({
    match_id: z.uuid(),
    map: z.string().nullable(),
    at: z.string().nullable(),
    elo_before: num,
    elo_after: z.number().int(),
    elo_delta: num,
  })
  .openapi('EloPoint');
export const EloHistoryList = Envelope(EloPoint).openapi('EloHistoryList', {
  description: 'Un punto por mix que movió su ELO. Por defecto los 30 más recientes, del más nuevo al más viejo',
});

export const TITLE_RESULTS = ['champion', 'runner_up'] as const;
export const TitleQuery = listQuery(['at', 'event'], { sort: 'at', order: 'desc' }).extend({
  result: z.enum(TITLE_RESULTS).optional().openapi({ description: '`champion` o `runner_up`' }),
});
export const Title = z
  .object({
    event: z.object({ id: z.uuid(), name: z.string() }),
    result: z.enum(TITLE_RESULTS).openapi({ description: '`champion` (campeón) o `runner_up` (perdió la final)' }),
    team: TeamRef.openapi({ description: 'Equipo con el que estaba inscrito' }),
    at: z.string().nullable().openapi({ description: 'Fecha de la final (o del último partido, en una liga sin final)' }),
  })
  .openapi('Title');
export const TitleList = Envelope(Title).openapi('TitleList');

export const MedalSummaryQuery = listQuery(['count', 'last_at', 'title'], { sort: 'count', order: 'desc' });
export const MedalSummary = z
  .object({
    title: z.string(),
    icon: z.string().nullable(),
    count: z.number().int(),
    last_at: z.string().openapi({ description: 'La más reciente' }),
  })
  .openapi('MedalSummary');
export const MedalSummaryList = Envelope(MedalSummary).openapi('MedalSummaryList', {
  description: 'Medallas agrupadas por título e icono, con la cantidad. El detalle de cada una está en `/players/{id}/medals`',
});

// ---------- ranking de jugadores y comparador ----------

export const LEVEL_RANGES = ['10', '7-9', '1-6'] as const;
export const RankingPlayerQuery = listQuery(['position', 'rating', 'kd', 'matches'], { sort: 'position', order: 'asc' }).extend({
  q: z.string().max(60).optional().openapi({ description: 'Busca en el alias y en los equipos actuales' }),
  level: z.enum(LEVEL_RANGES).optional().openapi({ description: 'Nivel: `10`, `7-9` o `1-6`' }),
  team: z.uuid().optional().openapi({ description: 'Jugadores activos de un equipo oficial' }),
});
export const RankingPlayer = z
  .object({
    position: z.number().int().openapi({ description: 'Posición global por ELO (no cambia al filtrar; empatados comparten posición)' }),
    player: z.object({ id: z.uuid(), alias: z.string(), photo_url: z.string().nullable(), vip: z.boolean() }),
    level: z.number().int().min(1).max(10).nullable(),
    elo: z.number().int(),
    teams: z.array(TeamRef),
    rating: num,
    kd: num,
    matches: z.number().int().openapi({ description: 'Partidas terminadas (mixes, PCW y torneos)' }),
    elo_matches: z.number().int().openapi({ description: 'Mixes que movieron su ELO' }),
    country: z.string().nullable().openapi({ description: 'null si el perfil es privado o no tiene cuenta' }),
    game_role: z.string().nullable().openapi({ description: 'Puesto preferido; null si el perfil es privado o no tiene cuenta' }),
    elo_trend: z.array(z.number().int()).openapi({ description: 'ELO después de cada uno de sus últimos 30 mixes, del más viejo al más nuevo' }),
  })
  .openapi('RankingPlayer');
export const RankingPlayerList = Envelope(RankingPlayer).openapi('RankingPlayerList');

export const CompareQuery = z.object({
  a: z.string().trim().min(1).max(40).openapi({ description: 'Jugador A: id o nick' }),
  b: z.string().trim().min(1).max(40).openapi({ description: 'Jugador B: id o nick' }),
});
export const ComparePlayer = z
  .object({
    player: z.object({ id: z.uuid(), alias: z.string(), photo_url: z.string().nullable(), vip: z.boolean() }),
    teams: z.array(TeamRef),
    game_role: z.string().nullable(),
    level: z.number().int().min(1).max(10).nullable(),
    elo: z.number().int().nullable(),
    rating: num,
    kd: num,
    hs: num.openapi({ description: '% de kills con headshot' }),
    adr: num,
    win_rate: num.openapi({ description: '% de victorias (0 a 100)' }),
    matches: z.number().int().openapi({ description: 'Partidas terminadas' }),
    elo_matches: z.number().int(),
    elo_history: z.array(z.number().int()).openapi({ description: 'ELO después de cada uno de sus últimos 30 mixes, del más viejo al más nuevo' }),
  })
  .openapi('ComparePlayer');
export const Compare = z
  .object({
    a: ComparePlayer,
    b: ComparePlayer,
    together: z.object({
      same_team: z.object({ matches: z.number().int(), wins: z.number().int() }).openapi({ description: 'Mixes en el mismo bando y cuántos ganaron' }),
      against: z.object({ matches: z.number().int(), a_wins: z.number().int() }).openapi({ description: 'Mixes como rivales y cuántos ganó A' }),
    }),
  })
  .openapi('Compare');
