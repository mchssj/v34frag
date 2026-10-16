import { createRoute, z } from '@hono/zod-openapi';
import { isAdmin, requireAdmin, requireUser } from '../lib/auth';
import { must, mustHave } from '../lib/db';
import { AppError } from '../lib/errors';
import { createRouter } from '../lib/router';
import { anonClient, type Db } from '../lib/supabase';
import { bearer, errorResponses, json } from '../schemas/common';
import { MatchSummary, ResultBody } from '../schemas/matches';
import { MapPoolBody, PcwAcceptBody, PcwPost, PcwPostBody, PostParam } from '../schemas/pcw';
import { Created } from '../schemas/teams';
import { eventRounds, MATCH_LIST, toSummary, type MatchRow } from '../services/matches';

const done = { 204: { description: 'Hecho' } } as const;
const POST = 'id, by_user, best_of, maps, starts_at, note, status, match_id, created_at, team_id';

type PostRow = {
  id: string; by_user: string; best_of: number; maps: string | null; starts_at: string | null; note: string | null;
  status: string; match_id: string | null; created_at: string; team_id: string;
};

/** Anuncios con el roster del bando y el alias de quien publicó. */
async function withSides(sb: Db, posts: PostRow[]): Promise<z.infer<typeof PcwPost>[]> {
  if (!posts.length) return [];
  const teamIds = posts.map((p) => p.team_id);
  const [teams, members, authors] = await Promise.all([
    sb.from('teams').select('id, name, guests, parent:parent_team_id(id, name, tag)').in('id', teamIds).then(mustHave),
    sb.from('team_members').select('team_id, player:players(id, nick)').in('team_id', teamIds).is('left_at', null).then(mustHave),
    sb.from('players').select('user_id, nick').in('user_id', posts.map((p) => p.by_user)).then(mustHave),
  ]);
  const alias = new Map(authors.map((a) => [a.user_id!, a.nick]));
  return posts.map((p) => {
    const t = teams.find((x) => x.id === p.team_id);
    return {
      id: p.id,
      by: { user_id: p.by_user, alias: alias.get(p.by_user) ?? null },
      best_of: p.best_of as 1 | 3 | 5,
      maps: p.maps,
      starts_at: p.starts_at,
      note: p.note,
      status: p.status,
      match_id: p.match_id,
      created_at: p.created_at,
      side: {
        team_id: p.team_id,
        name: t?.name ?? '',
        plays_as: (t?.parent as unknown as { id: string; name: string; tag: string | null } | null) ?? null,
        roster: [
          ...members.filter((m) => m.team_id === p.team_id && m.player).map((m) => ({ player_id: m.player!.id, alias: m.player!.nick, guest: false })),
          ...((t?.guests as string[] | null) ?? []).map((g) => ({ player_id: null, alias: g, guest: true })),
        ],
      },
    };
  });
}

// ---------- rutas ----------

const openPosts = createRoute({
  method: 'get', path: '/api/v1/pcw/posts', tags: ['PCW'],
  summary: 'Anuncios de PCW abiertos', description: 'Los de los últimos 7 días, el más nuevo primero. Sin sesión.',
  responses: { 200: { description: 'Anuncios', ...json(z.array(PcwPost)) } },
});

const myPcw = createRoute({
  method: 'get', path: '/api/v1/me/pcw', tags: ['PCW'], security: bearer, middleware: [requireUser] as const,
  summary: 'Mis PCW', description: 'Mi anuncio abierto (si hay) y las PCW donde estoy, las pendientes primero.',
  responses: {
    200: { description: 'Mis PCW', ...json(z.object({ post: PcwPost.nullable(), matches: z.array(MatchSummary) }).openapi('MyPcw')) },
    ...errorResponses(401),
  },
});

const publish = createRoute({
  method: 'post', path: '/api/v1/pcw/posts', tags: ['PCW'], security: bearer, middleware: [requireUser] as const,
  summary: 'Publicar una PCW',
  description:
    'Roster de 1 a 7 con al menos 4 jugadores con cuenta; formato entre los habilitados; un anuncio abierto por usuario. ' +
    'Con `team_id`, el bando juega como ese equipo oficial (suma al ranking).',
  request: { body: { required: true, ...json(PcwPostBody) } },
  responses: { 201: { description: 'Publicado', ...json(Created) }, ...errorResponses(400, 401, 403) },
});

