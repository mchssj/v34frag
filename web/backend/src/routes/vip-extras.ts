import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { currentUser, optionalUser, requireUser } from '../lib/auth';
import { levelOf, must, mustHave, searchTerm } from '../lib/db';
import { AppError } from '../lib/errors';
import { boolParam, Envelope, envelope, listQuery, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { bearer, errorResponses, json } from '../schemas/common';
import { TeamRef } from '../schemas/players';
import { CosmeticsLight } from '../schemas/shop';
import { verifiedPlayers } from '../services/players';
import { cosmeticsLight } from '../services/shop';
import { requireVip, vipPlayers } from '../services/vip';

// Beneficios VIP de la web: partidas favoritas (replanteo 140), tarjeta de stats y búsquedas guardadas (141) y el desglose del ELO (142). Bitácoras 2026-11-24-comparador-y-favoritas-vip, 2026-11-24-exportar-stats-y-buscador-vip
// y 2026-11-24-desglose-elo-vip. Lo que se guarda lo controla la base; los filtros avanzados, esta API.

type C = Context<AppEnv>;
const rpc = async (c: C, fn: string, args: Record<string, unknown> = {}) =>
  must(await c.var.sb.rpc(fn as never, args as never)) as unknown;

const Id = z.uuid();
const IdParam = z.object({ id: Id.openapi({ param: { name: 'id', in: 'path' } }) });
const num = z.number().nullable();
const int = z.number().int();
const done = { 204: { description: 'Hecho' } } as const;

// ---------- partidas favoritas (140) ----------

const favorite = createRoute({
  method: 'put', path: '/api/v1/me/favorites/{id}', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Marcar una partida como favorita',
  description: 'Solo VIP (403 `VIP_REQUIRED`). Marcarla dos veces no cambia nada. Las marcadas salen con `GET /api/v1/matches?favorites=true`.',
  request: { params: IdParam },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});

const unfavorite = createRoute({
  method: 'delete', path: '/api/v1/me/favorites/{id}', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Sacar una partida de las favoritas', description: 'También con el VIP vencido. Si no estaba marcada, no cambia nada.',
  request: { params: IdParam },
  responses: { ...done, ...errorResponses(400, 401) },
});

// ---------- tarjeta de stats (141) ----------

export const CARD_PERIODS = ['season', '30d', 'all'] as const;
export const PlayerCard = z
  .object({
    player_id: Id,
    nick: z.string(),
    team_tag: z.string().nullable(),
    photo_url: z.string().nullable(),
    elo: int.nullable(),
    matches: int, wins: int,
    kd: num, rating: num, hs: num, adr: num,
    mvp: int.openapi({ description: 'Mixes en los que tuvo el mejor rating' }),
    peak_elo: int.nullable().openapi({ description: 'ELO máximo del período' }),
    streak: int.openapi({ description: 'Victorias seguidas, la mejor del período' }),
    maps: z.array(z.object({ name: z.string(), matches: int, wins: int })).openapi({ description: 'Los 3 más jugados' }),
    elo_history: z.array(int).openapi({ description: 'ELO después de cada mix del período, del más viejo al más nuevo' }),
    season: int.nullable().openapi({ description: 'Número de la temporada activa (null si no hay: el período `season` trae todo)' }),
  })
  .openapi('PlayerCard');

const card = createRoute({
  method: 'get', path: '/api/v1/me/card', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Stats de mi tarjeta para redes',
  description:
    'Las stats de mixes del período. No pide VIP: son datos públicos y la imagen se dibuja en el navegador (sin VIP, con marca de agua). ' +
    'Sin ficha vinculada, 400 `PLAYER_NOT_LINKED`.',
  request: { query: z.object({ period: z.enum(CARD_PERIODS).default('season') }) },
  responses: { 200: { description: 'Stats', ...json(PlayerCard) }, ...errorResponses(400, 401) },
});

// ---------- búsquedas guardadas (141) ----------

const SearchKind = z.enum(['players', 'matches']);
const SearchValues = z
  .record(z.string().max(30), z.union([z.string().max(60), z.number(), z.boolean()]))
  .openapi({ description: 'Los filtros, como van en la URL de la página. Hasta 1000 caracteres en total' });
export const SavedSearch = z
  .object({ id: Id, kind: SearchKind, name: z.string(), query: SearchValues, created_at: z.string() })
  .openapi('SavedSearch');
const SaveSearchBody = z
  .object({ kind: SearchKind, name: z.string().trim().min(1).max(30), query: SearchValues })
  .refine((b) => JSON.stringify(b.query).length <= 900, { message: 'La búsqueda es demasiado larga', path: ['query'] })
  .openapi('SaveSearchBody');

const searches = createRoute({
  method: 'get', path: '/api/v1/me/searches', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Mis búsquedas guardadas',
  description: 'Hasta 5 de jugadores y 5 de partidas. Con el VIP vencido se siguen viendo.',
  request: { query: listQuery(['created_at', 'name'], { sort: 'created_at', order: 'desc' }).extend({ kind: SearchKind.optional() }) },
  responses: { 200: { description: 'Búsquedas', ...json(Envelope(SavedSearch).openapi('SavedSearchList')) }, ...errorResponses(400, 401) },
});

const saveSearch = createRoute({
  method: 'put', path: '/api/v1/me/searches', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Guardar una búsqueda',
  description: 'Solo VIP (403 `VIP_REQUIRED`). Con un nombre que ya existe, la reemplaza. La sexta del mismo tipo da 400 `BUSINESS_RULE`.',
  request: { body: { required: true, ...json(SaveSearchBody) } },
  responses: { 200: { description: 'Guardada', ...json(z.object({ id: Id }).openapi('SavedSearchId')) }, ...errorResponses(400, 401, 403) },
});

const deleteSearch = createRoute({
  method: 'delete', path: '/api/v1/me/searches/{id}', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Borrar una búsqueda guardada',
  request: { params: IdParam },
  responses: { ...done, ...errorResponses(400, 401, 404) },
});

// ---------- desglose del ELO (142) ----------

const Outcome = z.enum(['win', 'loss', 'draw']);
const EloSteps = z.object({
  abandoned: z.boolean(),
  counted_as: Outcome.openapi({ description: 'Cómo se contó (un abandono cuenta como derrota)' }),
  win_prob: z.number().openapi({ description: 'Probabilidad de ganar de tu equipo (0 a 1)' }),
  base: z.number().openapi({ description: '2 × base × (resultado − probabilidad)' }),
  rating: num,
  mult: z.number().openapi({ description: 'Multiplicador por el rating' }),
  rounds: int, total_rounds: int,
  weight: z.number().openapi({ description: 'Peso por las rondas jugadas (0 a 1)' }),
  raw: int.openapi({ description: 'base × multiplicador × peso' }),
  adjusted: int.openapi({ description: 'Con el ajuste por abandono o rendición (igual a `raw` si no hubo)' }),
  scale: z.number().openapi({ description: 'Factor del tope por equipo (1 si no actuó)' }),
  scaled: int,
  min: int.openapi({ description: 'Mínimo de ese mix' }),
  after_min: int,
  floor_hit: z.boolean().openapi({ description: 'El ELO quedó en el mínimo' }),
  exact: z.boolean().openapi({ description: 'false: un admin cambió la configuración después, y la cuenta de hoy no da el cambio guardado' }),
});
export const EloConfigPublic = z.object({
  base: int, mult_win_min: z.number(), mult_win_max: z.number(), mult_loss_min: z.number(), mult_loss_max: z.number(), team_cap: int,
  min_delta: int, elo_floor: int, min_pct: int, full_pct: int,
});
export const EloBreakdown = z
  .object({
    vip: z.boolean(),
    config: EloConfigPublic.nullable().openapi({ description: 'La configuración vigente, para el simulador. Sin VIP, null' }),
    items: z.array(
      z.object({
        match_id: Id, map: z.string().nullable(), at: z.string().nullable(), own_score: int.nullable(), other_score: int.nullable(), result: Outcome,
        elo_before: int, elo_after: int, elo_delta: int,
        formula: z.enum(['match', 'old']).openapi({ description: '`old`: la fórmula anterior a la Temporada 2, sin desglose' }),
        steps: EloSteps.nullable().openapi({ description: 'null sin VIP o con la fórmula anterior' }),
      }),
    ),
    total: int, page: int, per: int,
  })
  .openapi('EloBreakdown');

const breakdown = createRoute({
  method: 'get', path: '/api/v1/me/elo/breakdown', tags: ['Mi perfil'], security: bearer, middleware: [requireUser] as const,
  summary: 'Desglose de mi ELO',
  description: 'Mis mixes con ELO, del más nuevo al más viejo. Con VIP, cada paso de la cuenta; sin VIP, solo el cambio. Sin ficha, la lista viene vacía.',
  request: { query: z.object({ page: z.coerce.number().int().min(1).default(1), per: z.coerce.number().int().min(1).max(50).default(20) }) },
  responses: { 200: { description: 'Desglose', ...json(EloBreakdown) }, ...errorResponses(400, 401) },
});

export const vipExtras = createRouter()
  .openapi(favorite, async (c) => {
    await rpc(c, 'match_favorite_set', { p_match: c.req.valid('param').id, p_on: true });
    return c.body(null, 204);
  })
  .openapi(unfavorite, async (c) => {
    await rpc(c, 'match_favorite_set', { p_match: c.req.valid('param').id, p_on: false });
    return c.body(null, 204);
  })
  .openapi(card, async (c) => {
    const { period } = c.req.valid('query');
    const sb = c.var.sb;
    const [me, season] = await Promise.all([
      sb.from('players').select('id').eq('user_id', currentUser(c)!.id).maybeSingle().then(must),
      sb.from('seasons').select('number, starts_at').eq('status', 'active').order('starts_at', { ascending: false }).limit(1).maybeSingle().then(must),
    ]);
    if (!me) throw new AppError(400, 'PLAYER_NOT_LINKED', 'Vincula tu SteamID para tener tu tarjeta.');
    const from =
      period === '30d' ? new Date(Date.now() - 30 * 86_400_000).toISOString() : period === 'season' ? (season?.starts_at ?? null) : null;
    const data = (await rpc(c, 'player_card', { p_player: me.id, p_from: from })) as Record<string, unknown> | null;
    if (!data) throw new AppError(404, 'NOT_FOUND', 'No existe ese jugador.');
    return c.json(PlayerCard.parse({ ...data, season: season?.number ?? null }), 200);
  })
  .openapi(searches, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('saved_searches' as 'user_preferences').select('id, kind, name, query, created_at' as '*', { count: 'exact' });
    if (p.kind) q = q.eq('kind' as 'user_id', p.kind);
    const { rows, total } = await runList<z.infer<typeof SavedSearch>, typeof q>(q, p, {});
    return c.json(envelope(rows, total, p), 200);
  })
  .openapi(saveSearch, async (c) => {
    const b = c.req.valid('json');
    const id = mustHave({ data: await rpc(c, 'saved_search_save', { p_kind: b.kind, p_name: b.name, p_query: b.query }), error: null });
    return c.json({ id: String(id) }, 200);
  })
  .openapi(deleteSearch, async (c) => {
    await rpc(c, 'saved_search_delete', { p_id: c.req.valid('param').id });
    return c.body(null, 204);
  })
  .openapi(breakdown, async (c) => {
    const { page, per } = c.req.valid('query');
    const data = (await rpc(c, 'my_elo_breakdown', { p_limit: per, p_offset: (page - 1) * per })) as Record<string, unknown>;
    return c.json(EloBreakdown.parse({ ...data, page, per }), 200);
  });
