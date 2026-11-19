import { z } from '@hono/zod-openapi';
import { boolParam, Envelope, listQuery } from '../lib/list';
import { confirmField } from './common';
import { FeaturedClip } from './clips';
import { MedalDesign } from './medals';
import { EloPoint, IdParam, LEVEL_RANGES, TeamRef } from './players';

// Temporadas: ranking, medallas por tramo y reinicio del nivel 10 (plan docs/bitacora/2026-10-20-temporadas).
// Los rangos son los de season_check y set_season_config (replanteo 24).

const int = (min: number, max: number, description: string) =>
  z.number().int().min(min, `Entre ${min} y ${max}`).max(max, `Entre ${min} y ${max}`).openapi({ description });

export const SeasonTier = z
  .object({
    from: z.number().int().min(1).openapi({ description: 'Desde este puesto' }),
    to: z.number().int().min(1).nullable().openapi({ description: 'Hasta este puesto; `null` en el último tramo (llega hasta el top N)' }),
    name: z.string().trim().min(1).max(40).openapi({ description: 'Nombre de la medalla. `{top}` se reemplaza por el top N ("Top {top}" → "Top 20")' }),
    definition: z
      .string()
      .regex(/^[a-z0-9_]{2,60}$/)
      .nullable()
      .optional()
      .openapi({ description: 'Clave de la medalla de temporada que reciben (replanteo 79). Reemplaza al emoji' }),
    icon: z.string().trim().min(1).max(8).nullable().optional().openapi({ description: 'Emoji de los tramos viejos; no se muestra' }),
  })
  .refine((t) => !!t.definition || !!t.icon, { message: 'Cada tramo lleva una medalla', path: ['definition'] })
  .openapi('SeasonTier');

/** Lo mismo que season_tiers_ok: en orden desde el puesto 1, sin huecos, y solo el último sin `to`. */
export const SeasonTiers = z
  .array(SeasonTier)
  .min(1)
  .max(20)
  .superRefine((tiers, ctx) => {
    let next = 1;
    tiers.forEach((t, i) => {
      const last = i === tiers.length - 1;
      if (t.from !== next) ctx.addIssue({ code: 'custom', path: [i, 'from'], message: `Tiene que empezar en el puesto ${next}` });
      if (last && t.to !== null) ctx.addIssue({ code: 'custom', path: [i, 'to'], message: 'El último tramo no tiene "hasta": llega hasta el top' });
      if (!last && (t.to === null || t.to < t.from)) ctx.addIssue({ code: 'custom', path: [i, 'to'], message: 'Tiene que ser un puesto igual o mayor que "desde"' });
      next = (t.to ?? t.from) + 1;
    });
  })
  .openapi({ description: 'Tramos de medallas, en orden' });

const params = {
  top_n: int(1, 500, 'Cuántos reciben medalla'),
  min_matches: int(1, 1000, 'Mixes jugados en la temporada para entrar al ranking'),
  reset_pct: int(0, 100, 'Porcentaje de lo que tenía sobre el piso que conserva un nivel 10 al reiniciar (0 = vuelve al piso)'),
  reset_floor: int(0, 10000, 'Piso del reinicio (el inicio del nivel 10)'),
};
const resetAll = z
  .boolean()
  .openapi({ description: 'El reinicio incluye a los que están debajo del piso: suben hacia el piso con el mismo porcentaje. Con `reset_pct` 0, todos quedan en el piso (reinicio total)' });

export const SeasonConfig = z
  .object({
    duration_days: int(1, 365, 'Duración por defecto de la próxima temporada, en días'),
    ...params,
    reset_all: resetAll.default(false),
    tiers: SeasonTiers,
  })
  .openapi('SeasonConfig');
export const SeasonConfigRead = SeasonConfig.extend({ updated_at: z.string().nullable() }).openapi('SeasonConfigRead');

const PlayerRef = z.object({ id: z.uuid(), alias: z.string() });

export const Season = z
  .object({
    id: z.uuid(),
    number: z.number().int(),
    name: z.string(),
    status: z.enum(['active', 'closed']),
    starts_at: z.string(),
    ends_at: z.string().openapi({ description: 'Fin planeado (06:00 de Argentina por defecto). El cron la cierra al llegar' }),
    closed_at: z.string().nullable(),
    ...params,
    reset_all: resetAll,
    tiers: z.array(SeasonTier),
    champion: PlayerRef.nullable().openapi({ description: 'Puesto 1 de la foto final; `null` mientras está activa' }),
    medals: z.number().int(),
  })
  .openapi('Season');
