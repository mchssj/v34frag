import { z } from '@hono/zod-openapi';
import { boolParam, Envelope, listQuery } from '../lib/list';
import { confirmField } from './common';
import { LEVEL_RANGES, TeamRef } from './players';

// Temporadas: ranking, medallas por tramo y reinicio del nivel 10 (plan docs/bitacora/2026-10-20-temporadas).
// Los rangos son los de season_check y set_season_config (replanteo 24).

const int = (min: number, max: number, description: string) =>
  z.number().int().min(min, `Entre ${min} y ${max}`).max(max, `Entre ${min} y ${max}`).openapi({ description });

export const SeasonTier = z
  .object({
    from: z.number().int().min(1).openapi({ description: 'Desde este puesto' }),
    to: z.number().int().min(1).nullable().openapi({ description: 'Hasta este puesto; `null` en el último tramo (llega hasta el top N)' }),
    name: z.string().trim().min(1).max(40).openapi({ description: 'Nombre de la medalla. `{top}` se reemplaza por el top N ("Top {top}" → "Top 20")' }),
    icon: z.string().trim().min(1).max(8).openapi({ description: 'Un emoji' }),
  })
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

const Medal = z.object({ name: z.string(), icon: z.string() }).nullable().openapi({ description: '`null`: sin medalla' });

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
  .extend({ season: z.object({ id: z.uuid(), number: z.number().int(), name: z.string() }) })
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
