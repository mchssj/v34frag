import { createRoute, z } from '@hono/zod-openapi';
import { currentUser, isAdmin, optionalUser, requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave, notFound, searchTerm } from '../lib/db';
import { STEAM64 } from '../schemas/claim';
import { notModified } from '../lib/etag';
import { AppError } from '../lib/errors';
import { envelope, runList } from '../lib/list';
import { createRouter } from '../lib/router';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  ChatBody,
  ChatMessage,
  ChatPage,
  ChatParam,
  ChatQuery,
  MatchDetail,
  MatchList,
  MatchListQuery,
  MatchParam,
  ResultBody,
  ScheduleBody,
  VetoBody,
  type PlayerLine,
  type RosterPlayer,
} from '../schemas/matches';
import { LIVE_LIST, toLiveGame, type LiveRow } from '../services/live';
import { clutchesOf, demoUrl, MATCH_LIST, mixReview, toSummary, vetoState, type MatchRow } from '../services/matches';

const DETAIL = 'maps, server_id, server_ip, cancel_reason, external_id, advantage_side, demo_size';

const done = { 204: { description: 'Hecho' } } as const;

// ---------- rutas públicas ----------

const list = createRoute({
  method: 'get', path: '/api/v1/matches', tags: ['Partidas'], middleware: [optionalUser] as const,
  summary: 'Partidas', description: 'Torneo, PCW y mixes (sin byes). Por defecto, la más nueva primero. Sin sesión.',
  request: { query: MatchListQuery },
  responses: { 200: { description: 'Partidas', ...json(MatchList) }, ...errorResponses(400, 401) },
});

const detail = createRoute({
  method: 'get', path: '/api/v1/matches/{id}', tags: ['Partidas'], middleware: [optionalUser] as const,
  summary: 'Detalle de una partida',
  description:
    'Bandos, serie, mapas jugados, stats, veto, servidor y demo. Con sesión suma el código de `!match` (si corresponde) y `viewer`. ' +
    'Responde con `ETag`: mandando `If-None-Match` se puede consultar cada pocos segundos y la API contesta `304` si no cambió.',
  request: { params: MatchParam },
  responses: { 200: { description: 'Partida', ...json(MatchDetail) }, 304: { description: 'Sin cambios' }, ...errorResponses(400, 401, 404) },
});

const chat = createRoute({
  method: 'get', path: '/api/v1/matches/{id}/chat', tags: ['Partidas'], middleware: [optionalUser] as const,
  summary: 'Chat de la partida',
  description:
    'Paginación por cursor: sin parámetros, los últimos `limit`; con `before`, los anteriores a ese id (historial); ' +
    'con `after`, los nuevos desde ese id (para consultar cada pocos segundos). Siempre del más viejo al más nuevo.',
  request: { params: MatchParam, query: ChatQuery },
  responses: { 200: { description: 'Mensajes', ...json(ChatPage) }, ...errorResponses(400, 401) },
});

// ---------- con sesión ----------

const sendChat = createRoute({
  method: 'post', path: '/api/v1/matches/{id}/chat', tags: ['Partidas'], security: bearer, middleware: [requireUser] as const,
  summary: 'Escribir en el chat',
  description: 'En torneos y PCW: los integrantes de los dos equipos, el organizador y los admins. En los mixes, cualquiera con sesión. Un mensaje cada 2 segundos.',
  request: { params: MatchParam, body: { required: true, ...json(ChatBody) } },
  responses: { 201: { description: 'Enviado', ...json(ChatMessage) }, ...errorResponses(400, 401, 403) },
});

const deleteChat = createRoute({
  method: 'delete', path: '/api/v1/chat/{id}', tags: ['Partidas'], security: bearer, middleware: [requireUser] as const,
  summary: 'Borrar un mensaje', description: 'El propio, o cualquiera si es admin.',
  request: { params: ChatParam },
  responses: { ...done, ...errorResponses(400, 401, 404) },
});