const accept = createRoute({
  method: 'post', path: '/api/v1/pcw/posts/{id}/accept', tags: ['PCW'], security: bearer, middleware: [requireUser] as const,
  summary: 'Aceptar una PCW', description: 'Crea la partida. Nadie puede estar en los dos rosters. Devuelve el id de la partida.',
  request: { params: PostParam, body: { required: true, ...json(PcwAcceptBody) } },
  responses: { 201: { description: 'Partida creada', ...json(Created) }, ...errorResponses(400, 401, 403) },
});

const cancelPost = createRoute({
  method: 'delete', path: '/api/v1/pcw/posts/{id}', tags: ['PCW'], security: bearer, middleware: [requireUser] as const,
  summary: 'Cancelar mi anuncio', description: 'Quien lo publicó o un admin, mientras siga abierto.',
  request: { params: PostParam },
  responses: { ...done, ...errorResponses(400, 401) },
});

const cancelMatch = createRoute({
  method: 'post', path: '/api/v1/pcw/matches/{id}/cancel', tags: ['PCW'], security: bearer, middleware: [requireUser] as const,
  summary: 'Cancelar una PCW', description: 'Los capitanes de los dos bandos o un admin, mientras no se haya jugado ningún mapa.',
  request: { params: PostParam },
  responses: { ...done, ...errorResponses(400, 401) },
});