export const SeasonQuery = listQuery(['number'], { sort: 'number', order: 'desc' }).extend({
  status: z.enum(['active', 'closed']).optional(),
});
export const SeasonList = Envelope(Season).openapi('SeasonList');

const Medal = z
  .object({
    name: z.string(),
    // El dibujo de la medalla del tramo (replanteo 79); null si el tramo no tiene definición. Unión para que el tipo
    // generado sea "X | null".
    design: z.union([MedalDesign, z.null()]),
  })
  .nullable()
  .openapi({ description: '`null`: sin medalla' });

export const Standing = z
  .object({
    rank: z.number().int().nullable().openapi({ description: '`null`: todavía no llega al mínimo de mixes' }),
    player: PlayerRef.extend({ photo_url: z.string().nullable() }),
    eligible: z.boolean(),
    elo: z.number().int(),
    level: z.number().int().nullable(),
    peak_elo: z.number().int().openapi({ description: 'Pico de la temporada' }),
    matches: z.number().int().openapi({ description: 'Mixes de la temporada' }),
    wins: z.number().int(),
    losses: z.number().int(),
    elo_after: z.number().int().openapi({ description: 'ELO después del reinicio (en la activa: si cerrara ahora)' }),
    medal: Medal,
    teams: z.array(TeamRef).openapi({ description: 'Equipos oficiales actuales (también en las temporadas cerradas)' }),
    rating: z.number().nullable().openapi({ description: 'Rating de los mixes de la temporada; `null` sin mixes' }),
    kd: z.number().nullable().openapi({ description: 'K/D de los mixes de la temporada; `null` sin mixes' }),
  })
  .openapi('SeasonStanding');
export const StandingQuery = listQuery(['rank', 'elo', 'matches', 'alias', 'rating', 'kd'], { sort: 'rank', order: 'asc' }).extend({
  q: z.string().max(60).optional().openapi({ description: 'Busca en el alias' }),
  eligible: boolParam('`true` solo los que llegan al mínimo de mixes'),
  level: z.enum(LEVEL_RANGES).optional().openapi({ description: 'Nivel según el ELO de la temporada: `10`, `7-9` o `1-6`' }),
  team: z.uuid().optional().openapi({ description: 'Jugadores activos de un equipo oficial' }),
});
export const StandingList = Envelope(Standing).openapi('SeasonStandingList');

export const PlayerSeason = Standing.omit({ player: true, teams: true, rating: true, kd: true })
  .extend({
    season: z.object({
      id: z.uuid(),
      number: z.number().int(),
      name: z.string(),
      ended_at: z.string().nullable().openapi({ description: 'Cuándo cerró la temporada' }),
      players: z.number().int().openapi({ description: 'Cuántos jugadores tuvieron puesto en el ranking final ("#3 de 214")' }),
    }),
    has_recap: z.boolean().openapi({ description: 'Si tiene recap de esa temporada (replanteo 128): el botón "Recap"' }),
  })
  .openapi('PlayerSeason');
export const PlayerSeasonQuery = listQuery(['number'], { sort: 'number', order: 'desc' });
export const PlayerSeasonList = Envelope(PlayerSeason).openapi('PlayerSeasonList');

export const SeasonIdParam = z.object({ id: z.uuid().openapi({ param: { name: 'id', in: 'path' } }) });

const endsAt = z.iso.datetime({ offset: true }).openapi({ description: 'Fecha de fin (futura)' });
export const SeasonCreate = z
  .object({
    name: z.string().trim().min(1).max(60).optional().openapi({ description: 'Por defecto "Temporada N"' }),
    ends_at: endsAt.optional().openapi({ description: 'Por defecto, a la duración de la configuración, a las 06:00 de Argentina' }),
  })
  .openapi('SeasonCreate');
export const SeasonPatch = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    ends_at: endsAt.optional(),
    top_n: params.top_n.optional(),
    min_matches: params.min_matches.optional(),
    reset_pct: params.reset_pct.optional(),
    reset_floor: params.reset_floor.optional(),
    reset_all: resetAll.optional(),
    tiers: SeasonTiers.optional(),
  })
  .openapi('SeasonPatch');

export const SeasonCloseBody = z.object({ confirm: confirmField('terminar la temporada') }).openapi('SeasonClose');
export const SeasonClosed = z
  .object({
    season_id: z.uuid(),
    next_season_id: z.uuid().openapi({ description: 'La temporada que se abrió' }),
    medals: z.number().int(),
    reset: z.number().int().openapi({ description: 'Jugadores que se reiniciaron' }),
    closed_at: z.string(),
  })
  .openapi('SeasonClosed');