const veto = createRoute({
  method: 'post', path: '/api/v1/matches/{id}/veto', tags: ['Partidas'], security: bearer, middleware: [requireUser] as const,
  summary: 'Vetar o elegir un mapa',
  description: 'El capitán del equipo al que le toca. Si el mapa tiene versiones y es un pick, `version` es obligatoria.',
  request: { params: MatchParam, body: { required: true, ...json(VetoBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});

// ---------- organizador o admin ----------

const schedule = createRoute({
  method: 'patch', path: '/api/v1/matches/{id}', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Hora y servidor de una partida', description: 'El organizador del torneo o un admin.',
  request: { params: MatchParam, body: { required: true, ...json(ScheduleBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});

const result = createRoute({
  method: 'post', path: '/api/v1/matches/{id}/result', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Resultado a mano de una partida de torneo',
  description:
    'El organizador del torneo o un admin, cuando el resultado no llegó del servidor (caída, W.O. o corrección). ' +
    'Mandar `maps` (rondas de cada mapa; no puede haber mapas empatados), `walkover` (id del equipo que gana) o `clear: true`. ' +
    'Si cambia el ganador, la llave se corrige sola; falla si ya se jugaron partidas que dependían de esta.',
  request: { params: MatchParam, body: { required: true, ...json(ResultBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});

const resetVeto = createRoute({
  method: 'delete', path: '/api/v1/matches/{id}/veto', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Reiniciar el veto', description: 'El organizador del torneo o un admin.',
  request: { params: MatchParam },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});

const adminDelete = createRoute({
  method: 'delete', path: '/api/v1/admin/matches/{id}', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Borrar una partida', description: 'Para partidas huérfanas (de torneos borrados) o cargadas por error. Un mix con stats no se borra.',
  request: { params: MatchParam },
  responses: { ...done, ...errorResponses(400, 401, 403, 404) },
});

type DetailRow = {
  maps: unknown; server_id: string | null; server_ip: string | null; cancel_reason: string | null; external_id: string | null;
  advantage_side: number | null; demo_size: number | null;
};

export const matches = createRouter()
  .openapi(list, async (c) => {
    const p = c.req.valid('query');
    let q = c.var.sb.from('match_list').select(MATCH_LIST, { count: 'exact' }).eq('bye', false);
    if (p.kind) q = q.eq('kind', p.kind);
    if (p.status) q = q.eq('status', p.status);
    if (p.review) q = q.eq('review', p.review);
    if (p.event) q = q.eq('event_id', p.event);
    if (p.team) q = q.or(`team1_id.eq.${p.team},team2_id.eq.${p.team}`);
    if (p.player) q = q.contains('player_ids', [p.player]);
    if (p.server) q = q.eq('server_id', p.server);
    if (p.map) q = q.ilike('map', `%${searchTerm(p.map) ?? ''}%`);
    if (p.from) q = q.gte('at', p.from);
    if (p.to) q = q.lte('at', p.to);
    const term = searchTerm(p.q);
    if (term) q = q.ilike('search', `%${term}%`);
    const { rows, total } = await runList<MatchRow, typeof q>(q, p, {});
    return c.json(envelope(rows.map(toSummary), total, p), 200);
  })
  .openapi(detail, async (c) => {
    const { id } = c.req.valid('param');
    const { sb, config } = c.var;
    const [base, extra] = await Promise.all([
      sb.from('match_list').select(MATCH_LIST).eq('id', id).maybeSingle().then(must),
      sb.from('matches').select(DETAIL).eq('id', id).maybeSingle().then(must),
    ]);
    if (!base || !extra) throw notFound('esa partida');
    const m = { ...(base as unknown as MatchRow), ...(extra as unknown as DetailRow) };
    const user = currentUser(c);
    const series = m.kind !== 'mix';

    const [ev, games, stats, vetos, pool, server, caps, liveGame] = await Promise.all([
      m.event_id ? sb.from('events').select('config').eq('id', m.event_id).maybeSingle().then(must) : Promise.resolve(null),
      series
        ? sb.from('matches').select('id, map, score1, score2, played_at, kind, external_id, demo_status, parent_side1').eq('parent_match_id', id).order('played_at').then(mustHave)
        : Promise.resolve([]),
      series
        ? Promise.resolve([])
        : sb.from('match_player_stats').select('player_id, steam_id, nick, team, kills, deaths, assists, headshots, damage, rounds, rating, elo_delta, k2, k3, k4, k5, first_kills, first_deaths, plants, defuses').eq('match_id', id).then(mustHave),
      series ? sb.from('match_vetos').select('seq, team_id, map, action, version').eq('match_id', id).then(mustHave) : Promise.resolve([]),
      series ? sb.from('map_pool').select('name, versions').eq('active', true).order('position').then(mustHave) : Promise.resolve([]),
      m.server_id ? sb.from('game_servers_public').select('id, name, connect_address').eq('id', m.server_id).maybeSingle().then(must) : Promise.resolve(null),
      series && (m.team1_id || m.team2_id)
        ? sb.from('teams').select('id, captain_id, guests').in('id', [m.team1_id, m.team2_id].filter((x): x is string => !!x)).then(mustHave)
        : Promise.resolve([]),
      // Torneo o PCW: el juego vinculado con !match que se está jugando ahora (mixes en vivo, replanteo 16).
      series
        ? sb.from('live_match_list').select(LIVE_LIST).eq('parent_match_id', id).order('updated_at', { ascending: false }).limit(1).maybeSingle().then(must)
        : Promise.resolve(null),
    ]);

    // Planteles: en torneo, los inscritos; en PCW, el roster del bando (con invitados).
    const roster = async (team: string | null, guests: string[]): Promise<z.infer<typeof RosterPlayer>[]> => {
      if (!team) return [];
      const ids = m.event_id
        ? mustHave(await sb.from('tournament_registration_players').select('player_id').eq('event_id', m.event_id).eq('team_id', team)).map((r) => r.player_id)
        : mustHave(await sb.from('team_members').select('player_id').eq('team_id', team).is('left_at', null)).map((r) => r.player_id);
      const people = ids.length ? mustHave(await sb.from('players').select('id, nick').in('id', ids)) : [];
      return [
        ...people.map((p) => ({ player_id: p.id, alias: p.nick, guest: false })).sort((a, b) => a.alias.localeCompare(b.alias)),
        ...guests.map((g) => ({ player_id: null, alias: g, guest: true })),
      ];
    };
    const guestsOf = (t: string | null) => (caps.find((x) => x.id === t)?.guests as string[] | undefined) ?? [];
    const [roster1, roster2] = series ? await Promise.all([roster(m.team1_id, guestsOf(m.team1_id)), roster(m.team2_id, guestsOf(m.team2_id))]) : [[], []];

    // Clutches ganados del mix (replanteo 29); sin datos de clutch, null en cada jugador.
    const [clutchRows, clutchInfo] = series
      ? [[], null]
      : await Promise.all([
          sb.from('match_clutches').select('steam_id, vs, won').eq('match_id', id).then(mustHave),
          sb.from('match_clutch_data').select('clutch_data').eq('match_id', id).maybeSingle().then(must),
        ]);
    const clutchData = !series && !!clutchInfo?.clutch_data;

    // Stats del mix con el alias de los jugadores vinculados.
    const linked = stats.map((s) => s.player_id).filter((x): x is string => !!x);
    const aliases = linked.length ? new Map(mustHave(await sb.from('players').select('id, nick').in('id', linked)).map((p) => [p.id, p.nick])) : new Map<string, string>();
    const players: z.infer<typeof PlayerLine>[] = stats
      .map((s) => ({
        player_id: s.player_id, alias: s.player_id ? (aliases.get(s.player_id) ?? null) : null, game_nick: s.nick, side: s.team,
        // Sin ficha: el SteamID64 enlaza a su perfil sin reclamar (bots y NOSTEAM no tienen).
        steam_id: !s.player_id && STEAM64.test(s.steam_id) ? s.steam_id : null,
        kills: s.kills, deaths: s.deaths, assists: s.assists, headshots: s.headshots, damage: s.damage, rounds: s.rounds,
        rating: s.rating, elo_delta: s.elo_delta,
        k2: s.k2, k3: s.k3, k4: s.k4, k5: s.k5, first_kills: s.first_kills, first_deaths: s.first_deaths, plants: s.plants, defuses: s.defuses,
        clutches: clutchData ? clutchesOf(clutchRows.filter((r) => r.steam_id === s.steam_id)) : null,
      }))
      .sort((a, b) => (a.side ?? 0) - (b.side ?? 0) || (b.rating ?? 0) - (a.rating ?? 0));
    const mvp = players.filter((p) => (p.rounds ?? 0) > 0).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null;

    // Lo que puede hacer quien consulta.
    let viewer = null;
    let link_code: string | null = null;
    const veto = series
      ? vetoState(pool, vetos, m.best_of, m.team1_id, m.team2_id, ((ev?.config as Record<string, unknown> | undefined)?.decider_versions as Record<string, string>) ?? {})
      : null;
    if (user) {
      const [code, canChat, canManage, participant] = await Promise.all([
        series ? sb.rpc('match_link_code', { p_match: id }).then(must) : Promise.resolve(null),
        sb.rpc('match_chat_can_write', { p_match: id }).then(must),
        m.event_id ? sb.rpc('can_manage_event', { p_event: m.event_id }).then(must) : isAdmin(c),
        sb.rpc('is_match_participant', { p_match: id }).then(must),
      ]);
      link_code = (code as string | null) ?? null;
      const turnTeam = veto?.next?.team_id ?? null;
      viewer = {
        can_veto: !!turnTeam && m.status === 'upcoming' && caps.some((t) => t.id === turnTeam && t.captain_id === user.id),
        can_chat: !!canChat,
        can_manage: !!canManage,
        is_participant: !!participant,
      };
    }

    const body = {
      ...toSummary(m),
      stage: m.stage,
      phase: m.phase,
      grp: m.grp,
      round: m.round,
      advantage_side: m.advantage_side,
      cancel_reason: m.cancel_reason,
      server: m.server_id || m.server_ip ? { id: server?.id ?? null, name: server?.name ?? null, address: server?.connect_address ?? m.server_ip } : null,
      demo_url: demoUrl(config, m),
      demo_size: m.demo_size ?? null,
      clutch_data: clutchData,
      link_code,
      roster1,
      roster2,
      maps_detail: Array.isArray(m.maps)
        ? (m.maps as { map?: string; r1?: number; r2?: number; game_id?: string }[]).map((x) => ({ map: x.map ?? null, r1: x.r1 ?? null, r2: x.r2 ?? null, game_id: x.game_id ?? null }))
        : [],
      games: games.map((g) => {
        // Las rondas del mix van en el orden de los bandos de la partida (parent_side1 dice cuál bando del mix es el equipo 1).
        const flip = g.parent_side1 === 2;
        return { id: g.id, map: g.map, score1: flip ? g.score2 : g.score1, score2: flip ? g.score1 : g.score2, played_at: g.played_at, demo_url: demoUrl(config, g) };
      }),
      players,
      mvp,
      veto,
      review_detail: mixReview(m),
      live: liveGame ? toLiveGame(liveGame as unknown as LiveRow) : null,
      viewer,
    };
    if (await notModified(c, body)) return c.body(null, 304);
    return c.json(body, 200);
  })
  .openapi(chat, async (c) => {
    const { id } = c.req.valid('param');
    const { after, before, limit } = c.req.valid('query');
    if (after !== undefined && before !== undefined) throw new AppError(400, 'VALIDATION_ERROR', 'Mandá `after` o `before`, no los dos.');
    let q = c.var.sb.from('match_chat_public').select('id, user_id, alias, message, created_at').eq('match_id', id);
    if (after !== undefined) q = q.gt('id', after);
    if (before !== undefined) q = q.lt('id', before);
    // Con `after` se leen los más viejos primero; si no, los más nuevos y se dan vuelta.
    const rows = mustHave(await q.order('id', { ascending: after !== undefined }).limit(limit + 1));
    const has_more = rows.length > limit;
    const page = rows.slice(0, limit);
    if (after === undefined) page.reverse();
    return c.json(
      {
        items: page.map((r) => ({ id: r.id!, user_id: r.user_id, alias: r.alias ?? 'Usuario', message: r.message ?? '', created_at: r.created_at! })),
        has_more,
        limit,
      },
      200,
    );
  })
  .openapi(sendChat, async (c) => {
    const { id } = c.req.valid('param');
    const { sb, user } = c.var;
    const r = await sb.from('match_chat').insert({ match_id: id, user_id: user.id, message: c.req.valid('json').message }).select('id').single();
    if (r.error?.code === '42501') throw new AppError(403, 'FORBIDDEN', 'En esta partida escriben solo los dos equipos, el organizador y los admins.');
    const row = mustHave(r);
    const msg = mustHave(await sb.from('match_chat_public').select('id, user_id, alias, message, created_at').eq('id', row.id).single());
    return c.json({ id: msg.id!, user_id: msg.user_id, alias: msg.alias ?? 'Usuario', message: msg.message ?? '', created_at: msg.created_at! }, 201);
  })
  .openapi(deleteChat, async (c) => {
    const gone = mustHave(await c.var.sb.from('match_chat').delete().eq('id', c.req.valid('param').id).select('id'));
    if (!gone.length) throw notFound('ese mensaje (o no es tuyo)');
    return c.body(null, 204);
  })
  .openapi(veto, async (c) => {
    const { map, version } = c.req.valid('json');
    must(await c.var.sb.rpc('veto_act', { p_match: c.req.valid('param').id, p_map: map, p_version: version }));
    return c.body(null, 204);
  })
  .openapi(schedule, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const cur = must(await c.var.sb.from('matches').select('starts_at, server_id').eq('id', id).maybeSingle());
    if (!cur) throw notFound('esa partida');
    must(
      await c.var.sb.rpc('match_schedule', {
        p_match: id,
        p_starts_at: (body.starts_at !== undefined ? body.starts_at : cur.starts_at) as string,
        p_server: (body.server_id !== undefined ? body.server_id : cur.server_id) as string,
      }),
    );
    return c.body(null, 204);
  })
  .openapi(result, async (c) => {
    const { maps, walkover, clear } = c.req.valid('json');
    must(
      await c.var.sb.rpc('event_set_result', {
        p_match: c.req.valid('param').id,
        p_maps: (maps ?? null) as never,
        p_walkover_winner: walkover,
        p_clear: clear ?? false,
      }),
    );
    return c.body(null, 204);
  })
  .openapi(resetVeto, async (c) => {
    must(await c.var.sb.rpc('veto_reset', { p_match: c.req.valid('param').id }));
    return c.body(null, 204);
  })
  .openapi(adminDelete, async (c) => {
    const { id } = c.req.valid('param');
    const { count } = await c.var.sb.from('match_player_stats').select('id', { count: 'exact', head: true }).eq('match_id', id);
    if (count) throw new AppError(400, 'BUSINESS_RULE', 'Esa partida tiene stats de jugadores: no se borra (se puede cancelar).');
    const gone = mustHave(await c.var.sb.from('matches').delete().eq('id', id).select('id'));
    if (!gone.length) throw notFound('esa partida');
    return c.body(null, 204);
  });