const adminResult = createRoute({
  method: 'post', path: '/api/v1/admin/pcw/matches/{id}/result', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Resultado a mano de una PCW', description: 'Solo el admin, si la PCW no se pudo jugar con `!match`. Solo `maps`.',
  request: { params: PostParam, body: { required: true, ...json(ResultBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});

const maps = createRoute({
  method: 'get', path: '/api/v1/maps', tags: ['Partidas'],
  summary: 'Pool de mapas', description: 'Los mapas activos del veto, en orden, con sus versiones (Inferno tiene dos). Sin sesión.',
  responses: { 200: { description: 'Mapas', ...json(z.array(z.object({ name: z.string(), versions: z.array(z.string()) }))) } },
});

const putMaps = createRoute({
  method: 'put', path: '/api/v1/admin/maps', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Cambiar el pool de mapas', description: 'Reemplaza la lista completa; el orden es el de la lista. Al menos 2 mapas activos.',
  request: { body: { required: true, ...json(MapPoolBody) } },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});

const servers = createRoute({
  method: 'get', path: '/api/v1/servers', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Servidores activos', description: 'Para asignar el servidor de una partida (organizadores y admins).',
  responses: {
    200: { description: 'Servidores', ...json(z.array(z.object({ id: z.uuid(), name: z.string(), address: z.string().nullable() }))) },
    ...errorResponses(401, 403),
  },
});

const setRole = createRoute({
  method: 'put', path: '/api/v1/admin/users/{id}/role', tags: ['Admin'], security: bearer, middleware: [requireUser, requireAdmin] as const,
  summary: 'Nombrar o quitar un organizador', description: '`user` u `organizer`. El rol admin se da en la base.',
  request: { params: PostParam, body: { required: true, ...json(z.object({ role: z.enum(['user', 'organizer']) }).openapi('RoleChange')) } },
  responses: { ...done, ...errorResponses(400, 401, 403) },
});

export const pcwPlay = createRouter()
  .openapi(openPosts, async (c) => {
    const sb = anonClient(c.var.config);
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const rows = mustHave(await sb.from('pcw_posts').select(POST).eq('status', 'open').gt('created_at', since).order('created_at', { ascending: false }));
    return c.json(await withSides(sb, rows as PostRow[]), 200);
  })
  .openapi(myPcw, async (c) => {
    const { sb, user } = c.var;
    const mine = must(await sb.from('players').select('id').eq('user_id', user.id).maybeSingle());
    const [post, captainOf, memberOf] = await Promise.all([
      sb.from('pcw_posts').select(POST).eq('by_user', user.id).eq('status', 'open').maybeSingle().then(must),
      sb.from('teams').select('id').eq('kind', 'pcw').eq('captain_id', user.id).then(mustHave),
      mine ? sb.from('team_members').select('team_id, team:teams!inner(kind)').eq('player_id', mine.id).eq('team.kind', 'pcw').then(mustHave) : Promise.resolve([]),
    ]);
    const sides = [...new Set([...captainOf.map((t) => t.id), ...memberOf.map((m) => m.team_id)])];
    let matchesOut: z.infer<typeof MatchSummary>[] = [];
    if (sides.length) {
      const list = sides.join(',');
      const rows = mustHave(
        await sb.from('matches').select(MATCH_LIST).eq('kind', 'pcw').or(`team1.in.(${list}),team2.in.(${list})`).order('starts_at', { ascending: false, nullsFirst: true }).limit(30),
      ) as unknown as MatchRow[];
      const rounds = await eventRounds(sb, rows);
      const rank = (s: string) => (s === 'upcoming' || s === 'live' ? 0 : 1);
      matchesOut = rows.map((m) => toSummary(m, rounds)).sort((a, b) => rank(a.status) - rank(b.status));
    }
    return c.json({ post: post ? ((await withSides(sb, [post as PostRow]))[0] ?? null) : null, matches: matchesOut }, 200);
  })
  .openapi(publish, async (c) => {
    const b = c.req.valid('json');
    const id = mustHave(
      await c.var.sb.rpc('create_pcw_post', {
        p_name: b.name ?? '', p_best_of: b.best_of, p_maps: b.maps ?? '', p_starts_at: (b.starts_at ?? null) as unknown as string, p_note: b.note ?? '',
        p_players: b.players, p_guests: b.guests, p_team: b.team_id,
      }),
    );
    return c.json({ id }, 201);
  })
  .openapi(accept, async (c) => {
    const b = c.req.valid('json');
    const id = mustHave(
      await c.var.sb.rpc('accept_pcw', { p_post: c.req.valid('param').id, p_name: b.name ?? '', p_players: b.players, p_guests: b.guests, p_team: b.team_id }),
    );
    return c.json({ id }, 201);
  })
  .openapi(cancelPost, async (c) => {
    must(await c.var.sb.rpc('cancel_pcw_post', { p_post: c.req.valid('param').id }));
    return c.body(null, 204);
  })
  .openapi(cancelMatch, async (c) => {
    must(await c.var.sb.rpc('cancel_pcw_match', { p_match: c.req.valid('param').id }));
    return c.body(null, 204);
  })
  .openapi(adminResult, async (c) => {
    const { maps: m } = c.req.valid('json');
    if (!m) throw new AppError(400, 'VALIDATION_ERROR', 'En una PCW el resultado a mano lleva `maps`.');
    must(await c.var.sb.rpc('pcw_set_result', { p_match: c.req.valid('param').id, p_maps: m as never }));
    return c.body(null, 204);
  })
  .openapi(maps, async (c) => {
    const rows = mustHave(await anonClient(c.var.config).from('map_pool').select('name, versions').eq('active', true).order('position'));
    return c.json(rows, 200);
  })
  .openapi(putMaps, async (c) => {
    const { maps: list } = c.req.valid('json');
    const names = list.map((m) => m.name);
    if (new Set(names).size !== names.length) throw new AppError(400, 'VALIDATION_ERROR', 'Hay mapas repetidos.');
    if (list.filter((m) => m.active).length < 2) throw new AppError(400, 'VALIDATION_ERROR', 'Tienen que quedar al menos 2 mapas activos.');
    const rows = list.map((m, i) => {
      const versions = m.versions ?? [m.name];
      if (versions[0] !== m.name) throw new AppError(400, 'VALIDATION_ERROR', `La primera versión de ${m.name} tiene que ser el mismo nombre.`);
      return { name: m.name, versions, active: m.active, position: i + 1 };
    });
    must(await c.var.sb.from('map_pool').delete().not('name', 'in', `(${names.join(',')})`));
    must(await c.var.sb.from('map_pool').upsert(rows));
    return c.body(null, 204);
  })
  .openapi(servers, async (c) => {
    const role = must(await c.var.sb.from('profiles').select('role').eq('id', c.var.user.id).maybeSingle())?.role;
    if (role !== 'organizer' && !(await isAdmin(c))) throw new AppError(403, 'FORBIDDEN', 'Solo organizadores y admins.');
    const rows = mustHave(await c.var.sb.from('game_servers_public').select('id, name, connect_address').order('name'));
    return c.json(rows.map((s) => ({ id: s.id!, name: s.name ?? '', address: s.connect_address })), 200);
  })
  .openapi(setRole, async (c) => {
    must(await c.var.sb.rpc('set_user_role', { p_user: c.req.valid('param').id, p_role: c.req.valid('json').role }));
    return c.body(null, 204);
  });