const qint = (min: number, max: number, description: string) =>
  z.coerce.number().int().min(min, `Entre ${min} y ${max}`).max(max, `Entre ${min} y ${max}`).openapi({ description });
export const PreviewQuery = listQuery(['rank', 'elo', 'alias'], { sort: 'rank', order: 'asc' }).extend({
  top_n: qint(1, 500, 'Top N'),
  min_matches: qint(1, 1000, 'Mínimo de mixes'),
  reset_pct: qint(0, 100, 'Porcentaje que conserva'),
  reset_floor: qint(0, 10000, 'Piso del reinicio'),
  reset_all: boolParam('`true`: el reinicio incluye a los que están debajo del piso'),
  q: z.string().max(60).optional().openapi({ description: 'Busca en el alias' }),
  reset: boolParam('`true` solo los que se reinician (nivel 10)'),
  medal: boolParam('`true` solo los que reciben medalla'),
});
export const PreviewRow = z
  .object({
    rank: z.number().int().nullable(),
    player: PlayerRef,
    eligible: z.boolean(),
    elo: z.number().int(),
    matches: z.number().int(),
    medal: Medal,
    elo_after: z.number().int(),
    reset: z.boolean().openapi({ description: 'El reinicio le cambia el ELO (está sobre el piso o, con `reset_all`, no está en el piso)' }),
  })
  .openapi('SeasonPreviewRow');
export const SeasonPreview = Envelope(PreviewRow)
  .extend({
    summary: z.object({
      players: z.number().int(),
      eligible: z.number().int().openapi({ description: 'Llegan al mínimo de mixes' }),
      medals: z.number().int(),
      reset: z.number().int().openapi({ description: 'Jugadores que se reinician' }),
      avg_drop: z.number().openapi({ description: 'Cuánto bajan en promedio los que se reinician (con `reset_all` puede ser negativo: los de debajo del piso suben)' }),
      max_drop: z.number().int(),
    }),
  })
  .openapi('SeasonPreview');

// ---------- estadísticas de la temporada: recap y resumen global (replanteo 128, bitácora 2026-11-19-estadisticas-de-temporada) ----------
// Temporada cerrada: la foto del cierre, para todos. Activa: al momento, solo admins (`live: true`).

const SeasonNumber = z.coerce.number().int().min(1).openapi({ param: { name: 'number', in: 'path' }, description: 'Número de la temporada', example: 1 });
export const SeasonNumberParam = z.object({ number: SeasonNumber });
export const RecapParam = IdParam.extend({ number: SeasonNumber });

const n = z.number();
const whole = z.number().int();
const Person = PlayerRef.extend({
  photo_url: z.string().nullable(),
  level: whole.nullable(),
  elo: whole.openapi({ description: 'ELO de su último mix de la temporada' }),
  kd: n,
  matches: whole.openapi({ description: 'Mixes de la temporada' }),
}).openapi('RecapPerson');
const Mate = Person.extend({ together: whole.openapi({ description: 'Mixes en el mismo equipo' }), won: whole.openapi({ description: 'Ganados juntos' }) });
const Rival = Person.extend({ you_killed: whole, killed_you: whole });
const SeasonHead = z.object({
  id: z.uuid(),
  number: whole,
  name: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  closed_at: z.string().nullable().openapi({ description: '`null` mientras está activa' }),
  until: z.string().openapi({ description: 'Hasta cuándo cuentan los mixes: el cierre, o el momento de la consulta si está activa' }),
});

export const RECAP_STATS = [
  'matches', 'rounds', 'hours', 'win_pct', 'best_streak', 'kills', 'deaths', 'assists', 'kd', 'hs_pct', 'adr', 'k3',
  'first_kills', 'k4', 'aces', 'elo_delta', 'rating',
] as const;
const Compare = z.object(Object.fromEntries(RECAP_STATS.map((k) => [k, z.object({ avg: n, pct: whole })])) as Record<
  (typeof RECAP_STATS)[number],
  z.ZodObject<{ avg: z.ZodNumber; pct: z.ZodNumber }>
>);

