import { createRoute, type z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { optionalUser, requireAdmin, requireUser } from '../lib/auth';
import { levelBounds, levelOf, must, mustHave, notFound, searchTerm } from '../lib/db';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { bearer, errorResponses, json } from '../schemas/common';
import { IdParam, type TeamRef } from '../schemas/players';
import { resolvePlayer } from '../services/players';
import {
  PlayerSeasonList,
  PlayerSeasonQuery,
  PreviewQuery,
  Season,
  SeasonCloseBody,
  SeasonClosed,
  SeasonConfig,
  SeasonConfigRead,
  SeasonCreate,
  SeasonIdParam,
  SeasonList,
  SeasonPatch,
  SeasonPreview,
  SeasonQuery,
  StandingList,
  StandingQuery,
  type SeasonTier,
} from '../schemas/seasons';

// Temporadas (plan docs/bitacora/2026-10-20-temporadas, replanteo 24). El cierre por fecha no tiene endpoint: lo hace
// el cron del VPS con la clave de servicio (scripts/season-tick.mts).

type C = Context<AppEnv>;
type Tier = z.infer<typeof SeasonTier>;
const SEASON = 'id, number, name, status, starts_at, ends_at, closed_at, top_n, min_matches, reset_pct, reset_floor, reset_all, tiers, champion_id, champion_nick, medals';
const STANDING = 'player_id, nick, photo_url, rank, eligible, elo, peak_elo, matches, wins, losses, elo_after, tier, icon, teams, rating, kd';
const CONFIG = 'duration_days, top_n, min_matches, reset_pct, reset_floor, reset_all, tiers, updated_at';

type SeasonRow = {
  id: string | null; number: number | null; name: string | null; status: string | null; starts_at: string | null;
  ends_at: string | null; closed_at: string | null; top_n: number | null; min_matches: number | null; reset_pct: number | null;
  reset_floor: number | null; reset_all: boolean | null; tiers: unknown; champion_id: string | null; champion_nick: string | null; medals: number | null;
};
/** Tramos como los guarda la base: el último puede venir sin `to`. */
const toTiers = (t: unknown): Tier[] => ((t ?? []) as Tier[]).map((x) => ({ ...x, to: x.to ?? null }));

const toSeason = (r: SeasonRow): z.infer<typeof Season> => ({
  id: r.id!,
  number: r.number!,
  name: r.name!,
  status: r.status as 'active' | 'closed',
  starts_at: r.starts_at!,
  ends_at: r.ends_at!,
  closed_at: r.closed_at,
  top_n: r.top_n!,
  min_matches: r.min_matches!,
  reset_pct: r.reset_pct!,
  reset_floor: r.reset_floor!,
  reset_all: !!r.reset_all,
  tiers: toTiers(r.tiers),
  champion: r.champion_id ? { id: r.champion_id, alias: r.champion_nick ?? '' } : null,
  medals: r.medals ?? 0,
});

type StandingRow = {
  player_id: string | null; nick: string | null; photo_url: string | null; rank: number | null; eligible: boolean | null;
  elo: number | null; peak_elo: number | null; matches: number | null; wins: number | null; losses: number | null;
  elo_after: number | null; tier: string | null; icon: string | null;
};
const medal = (tier: string | null, icon: string | null) => (tier ? { name: tier, icon: icon ?? '🏅' } : null);
const stats = (r: Omit<StandingRow, 'player_id' | 'nick' | 'photo_url'>) => ({
  rank: r.rank,
  eligible: !!r.eligible,
  elo: r.elo ?? 0,
  level: levelOf(r.elo),
  peak_elo: r.peak_elo ?? r.elo ?? 0,
  matches: r.matches ?? 0,
  wins: r.wins ?? 0,
  losses: r.losses ?? 0,
  elo_after: r.elo_after ?? r.elo ?? 0,
  medal: medal(r.tier, r.icon),
});

async function readSeason(c: C, id: string) {
  const row = must(await c.var.sb.from('season_list').select(SEASON).eq('id', id).maybeSingle());
  if (!row) throw notFound('esa temporada');
  return toSeason(row);
}

async function readConfig(c: C) {
  const row = must(await c.var.sb.from('season_config').select(CONFIG).eq('id', 1).maybeSingle());
  if (!row) throw notFound('la configuración de las temporadas');
  return { ...row, tiers: toTiers(row.tiers) };
}

// ---------- rutas públicas ----------

const list = createRoute({
  method: 'get', path: '/api/v1/seasons', tags: ['Temporadas'], middleware: [optionalUser] as const,
  summary: 'Temporadas',
  description: 'Todas las temporadas, la activa y las cerradas, con su campeón y la cantidad de medallas. Sin sesión.',
  request: { query: SeasonQuery },
  responses: { 200: { description: 'Temporadas', ...json(SeasonList) }, ...errorResponses(400, 401) },
});
const current = createRoute({
  method: 'get', path: '/api/v1/seasons/current', tags: ['Temporadas'], middleware: [optionalUser] as const,
  summary: 'Temporada activa',
  description: 'Fechas (para la cuenta regresiva), top N, mínimo de mixes, reinicio y tramos de medallas. 404 si no hay ninguna activa.',
  responses: { 200: { description: 'Temporada', ...json(Season) }, ...errorResponses(401, 404) },
});
const standings = createRoute({
  method: 'get', path: '/api/v1/seasons/{id}/standings', tags: ['Temporadas'], middleware: [optionalUser] as const,
  summary: 'Ranking de una temporada',
  description:
    'En vivo si está activa; la foto del cierre si está cerrada (no cambia aunque después se recalcule el ELO). ' +
    'Por defecto, por puesto: primero los que llegan al mínimo de mixes y después el resto por ELO.',
  request: { params: SeasonIdParam, query: StandingQuery },
  responses: { 200: { description: 'Ranking', ...json(StandingList) }, ...errorResponses(400, 401, 404) },
});
const playerSeasons = createRoute({
  method: 'get', path: '/api/v1/players/{id}/seasons', tags: ['Jugadores'], middleware: [optionalUser] as const,
  summary: 'Temporadas de un jugador',
  description: 'Su puesto, ELO, pico, mixes y medalla en cada temporada cerrada. La activa está en `/seasons/{id}/standings`.',
  request: { params: IdParam, query: PlayerSeasonQuery },
  responses: { 200: { description: 'Temporadas', ...json(PlayerSeasonList) }, ...errorResponses(400, 401) },
});

// ---------- admin ----------

const getConfig = createRoute({
  method: 'get', path: '/api/v1/admin/seasons/config', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Configuración de las temporadas',
  description: 'Valores por defecto con los que se abre la próxima temporada.',
  responses: { 200: { description: 'Configuración', ...json(SeasonConfigRead) }, ...errorResponses(401, 403) },
});
const putConfig = createRoute({
  method: 'put', path: '/api/v1/admin/seasons/config', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar la configuración de las temporadas',
  description: 'Vale para la próxima temporada que se abra. La activa se cambia con `PATCH /admin/seasons/{id}`.',
  request: { body: { required: true, ...json(SeasonConfig) } },
  responses: { 200: { description: 'Guardada', ...json(SeasonConfigRead) }, ...errorResponses(400, 401, 403) },
});
const create = createRoute({
  method: 'post', path: '/api/v1/admin/seasons', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Abrir una temporada',
  description:
    'Abre la primera temporada (o la siguiente, si no hay ninguna activa) con los valores de la configuración. ' +
    'Después, cada cierre abre la siguiente solo. 409 si ya hay una activa.',
  request: { body: { required: true, ...json(SeasonCreate) } },
  responses: { 201: { description: 'Temporada', ...json(Season) }, ...errorResponses(400, 401, 403, 409) },
});
const patch = createRoute({
  method: 'patch', path: '/api/v1/admin/seasons/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar la temporada activa',
  description: 'Nombre, fecha de fin y parámetros del cierre. Lo que no llega no cambia. Una temporada cerrada no se cambia.',
  request: { params: SeasonIdParam, body: { required: true, ...json(SeasonPatch) } },
  responses: { 200: { description: 'Temporada', ...json(Season) }, ...errorResponses(400, 401, 403, 404) },
});
const close = createRoute({
  method: 'post', path: '/api/v1/admin/seasons/{id}/close', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Terminar la temporada',
  description:
    'Cierra la temporada ya: foto del ranking, medallas al top N, reinicio (del nivel 10, o de todos con `reset_all`) y apertura de la siguiente. ' +
    'Pide `confirm: "estoy seguro"` (doble confirmación en el frontend). No se deshace.',
  request: { params: SeasonIdParam, body: { required: true, ...json(SeasonCloseBody) } },
  responses: { 200: { description: 'Cerrada', ...json(SeasonClosed) }, ...errorResponses(400, 401, 403, 404) },
});
const preview = createRoute({
  method: 'get', path: '/api/v1/admin/seasons/preview', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Vista previa del cierre',
  description:
    'Cómo quedaría el cierre de la temporada activa si fuera ahora, con los valores de la consulta (los tramos son los de la activa). ' +
    'No cambia nada. Cada página vuelve a calcular el ranking.',
  request: { query: PreviewQuery },
  responses: { 200: { description: 'Vista previa', ...json(SeasonPreview) }, ...errorResponses(400, 401, 403) },
});

export const seasons = createRouter()
  .openapi(list, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('season_list').select(SEASON, { count: 'exact' });
    if (p.status) q = q.eq('status', p.status);
    const { rows, total } = await runList<SeasonRow, typeof q>(q, p, {});
    return c.json(envelope(rows.map(toSeason), total, p), 200);
  })
  .openapi(current, async (c) => {
    const row = must(await c.var.sb.from('season_list').select(SEASON).eq('status', 'active').maybeSingle());
    if (!row) throw notFound('una temporada activa');
    c.header('Cache-Control', 'no-store');
    return c.json(toSeason(row), 200);
  })
  .openapi(standings, async (c) => {
    const { id } = c.req.valid('param');
    const p = c.req.valid('query');
    await readSeason(c, id);
    let q = c.var.sb.from('season_standings_list').select(STANDING, { count: 'exact' }).eq('season_id', id);
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    if (p.eligible !== undefined) q = q.eq('eligible', p.eligible);
    const lv = levelBounds(p.level);
    if (lv.gte !== undefined) q = q.gte('elo', lv.gte);
    if (lv.lt !== undefined) q = q.lt('elo', lv.lt);
    if (p.team) q = q.contains('teams', JSON.stringify([{ id: p.team }]));
    type Row = StandingRow & { teams: unknown; rating: number | null; kd: number | null };
    const { rows, total } = await runList<Row, typeof q>(q, p, { rank: ['rank', 'elo:desc'], alias: 'nick' }, 'player_id');
    return c.json(
      envelope(
        rows.map(({ player_id, nick, photo_url, teams, rating, kd, ...r }) => ({
          player: { id: player_id!, alias: nick ?? '', photo_url },
          ...stats(r),
          teams: Array.isArray(teams) ? (teams as z.infer<typeof TeamRef>[]) : [],
          rating: rating === null ? null : Number(rating),
          kd: kd === null ? null : Number(kd),
        })),
        total,
        p,
      ),
      200,
    );
  })
  .openapi(playerSeasons, async (c) => {
    const id = await resolvePlayer(c.var.sb, c.req.valid('param').id);
    const p = c.req.valid('query');
    const q = c.var.sb
      .from('player_season_list')
      .select('season_id, number, name, rank, eligible, elo, peak_elo, matches, wins, losses, elo_after, tier, icon', { count: 'exact' })
      .eq('player_id', id);
    type Row = Omit<StandingRow, 'player_id' | 'nick' | 'photo_url'> & { season_id: string | null; number: number | null; name: string | null };
    const { rows, total } = await runList<Row, typeof q>(q, p, {}, 'season_id');
    return c.json(
      envelope(
        rows.map(({ season_id, number, name, ...r }) => ({ season: { id: season_id!, number: number!, name: name ?? '' }, ...stats(r) })),
        total,
        p,
      ),
      200,
    );
  })
  .openapi(getConfig, async (c) => c.json(await readConfig(c), 200))
  .openapi(putConfig, async (c) => {
    const b = c.req.valid('json');
    must(
      await c.var.sb.rpc('set_season_config', {
        p_duration_days: b.duration_days, p_top_n: b.top_n, p_min_matches: b.min_matches,
        p_reset_pct: b.reset_pct, p_reset_floor: b.reset_floor, p_reset_all: b.reset_all, p_tiers: b.tiers,
      }),
    );
    return c.json(await readConfig(c), 200);
  })
  .openapi(create, async (c) => {
    const b = c.req.valid('json');
    const id = mustHave(await c.var.sb.rpc('season_start', { p_name: b.name, p_ends_at: b.ends_at }));
    return c.json(await readSeason(c, id), 201);
  })
  .openapi(patch, async (c) => {
    const { id } = c.req.valid('param');
    const b = c.req.valid('json');
    await readSeason(c, id);
    must(
      await c.var.sb.rpc('season_update', {
        p_id: id, p_name: b.name, p_ends_at: b.ends_at, p_top_n: b.top_n, p_min_matches: b.min_matches,
        p_reset_pct: b.reset_pct, p_reset_floor: b.reset_floor, p_reset_all: b.reset_all, p_tiers: b.tiers,
      }),
    );
    return c.json(await readSeason(c, id), 200);
  })
  .openapi(close, async (c) => {
    const { id } = c.req.valid('param');
    await readSeason(c, id);
    const r = mustHave(await c.var.sb.rpc('season_close', { p_id: id, p_confirm: c.req.valid('json').confirm }));
    return c.json(r as z.infer<typeof SeasonClosed>, 200);
  })
  .openapi(preview, async (c) => {
    const p = c.req.valid('query');
    const args = {
      p_top_n: p.top_n, p_min_matches: p.min_matches, p_reset_pct: p.reset_pct, p_reset_floor: p.reset_floor, p_reset_all: p.reset_all ?? false,
    };
    let q = c.var.sb.rpc('season_preview', args, { count: 'exact' });
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    if (p.reset !== undefined) q = q.eq('reset', p.reset);
    if (p.medal !== undefined) q = p.medal ? q.not('tier', 'is', null) : q.is('tier', null);
    type Row = {
      player_id: string; nick: string | null; rank: number | null; eligible: boolean; elo: number; matches: number;
      tier: string | null; icon: string | null; elo_after: number; reset: boolean;
    };
    const [{ rows, total }, summary] = await Promise.all([
      runList<Row, typeof q>(q, p, { rank: ['rank', 'elo:desc'], alias: 'nick' }, 'player_id'),
      c.var.sb.rpc('season_preview_summary', args).then(mustHave),
    ]);
    return c.json(
      {
        ...envelope(
          rows.map((r) => ({
            rank: r.rank, player: { id: r.player_id, alias: r.nick ?? '' }, eligible: r.eligible, elo: r.elo, matches: r.matches,
            medal: medal(r.tier, r.icon), elo_after: r.elo_after, reset: r.reset,
          })),
          total,
          p,
        ),
        summary: summary as z.infer<typeof SeasonPreview>['summary'],
      },
      200,
    );
  });
