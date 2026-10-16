import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Jugadores, equipos, plantel, ranking y admin contra la Supabase local (con el replanteo 09 aplicado).
const app = createApp();
const env = localEnv();
type U = Awaited<ReturnType<typeof createUser>>;

const rnd = () => Math.random().toString(36).slice(2, 8);
const steam = () => '7656119' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0');

async function req(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await app.request(
    path,
    {
      method,
      headers: {
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    },
    env,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** Usuario con jugador vinculado y SteamID (o sin SteamID). */
async function player(opts: { steam?: boolean; role?: 'admin' | 'user' } = {}) {
  const u = await createUser({ tag: `J${rnd()}`, ...(opts.role ? { role: opts.role } : {}) });
  const { data, error } = await admin()
    .from('players')
    .insert({ nick: 'x', user_id: u.id, steam_id: opts.steam === false ? null : steam() })
    .select('id, nick')
    .single();
  if (error) throw error;
  return { ...u, playerId: data.id as string, alias: data.nick as string };
}

let adm: U;
beforeAll(async () => {
  adm = await createUser({ role: 'admin' });
});

describe('alias', () => {
  it('registro con un alias tomado: 409 sin crear la cuenta', async () => {
    const u = await createUser({ tag: `Dup${rnd()}` });
    const tag = (await req('GET', '/auth/me', { token: u.token })).body.tag as string;
    const r = await req('POST', '/auth/signup', { body: { email: `t-${rnd()}@test.local`, password: 'clave-123456', tag: tag.toUpperCase() } });
    expect(r.status).toBe(409);
    expect(r.body.error.details[0].path).toBe('tag');
  });

  it('cambiarlo: disponibilidad, unicidad, palabras bloqueadas y espera de 15 días', async () => {
    const p = await player();
    const other = await createUser({ tag: `Otro${rnd()}` });
    const taken = (await req('GET', '/auth/me', { token: other.token })).body.tag as string;

    expect((await req('GET', `/api/v1/aliases/${encodeURIComponent(taken)}/available`)).body).toMatchObject({ available: false, reason: 'taken' });
    expect((await req('GET', `/api/v1/aliases/${p.alias}/available`, { token: p.token })).body).toMatchObject({ available: true, reason: null });
    expect((await req('PUT', '/api/v1/me/alias', { token: p.token, body: { alias: taken.toLowerCase() } })).status).toBe(409);

    const added = await req('POST', '/api/v1/admin/blocked-words', { token: adm.token, body: { word: `zq${rnd()}` } });
    expect(added.status).toBe(201);
    const word = added.body.word as string; // normalizada
    const blocked = await req('PUT', '/api/v1/me/alias', { token: p.token, body: { alias: `El ${word.toUpperCase()}` } });
    expect(blocked.body.error).toMatchObject({ code: 'BUSINESS_RULE', message: 'El alias contiene una palabra no permitida' });

    const alias = `Nuevo${rnd()}`;
    const ok = await req('PUT', '/api/v1/me/alias', { token: p.token, body: { alias } });
    expect(ok.status).toBe(200);
    expect(ok.body.alias).toBe(alias);
    expect(new Date(ok.body.next_change_at).getTime() - new Date(ok.body.changed_at).getTime()).toBe(15 * 86_400_000);
    // El nombre del jugador sigue al alias.
    expect((await req('GET', `/api/v1/players/${p.playerId}`)).body.alias).toBe(alias);

    const again = await req('PUT', '/api/v1/me/alias', { token: p.token, body: { alias: `Otro${rnd()}` } });
    expect(again.body.error.message).toMatch(/^Podés volver a cambiar tu alias en 1[45] días$/);

    // El admin modera sin espera; con una palabra bloqueada pide force.
    const forced = `${word}x`;
    const noForce = await req('PUT', `/api/v1/admin/users/${p.id}/alias`, { token: adm.token, body: { alias: forced } });
    expect(noForce.status).toBe(400);
    expect((await req('PUT', `/api/v1/admin/users/${p.id}/alias`, { token: adm.token, body: { alias: forced, force: true } })).status).toBe(204);
    const hits = await req('GET', '/api/v1/admin/blocked-words/hits', { token: adm.token });
    expect(hits.body).toContainEqual({ kind: 'alias', id: p.id, name: forced, word });
  });
});

describe('equipos y plantel', () => {
  let cap: Awaited<ReturnType<typeof player>>;
  let team: string;

  it('solicitud de equipo nuevo: sin SteamID no; con SteamID el admin la aprueba', async () => {
    const sin = await player({ steam: false });
    const r = await req('PUT', '/api/v1/me/team-request', { token: sin.token, body: { name: 'Sin', tag: 'sin' } });
    expect(r.body.error.message).toBe('Para pedir un equipo tenés que tener tu SteamID vinculado');

    cap = await player();
    const name = `Titanes ${rnd()}`;
    const put = await req('PUT', '/api/v1/me/team-request', { token: cap.token, body: { name, tag: 'tit' } });
    expect(put.body).toEqual({ name, tag: 'TIT', status: 'pending' });
    expect((await req('GET', '/api/v1/admin/team-requests', { token: cap.token })).status).toBe(403);
    const list = await req('GET', '/api/v1/admin/team-requests', { token: adm.token });
    expect(list.body).toContainEqual(expect.objectContaining({ user_id: cap.id, name, has_steam: true, status: 'pending' }));
    const ap = await req('POST', `/api/v1/admin/team-requests/${cap.id}/approve`, { token: adm.token });
    expect(ap.status).toBe(201);
    team = ap.body.id;
    expect((await req('GET', '/api/v1/me/team-request', { token: cap.token })).body.status).toBe('approved');

    const detail = await req('GET', `/api/v1/teams/${team}`, { token: cap.token });
    expect(detail.body).toMatchObject({ name, tag: 'TIT', members: 1, max_members: 10, captain: { player_id: cap.playerId } });
    expect(detail.body.viewer).toEqual({ is_captain: true, is_member: true, is_admin: false });
    expect(detail.body.roster[0]).toMatchObject({ player_id: cap.playerId, is_captain: true });
  });

  it('invitación y pedido de punta a punta, salir, sacar y ceder la capitanía', async () => {
    const a = await player();
    const b = await player();

    // Invitación por alias: solo el capitán.
    expect((await req('POST', `/api/v1/teams/${team}/invites`, { token: a.token, body: { alias: b.alias } })).status).toBe(403);
    const inv = await req('POST', `/api/v1/teams/${team}/invites`, { token: cap.token, body: { alias: a.alias } });
    expect(inv.status).toBe(201);
    expect((await req('GET', '/api/v1/me/team-invites', { token: a.token })).body.invites).toEqual([
      expect.objectContaining({ id: inv.body.id, kind: 'invite', team: expect.objectContaining({ id: team }) }),
    ]);
    // Un pedido no se acepta por la ruta de invitaciones.
    expect((await req('POST', `/api/v1/join-requests/${inv.body.id}/accept`, { token: cap.token })).status).toBe(404);
    expect((await req('POST', `/api/v1/team-invites/${inv.body.id}/accept`, { token: a.token })).status).toBe(204);

    // Pedido para entrar: el capitán lo ve y lo acepta.
    const jr = await req('POST', `/api/v1/teams/${team}/join-requests`, { token: b.token });
    expect(jr.status).toBe(201);
    expect((await req('GET', `/api/v1/teams/${team}/pending`, { token: a.token })).status).toBe(403);
    const pend = await req('GET', `/api/v1/teams/${team}/pending`, { token: cap.token });
    expect(pend.body.requests.map((r: { id: string }) => r.id)).toEqual([jr.body.id]);
    expect((await req('POST', `/api/v1/join-requests/${jr.body.id}/accept`, { token: cap.token })).status).toBe(204);
    expect((await req('GET', `/api/v1/teams/${team}`)).body.members).toBe(3);

    // El capitán no puede salir; cede la capitanía a A y después sale.
    expect((await req('POST', `/api/v1/teams/${team}/leave`, { token: cap.token })).body.error.message).toMatch(/^Sos el capitán/);
    expect((await req('POST', `/api/v1/teams/${team}/captain`, { token: cap.token, body: { player_id: a.playerId } })).status).toBe(204);
    expect((await req('POST', `/api/v1/teams/${team}/leave`, { token: cap.token })).status).toBe(204);
    // A (capitán ahora) saca a B.
    expect((await req('DELETE', `/api/v1/teams/${team}/members/${b.playerId}`, { token: a.token })).status).toBe(204);

    const t = (await req('GET', `/api/v1/teams/${team}`)).body;
    expect(t.roster.map((r: { player_id: string }) => r.player_id)).toEqual([a.playerId]);
    expect(t.former.map((r: { player_id: string }) => r.player_id).sort()).toEqual([b.playerId, cap.playerId].sort());
    // El historial del jugador lo muestra.
    const hist = (await req('GET', `/api/v1/players/${b.playerId}`)).body.history;
    expect(hist).toEqual([expect.objectContaining({ team: expect.objectContaining({ id: team }), left_at: expect.any(String) })]);
  });

  it('un jugador puede estar en varios equipos', async () => {
    const x = await player();
    const ids: string[] = [];
    for (let k = 0; k < 2; k++) {
      const t = await req('POST', '/api/v1/admin/teams', { token: adm.token, body: { name: `Eq ${rnd()}`, tag: 'EQ' } });
      expect(t.status).toBe(201);
      expect((await req('POST', `/api/v1/admin/teams/${t.body.id}/members`, { token: adm.token, body: { player_id: x.playerId } })).status).toBe(204);
      ids.push(t.body.id);
    }
    const pl = (await req('GET', `/api/v1/players/${x.playerId}`)).body;
    expect(pl.teams.map((t: { id: string }) => t.id).sort()).toEqual(ids.sort());
    // Que no esté inscrito con dos equipos en el mismo torneo se prueba en tournaments.test.ts (replanteo 10).
  });

  it('tope de 10 y SteamID obligatorio', async () => {
    const t = (await req('POST', '/api/v1/admin/teams', { token: adm.token, body: { name: `Lleno ${rnd()}`, tag: 'LL' } })).body.id;
    const sin = await player({ steam: false });
    const r = await req('POST', `/api/v1/admin/teams/${t}/members`, { token: adm.token, body: { player_id: sin.playerId } });
    expect(r.body.error).toMatchObject({ code: 'BUSINESS_RULE', message: `${sin.alias} no tiene el SteamID vinculado: hace falta para entrar a un equipo` });
    const ten = await Promise.all(Array.from({ length: 10 }, () => player()));
    for (const p of ten) await req('POST', `/api/v1/admin/teams/${t}/members`, { token: adm.token, body: { player_id: p.playerId } });
    const extra = await player();
    const full = await req('POST', `/api/v1/admin/teams/${t}/members`, { token: adm.token, body: { player_id: extra.playerId } });
    expect(full.body.error.message).toBe('El equipo ya tiene 10 jugadores, el máximo');
    expect((await req('POST', `/api/v1/teams/${t}/join-requests`, { token: extra.token })).body.error.message).toBe('El equipo ya tiene 10 jugadores, el máximo');
    // El rol se cambia y la baja con partidas o inscripciones falla.
    expect((await req('PATCH', `/api/v1/admin/teams/${t}/members/${ten[0]!.playerId}`, { token: adm.token, body: { role: 'coach' } })).status).toBe(204);
  });
});

describe('ranking, listados y fichas', () => {
  it('torneo suma siempre; la PCW jugada como el equipo solo con pcw=1', async () => {
    const sb = admin();
    const mkTeam = async (kind: 'official' | 'pcw', parent?: string) =>
      (await sb.from('teams').insert({ name: `R ${rnd()}`, tag: 'R', kind, parent_team_id: parent ?? null }).select('id').single()).data!.id as string;
    const a = await mkTeam('official');
    const b = await mkTeam('official');
    const side = await mkTeam('pcw', a);
    const rival = await mkTeam('pcw');
    await sb.from('matches').insert([
      { team1: a, team2: b, kind: 'official', status: 'finished', best_of: 1, score1: 1, score2: 0, winner: a },
      { team1: side, team2: rival, kind: 'pcw', status: 'finished', best_of: 1, score1: 0, score2: 1, winner: rival },
      { team1: rival, team2: side, kind: 'pcw', status: 'finished', best_of: 1, score1: 0, score2: 1, winner: side },
    ]);
    const find = (r: { body: { items: { team: { id: string } }[] } }, id: string) => r.body.items.find((i) => i.team.id === id);

    const only = await req('GET', '/api/v1/ranking/teams');
    expect(only.body.points).toEqual({ official: 30, pcw: 5 });
    expect(find(only, a)).toMatchObject({ played: 1, won: 1, lost: 0, points: 30 });
    expect(find(only, b)).toMatchObject({ played: 1, won: 0, lost: 1, points: 0 });
    expect(find(only, side)).toBeUndefined();

    const all = await req('GET', '/api/v1/ranking/teams?pcw=1');
    expect(find(all, a)).toMatchObject({ played: 3, won: 2, lost: 1, points: 35 });

    expect((await req('PUT', '/api/v1/admin/ranking/config', { token: adm.token, body: { win_official: 40, win_pcw: 10 } })).status).toBe(200);
    expect(find(await req('GET', '/api/v1/ranking/teams?pcw=1'), a)).toMatchObject({ points: 50 });
    expect((await req('GET', '/api/v1/admin/ranking/config', { token: adm.token })).body).toEqual({ win_official: 40, win_pcw: 10 });
    await req('PUT', '/api/v1/admin/ranking/config', { token: adm.token, body: { win_official: 30, win_pcw: 5 } });
  });

  it('listado de jugadores con búsqueda sin tildes y ficha con privacidad', async () => {
    const p = await player();
    const alias = `Ñandú${rnd()}`;
    await req('PUT', '/api/v1/me/alias', { token: p.token, body: { alias } });
    await req('PATCH', '/api/v1/me/profile', { token: p.token, body: { real_name: 'Juan Pérez' } });

    const found = await req('GET', `/api/v1/players?q=${encodeURIComponent(alias.toLowerCase().replace('ñ', 'n').replace('ú', 'u'))}&sort=alias`);
    expect(found.body.total).toBe(1);
    expect(found.body.items[0]).toMatchObject({ id: p.playerId, alias, has_account: true, has_steam: true, level: null, teams: [] });

    const pub = await req('GET', `/api/v1/players/${p.playerId}`);
    expect(pub.body).toMatchObject({ private: false, details: { real_name: 'Juan Pérez' }, stats: null, medals: [] });

    await admin().from('players').update({ privacy: 'private' }).eq('id', p.playerId);
    const priv = await req('GET', `/api/v1/players/${p.playerId}`);
    expect(priv.body).toMatchObject({ private: true, details: null, privacy: 'private' });
    // El dueño y el admin lo siguen viendo.
    expect((await req('GET', `/api/v1/players/${p.playerId}`, { token: p.token })).body.details.real_name).toBe('Juan Pérez');
    expect((await req('GET', `/api/v1/players/${p.playerId}`, { token: adm.token })).body.private).toBe(false);

    expect((await req('GET', '/api/v1/players/00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await req('GET', '/api/v1/players', { token: 'a.b.c' })).status).toBe(401);
  });

  it('listado de equipos y partidas de un jugador', async () => {
    const name = `Búsqueda ${rnd()}`;
    const t = (await req('POST', '/api/v1/admin/teams', { token: adm.token, body: { name, tag: 'bq' } })).body.id;
    const res = await req('GET', `/api/v1/teams?q=${encodeURIComponent('busqueda ' + name.split(' ')[1])}`);
    expect(res.body.items).toEqual([expect.objectContaining({ id: t, name, tag: 'BQ', kind: 'official', members: 0, captain: null })]);

    const p = await player();
    const st = (await admin().from('players').select('steam_id').eq('id', p.playerId).single()).data!.steam_id!;
    const m = (await admin().from('matches').insert({ kind: 'mix', status: 'finished', best_of: 1, score1: 16, score2: 4, winner_side: 1, side1_name: 'A', side2_name: 'B', played_at: new Date().toISOString() }).select('id').single()).data!.id;
    await admin().from('match_player_stats').insert({ match_id: m, steam_id: st, player_id: p.playerId, team: 1, nick: 'en el juego', kills: 20, deaths: 5, rounds: 20 });
    const ms = await req('GET', `/api/v1/players/${p.playerId}/matches`);
    expect(ms.body).toMatchObject({ total: 1, items: [{ match_id: m, kind: 'mix', won: true, game_nick: 'en el juego', side1_name: 'A' }] });
  });
});

describe('admin de jugadores', () => {
  it('alta, edición, medallas, SteamID y baja segura', async () => {
    const created = await req('POST', '/api/v1/admin/players', { token: adm.token, body: { nick: `Nuevo${rnd()}`, bio: 'hola' } });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    expect((await req('POST', '/api/v1/admin/players', { token: (await createUser()).token, body: { nick: 'x1' } })).status).toBe(403);

    const nick = `Ren${rnd()}`;
    expect((await req('PATCH', `/api/v1/admin/players/${id}`, { token: adm.token, body: { nick, bio: '' } })).body).toMatchObject({ nick, bio: null });

    const medal = await req('POST', `/api/v1/admin/players/${id}/medals`, { token: adm.token, body: { title: 'Campeón' } });
    expect(medal.body).toMatchObject({ title: 'Campeón', icon: '🏆' });
    expect((await req('GET', `/api/v1/players/${id}`)).body.medals).toHaveLength(1);
    expect((await req('DELETE', `/api/v1/admin/medals/${medal.body.id}`, { token: adm.token })).status).toBe(204);

    // Un SteamID que jugó sin estar vinculado aparece y se vincula con sus partidas.
    const s = steam();
    const m = (await admin().from('matches').insert({ kind: 'mix', status: 'finished', best_of: 1, side1_name: 'A', side2_name: 'B', side1_guests: ['anon'], played_at: new Date().toISOString() }).select('id').single()).data!.id;
    await admin().from('match_player_stats').insert({ match_id: m, steam_id: s, team: 1, nick: 'anon', kills: 1, deaths: 1, rounds: 10 });
    const un = await req('GET', '/api/v1/admin/steam/unlinked', { token: adm.token });
    expect(un.body).toContainEqual(expect.objectContaining({ steam_id: s, last_nick: 'anon', matches: 1 }));
    expect((await req('POST', '/api/v1/admin/steam/link', { token: adm.token, body: { steam_id: s, player_id: id } })).status).toBe(204);
    expect((await req('GET', `/api/v1/players/${id}/matches`)).body.total).toBe(1);

    // Con partidas no se borra; vincular una cuenta deja el alias como nombre.
    const del = await req('DELETE', `/api/v1/admin/players/${id}`, { token: adm.token });
    expect(del.body.error).toMatchObject({ code: 'BUSINESS_RULE', message: `${nick} tiene partidas jugadas: no se puede borrar` });
    const u = await createUser({ tag: `Cuenta${rnd()}` });
    const alias = (await req('GET', '/auth/me', { token: u.token })).body.tag;
    expect((await req('PATCH', `/api/v1/admin/players/${id}`, { token: adm.token, body: { user_id: u.id } })).body.nick).toBe(alias);
    expect((await req('PATCH', `/api/v1/admin/players/${id}`, { token: adm.token, body: { nick: 'Otro' } })).status).toBe(400);
    const users = await req('GET', `/api/v1/admin/users?q=${encodeURIComponent(alias)}`, { token: adm.token });
    expect(users.body).toEqual([expect.objectContaining({ id: u.id, alias, player_id: id })]);

    const sinPartidas = (await req('POST', '/api/v1/admin/players', { token: adm.token, body: { nick: `Borrar${rnd()}` } })).body.id;
    expect((await req('DELETE', `/api/v1/admin/players/${sinPartidas}`, { token: adm.token })).status).toBe(204);
    expect((await req('DELETE', `/api/v1/admin/players/${sinPartidas}`, { token: adm.token })).status).toBe(404);
  });

  it('palabras bloqueadas: alta normalizada, baja y nombres de equipo con force', async () => {
    const w = await req('POST', '/api/v1/admin/blocked-words', { token: adm.token, body: { word: `Qw 3${rnd()}` } });
    expect(w.body.word).toMatch(/^qwe[a-z]*$/);
    const blocked = await req('POST', '/api/v1/admin/teams', { token: adm.token, body: { name: `Los ${w.body.word}`, tag: 'X' } });
    expect(blocked.body.error.details[0].path).toBe('name');
    expect((await req('POST', '/api/v1/admin/teams', { token: adm.token, body: { name: `Los ${w.body.word}`, tag: 'X', force: true } })).status).toBe(201);
    expect((await req('GET', '/api/v1/admin/blocked-words', { token: adm.token })).body).toContainEqual(expect.objectContaining({ id: w.body.id }));
    expect((await req('DELETE', `/api/v1/admin/blocked-words/${w.body.id}`, { token: adm.token })).status).toBe(204);
  });
});

describe('más casos del plantel y del admin', () => {
  it('rechazar y cancelar invitaciones y pedidos; crear un equipo con capitán', async () => {
    const cap = await player();
    const t = await req('POST', '/api/v1/admin/teams', { token: adm.token, body: { name: `ConCapi ${rnd()}`, tag: 'cc', captain_player_id: cap.playerId } });
    expect(t.status).toBe(201);
    const team = t.body.id as string;
    expect((await req('GET', `/api/v1/teams/${team}`)).body).toMatchObject({ members: 1, captain: { player_id: cap.playerId } });

    const a = await player();
    const inv = (await req('POST', `/api/v1/teams/${team}/invites`, { token: cap.token, body: { player_id: a.playerId } })).body.id;
    expect((await req('POST', `/api/v1/team-invites/${inv}/reject`, { token: a.token })).status).toBe(204);
    const inv2 = (await req('POST', `/api/v1/teams/${team}/invites`, { token: cap.token, body: { player_id: a.playerId } })).body.id;
    expect((await req('DELETE', `/api/v1/team-invites/${inv2}`, { token: cap.token })).status).toBe(204);
    const jr = (await req('POST', `/api/v1/teams/${team}/join-requests`, { token: a.token })).body.id;
    expect((await req('GET', '/api/v1/me/team-invites', { token: a.token })).body.requests).toHaveLength(1);
    expect((await req('DELETE', `/api/v1/join-requests/${jr}`, { token: a.token })).status).toBe(204);
    const jr2 = (await req('POST', `/api/v1/teams/${team}/join-requests`, { token: a.token })).body.id;
    expect((await req('POST', `/api/v1/join-requests/${jr2}/reject`, { token: cap.token })).status).toBe(204);
    expect((await req('GET', '/api/v1/me/team-invites', { token: a.token })).body).toEqual({ invites: [], requests: [] });
    expect((await req('GET', `/api/v1/teams/${team}`)).body.members).toBe(1);

    // Un usuario sin jugador no tiene invitaciones; una cuenta sin jugador no puede ser capitán.
    const solo = await createUser();
    expect((await req('GET', '/api/v1/me/team-invites', { token: solo.token })).body).toEqual({ invites: [], requests: [] });
    const nop = (await req('POST', '/api/v1/admin/players', { token: adm.token, body: { nick: `SinCta${rnd()}` } })).body.id;
    expect((await req('PATCH', `/api/v1/admin/teams/${team}`, { token: adm.token, body: { captain_player_id: nop } })).status).toBe(400);
    expect((await req('PATCH', `/api/v1/admin/teams/${team}`, { token: adm.token, body: { name: `Renombrado ${rnd()}` } })).status).toBe(204);
    expect((await req('DELETE', `/api/v1/admin/teams/${team}`, { token: adm.token })).status).toBe(204);
  });

  it('reclamo de perfil (deprecado): aprobar vincula el jugador a la cuenta', async () => {
    const u = await createUser({ tag: `Recl${rnd()}` });
    const pl = (await req('POST', '/api/v1/admin/players', { token: adm.token, body: { nick: `Libre${rnd()}` } })).body.id;
    const r = await req('POST', '/api/v1/me/profile-requests', { token: u.token, body: { player_id: pl } });
    expect(r.status).toBe(201);
    const list = await req('GET', '/api/v1/admin/profile-requests', { token: adm.token });
    expect(list.body).toContainEqual(expect.objectContaining({ id: r.body.id, user_id: u.id, status: 'pending' }));
    expect((await req('POST', `/api/v1/admin/profile-requests/${r.body.id}/approve`, { token: adm.token })).status).toBe(204);
    expect((await req('POST', `/api/v1/admin/profile-requests/${r.body.id}/reject`, { token: adm.token })).status).toBe(400);
    expect((await req('GET', `/api/v1/players/${pl}`)).body).toMatchObject({ has_account: true });
  });

  it('foto de un jugador', async () => {
    const pl = (await req('POST', '/api/v1/admin/players', { token: adm.token, body: { nick: `Foto${rnd()}` } })).body.id;
    // PNG de 1x1.
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (ch) => ch.charCodeAt(0));
    const up = async () => {
      const fd = new FormData();
      fd.append('file', new File([png], 'a.png', { type: 'image/png' }));
      return app.request(`/api/v1/admin/players/${pl}/photo`, { method: 'POST', headers: { Authorization: `Bearer ${adm.token}` }, body: fd }, env);
    };
    const first = await up();
    expect(first.status).toBe(200);
    const url = (await first.json()).avatar_url as string;
    expect(url).toContain(`/photos/players/${pl}/`);
    expect((await up()).status).toBe(200);
    expect((await req('GET', `/api/v1/players/${pl}`)).body.photo_url).not.toBe(url);
  });
});