export const SeasonRecap = z
  .object({
    live: z.boolean().openapi({ description: '`true`: temporada activa, calculado al momento (solo admins)' }),
    season: SeasonHead.extend({ players: whole.openapi({ description: 'Jugadores con al menos 1 mix' }) }),
    player: Person,
    mixes: z.object({ matches: whole, rounds: whole, hours: n, busiest_day: z.object({ date: z.string(), matches: whole }).nullable() }),
    record: z.object({ wins: whole, losses: whole, win_pct: whole, best_streak: whole.openapi({ description: 'Racha de victorias más larga' }) }),
    elo: z.object({ start: whole, end: whole, peak: whole, delta: whole, points: z.array(EloPoint) }),
    numbers: z.object({
      kills: whole, deaths: whole, assists: whole, kd: n, hs_pct: whole, adr: n, k3: whole, k4: whole, aces: whole, first_kills: whole,
      plants: whole, defuses: whole, rating: n.nullable(),
    }),
    weapon: z.object({ name: z.string(), kills: whole, hs_pct: whole, share_pct: whole }).nullable().openapi({ description: 'Por ahora siempre `null` (sin `match_kills`)' }),
    maps: z.array(z.object({ name: z.string(), matches: whole, wins: whole, kd: n })),
    best_match: z
      .object({
        id: z.uuid(), map: z.string().nullable(), date: z.string(), score: z.array(whole).length(2).openapi({ description: '[su equipo, el rival]' }),
        won: z.boolean(), kills: whole, deaths: whole, adr: n, rating: n.nullable(),
      })
      .nullable(),
    mates: z.object({ most_played: Mate, most_wins: Mate }).nullable(),
    rivals: z.object({ victim: Rival.nullable(), nemesis: Rival.nullable() }).nullable().openapi({ description: 'Por ahora siempre `null` (sin `match_kills`)' }),
    clips: z.array(FeaturedClip).openapi({ description: 'Hasta 3: primero sus destacados, después por la escala (ace, 4K, clutch, 3K)' }),
    compare: Compare.openapi({ description: 'Promedio de la temporada y percentil (qué parte de los demás quedó por debajo; en muertes, por arriba)' }),
    prev: z.object({ name: z.string(), kd: n, adr: n, hs_pct: whole, win_pct: whole, rank: whole.nullable() }).nullable(),
    final: z.object({
      rank: whole.nullable(), eligible: z.boolean(), total_ranked: whole, elo: whole, level: whole.nullable(), medal: Medal,
      top_n: whole, min_matches: whole,
    }),
  })
  .openapi('SeasonRecap');

// El resumen habla de la web y del matchmaking, no de los jugadores (Kyan, 2026-11-19): sin líderes ni podio.
const Count = z.object({ matches: whole });
export const SeasonSummary = z
  .object({
    live: z.boolean().openapi({ description: '`true`: temporada activa, calculado al momento (solo admins)' }),
    season: SeasonHead.extend({ status: z.enum(['active', 'closed']), min_matches: whole, top_n: whole }),
    games: z
      .object({
        mixes: whole, players: whole, rounds: whole, hours: n, avg_minutes: whole.nullable(), kills: whole, hs_pct: whole,
        aces: whole, k4: whole, plants: whole, defuses: whole,
      })
      .openapi({ description: 'Los mixes que contaron para el ranking' }),
    when: z
      .object({
        busiest_day: z.object({ date: z.string(), matches: whole }).nullable(),
        by_hour: z.array(Count.extend({ hour: whole })).openapi({ description: 'Mixes por hora de inicio (0 a 23, hora de Argentina)' }),
        by_weekday: z.array(Count.extend({ day: whole })).openapi({ description: 'Mixes por día de la semana (1 = lunes … 7 = domingo)' }),
      }),
    maps: z.array(z.object({ name: z.string(), matches: whole, avg_rounds: n })),
    servers: z.array(z.object({ name: z.string(), matches: whole })),
    longest: z.object({ match_id: z.uuid(), map: z.string().nullable(), date: z.string(), score1: whole, score2: whole }).nullable(),
    matchmaking: z.object({
      queue_joins: whole.openapi({ description: 'Veces que alguien entró a la cola' }),
      queue_players: whole.openapi({ description: 'Cuentas distintas que buscaron partida' }),
      matched: whole.openapi({ description: 'Entradas a la cola que terminaron en una sala' }),
      left: whole.openapi({ description: 'Entradas que salieron sin sala (se fue, canceló o se desconectó)' }),
      wait_median_s: whole.nullable().openapi({ description: 'Espera mediana hasta la sala, en segundos' }),
      lobbies: whole, played: whole, cancelled: whole,
      cancel_reasons: z.array(z.object({ reason: z.string(), count: whole })),
      party_pct: whole.openapi({ description: '% de los lugares en salas que llegaron en grupo' }),
      abandons: whole, replacements: whole, reports: whole, penalties: whole, bans: whole,
    }),
    community: z.object({
      new_accounts: whole, profile_visits: whole, comments: whole, friendships: whole, clips: whole, clips_video: whole,
      demos: whole, pcw: whole, official: whole, tournaments: whole,
    }),
  })
  .openapi('SeasonSummary');
