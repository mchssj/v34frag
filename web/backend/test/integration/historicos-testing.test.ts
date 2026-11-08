import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Torneos históricos, aprobación de organizadores y fase de testing (replanteo 80).
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

/** Equipo oficial con un jugador con SteamID. */
async function team() {
  const sb = admin();
  const t = (await sb.from('teams').insert({ name: `HT ${rnd()}`, tag: rnd().slice(0, 5).toUpperCase(), kind: 'official' }).select('id').single()).data!;
  const p = (await sb.from('players').insert({ nick: `HT${rnd()}${rnd()}`, steam_id: steam() }).select('id').single()).data!;
  const r = await sb.from('team_members').insert({ team_id: t.id, player_id: p.id, joined_at: new Date().toISOString() });
  if (r.error) throw r.error;
  return { id: t.id as string, player: p.id as string };
}

let adm: U;
let org: U;
let mod: U;
let user: U;
beforeAll(async () => {
  adm = await createUser({ role: 'admin' });
  org = await createUser({ tag: `Org${rnd()}` });
  mod = await createUser({ tag: `Mod${rnd()}` });
  user = await createUser();
  expect((await req('PUT', `/api/v1/admin/users/${org.id}/role`, { token: adm.token, body: { role: 'organizer' } })).status).toBe(204);
  expect((await req('PUT', `/api/v1/admin/users/${mod.id}/role`, { token: adm.token, body: { role: 'moderator' } })).status).toBe(204);
});

describe('aprobación de lo que crea un organizador', () => {
  it('nace pendiente, solo lo ven él y el staff; se rechaza con motivo, se reenvía y se aprueba', async () => {
    const ev = (await req('POST', '/api/v1/events', { token: org.token, body: { name: `Pend ${rnd()}`, template: 'single' } })).body.id as string;
    expect((await req('GET', `/api/v1/events/${ev}`, { token: org.token })).body).toMatchObject({ approval: 'pending', historic: false, testing: false });
    expect((await req('GET', `/api/v1/events/${ev}`)).status).toBe(404);
    expect((await req('GET', `/api/v1/events/${ev}`, { token: user.token })).status).toBe(404);
    const pend = await req('GET', '/api/v1/events?approval=pending&per=100', { token: mod.token });
    expect(pend.body.items.some((e: { id: string }) => e.id === ev)).toBe(true);
    expect((await req('GET', `/api/v1/events/${ev}`, { token: mod.token })).body.viewer).toEqual({ can_manage: true, can_own: false, can_review: true, can_approve: true });

    expect((await req('POST', `/api/v1/events/${ev}/review`, { token: org.token, body: { approve: true } })).status).toBe(403);
    expect((await req('POST', `/api/v1/events/${ev}/review`, { token: mod.token, body: { approve: false } })).status).toBe(400);
    expect((await req('POST', `/api/v1/events/${ev}/review`, { token: mod.token, body: { approve: false, note: 'Falta el reglamento' } })).status).toBe(204);
    expect((await req('GET', `/api/v1/events/${ev}`, { token: org.token })).body).toMatchObject({ approval: 'rejected', approval_note: 'Falta el reglamento' });
    expect((await req('POST', `/api/v1/events/${ev}/review`, { token: mod.token, body: { approve: true } })).status).toBe(409);
    expect((await req('POST', `/api/v1/events/${ev}/resubmit`, { token: mod.token })).status).toBe(403);
    expect((await req('POST', `/api/v1/events/${ev}/resubmit`, { token: org.token })).status).toBe(204);
    expect((await req('POST', `/api/v1/events/${ev}/review`, { token: adm.token, body: { approve: true } })).status).toBe(204);
    expect((await req('GET', `/api/v1/events/${ev}`)).body).toMatchObject({ approval: 'approved', approval_note: null });
  });

  it('(replanteo 84) el moderador crea normales e históricos, pendientes de un admin: otro moderador no los aprueba', async () => {
    const mod2 = await createUser({ tag: `Mod2${rnd()}` });
    expect((await req('PUT', `/api/v1/admin/users/${mod2.id}/role`, { token: adm.token, body: { role: 'moderator' } })).status).toBe(204);
    const normal = await req('POST', '/api/v1/events', { token: mod.token, body: { name: `M ${rnd()}`, template: 'single' } });
    expect(normal.status).toBe(201);
    expect((await req('POST', '/api/v1/events', { token: mod.token, body: { name: `M ${rnd()}`, template: 'single', historic: true } })).status).toBe(400);
    const hist = await req('POST', '/api/v1/events', {
      token: mod.token, body: { name: `M ${rnd()}`, template: 'single', historic: true, starts_on: '2025-03-01', ends_on: '2025-03-02' },
    });
    expect(hist.status).toBe(201);
    for (const id of [normal.body.id, hist.body.id]) {
      expect((await req('GET', `/api/v1/events/${id}`, { token: mod.token })).body).toMatchObject({ approval: 'pending', admin_review: true });
      expect((await req('GET', `/api/v1/events/${id}`)).status).toBe(404);
    }
    const ev = normal.body.id as string;
    expect((await req('GET', `/api/v1/events/${ev}`, { token: mod.token })).body.viewer).toEqual({ can_manage: true, can_own: true, can_review: true, can_approve: false });
    expect((await req('GET', `/api/v1/events/${ev}`, { token: mod2.token })).body.viewer).toEqual({ can_manage: true, can_own: false, can_review: true, can_approve: false });
    expect((await req('GET', `/api/v1/events/${ev}`, { token: adm.token })).body.viewer).toMatchObject({ can_approve: true });
    const forAdmin = await req('GET', '/api/v1/events?approval=pending&admin_review=true&per=100', { token: mod2.token });
    expect(forAdmin.body.items.some((e: { id: string }) => e.id === ev)).toBe(true);
    const forStaff = await req('GET', '/api/v1/events?approval=pending&admin_review=false&per=100', { token: mod2.token });
    expect(forStaff.body.items.some((e: { id: string }) => e.id === ev)).toBe(false);

    expect((await req('POST', `/api/v1/events/${ev}/review`, { token: mod.token, body: { approve: true } })).status).toBe(403);
    expect((await req('POST', `/api/v1/events/${ev}/review`, { token: mod2.token, body: { approve: false, note: 'No' } })).status).toBe(403);
    expect((await req('POST', `/api/v1/events/${ev}/review`, { token: adm.token, body: { approve: false, note: 'Falta el premio' } })).status).toBe(204);
    expect((await req('POST', `/api/v1/events/${ev}/resubmit`, { token: mod.token })).status).toBe(204);
    expect((await req('POST', `/api/v1/events/${ev}/review`, { token: adm.token, body: { approve: true } })).status).toBe(204);
    expect((await req('GET', `/api/v1/events/${ev}`)).body).toMatchObject({ approval: 'approved', admin_review: true });

    // Avisos de revisión: solo a los admins
    const sb = admin();
    const notes = await sb.from('notifications').select('user_id').eq('type', 'admin_event_review').eq('data->event->>id', hist.body.id);
    expect(notes.data?.some((n) => n.user_id === adm.id)).toBe(true);
    expect(notes.data?.some((n) => n.user_id === mod2.id)).toBe(false);
    // El moderador borra lo suyo; otro moderador no
    expect((await req('DELETE', `/api/v1/events/${hist.body.id}`, { token: mod2.token })).status).toBeGreaterThanOrEqual(403);
    expect((await req('DELETE', `/api/v1/events/${hist.body.id}`, { token: mod.token })).status).toBe(204);
  });

  it('(replanteo 84) el premio con monto y divisa', async () => {
    const ok = await req('POST', '/api/v1/events', {
      token: adm.token, body: { name: `P ${rnd()}`, template: 'single', prize: '+ rol en Discord', prize_amount: 50000, prize_currency: 'ARS' },
    });
    expect(ok.status).toBe(201);
    expect((await req('GET', `/api/v1/events/${ok.body.id}`)).body).toMatchObject({
      prize: '+ rol en Discord', prize_amount: 50000, prize_currency: 'ARS', prize_currency_other: null,
    });
    const list = await req('GET', `/api/v1/events?q=${encodeURIComponent('P ')}&per=100`);
    expect(list.body.items.find((e: { id: string }) => e.id === ok.body.id)).toMatchObject({ prize_amount: 50000, prize_currency: 'ARS' });
    expect((await req('PATCH', `/api/v1/events/${ok.body.id}`, {
      token: adm.token, body: { prize_amount: 200.5, prize_currency: 'other', prize_currency_other: 'BRL' },
    })).status).toBe(204);
    expect((await req('GET', `/api/v1/events/${ok.body.id}`)).body).toMatchObject({ prize_amount: 200.5, prize_currency: 'other', prize_currency_other: 'BRL' });
    expect((await req('PATCH', `/api/v1/events/${ok.body.id}`, {
      token: adm.token, body: { prize_amount: null, prize_currency: null, prize_currency_other: null },
    })).status).toBe(204);
    for (const body of [
      { prize_amount: 10 },
      { prize_currency: 'USD' },
      { prize_amount: 10, prize_currency: 'other' },
      { prize_amount: 10, prize_currency: 'USD', prize_currency_other: 'BRL' },
    ]) {
      const r = await req('POST', '/api/v1/events', { token: adm.token, body: { name: `P ${rnd()}`, template: 'single', ...body } });
      expect(r.status).toBe(400);
      expect(r.body.error.message).toMatch(/premio/);
    }
    expect((await req('POST', '/api/v1/events', { token: adm.token, body: { name: `P ${rnd()}`, template: 'single', prize_amount: 0, prize_currency: 'USD' } })).status).toBe(400);
  });
});

describe('fase de testing', () => {
  it('solo admin o moderador; oculto para los demás, también para el organizador dueño', async () => {
    expect((await req('POST', '/api/v1/events', { token: org.token, body: { name: `T ${rnd()}`, template: 'single', testing: true } })).status).toBe(403);
    const ev = (await req('POST', '/api/v1/events', { token: adm.token, body: { name: `T ${rnd()}`, template: 'single', testing: true } })).body.id as string;
    for (const who of [undefined, user.token]) expect((await req('GET', `/api/v1/events/${ev}`, { token: who })).status).toBe(404);
    const list = await req('GET', '/api/v1/events?testing=true&per=100');
    expect(list.body.items.some((e: { id: string }) => e.id === ev)).toBe(false);
    const staff = await req('GET', '/api/v1/events?testing=true&per=100', { token: mod.token });
    expect(staff.body.items.find((e: { id: string }) => e.id === ev)).toMatchObject({ testing: true });
    expect((await req('PATCH', `/api/v1/events/${ev}`, { token: mod.token, body: { testing: false } })).status).toBe(204);
    expect((await req('GET', `/api/v1/events/${ev}`)).body.testing).toBe(false);
  });
});

describe('torneo histórico', () => {
  it('equipos de la plataforma e históricos, mix viejo por aprobar, resultado a mano con fecha y W.O. con fecha', async () => {
    const sb = admin();
    const ev = (
      await req('POST', '/api/v1/events', {
        token: org.token,
        body: { name: `Hist ${rnd()}`, template: 'single', historic: true, starts_on: '2025-07-12', ends_on: '2025-07-20', config: { bo: 1, bo_semi: 1, bo_final: 1 } },
      })
    ).body.id as string;
    const [a, b] = [await team(), await team()];
    // Equipos de la plataforma: uno con su jugador, otro sin jugadores
    expect((await req('PUT', `/api/v1/events/${ev}/registrations/${a.id}`, { token: org.token, body: { active: [a.player] } })).status).toBe(204);
    expect((await req('PUT', `/api/v1/events/${ev}/registrations/${b.id}`, { token: org.token, body: { active: [] } })).status).toBe(204);
    // Equipos históricos
    const name = `Lobos ${rnd()}`;
    const c = await req('POST', `/api/v1/events/${ev}/historic-teams`, { token: org.token, body: { name, tag: 'LOB' } });
    expect(c.status).toBe(201);
    const d = await req('POST', `/api/v1/events/${ev}/historic-teams`, { token: org.token, body: { name: `Alfa ${rnd()}`, tag: 'ALF' } });
    const similar = await req('GET', `/api/v1/events/${ev}/similar-teams?q=${encodeURIComponent(name.slice(0, 9))}`, { token: org.token });
    expect(similar.body.items).toContainEqual(expect.objectContaining({ id: c.body.id, kind: 'historic' }));
    expect((await req('PATCH', `/api/v1/historic-teams/${c.body.id}`, { token: org.token, body: { name: `${name} FC`, tag: 'lob' } })).status).toBe(204);
    expect((await req('PATCH', `/api/v1/historic-teams/${c.body.id}`, { token: user.token, body: { name: 'X equipo', tag: 'X' } })).status).toBe(403);
    expect((await req('GET', `/api/v1/teams/${c.body.id}`)).status).toBe(404);

    expect((await req('PUT', `/api/v1/events/${ev}/seeds`, { token: org.token, body: { teams: [a.id, b.id, c.body.id, d.body.id] } })).status).toBe(204);
    const regs = await req('GET', `/api/v1/events/${ev}/registrations`, { token: org.token });
    expect(regs.body.items.find((r: { team: { id: string } }) => r.team.id === c.body.id).team).toMatchObject({ name: `${name} FC`, tag: 'LOB', historic: true });
    expect(regs.body.items.find((r: { team: { id: string } }) => r.team.id === a.id).team.historic).toBeUndefined();
    expect((await req('POST', `/api/v1/events/${ev}/generate`, { token: org.token })).status).toBe(204);
    const ms = (await req('GET', `/api/v1/events/${ev}/matches`, { token: org.token })).body.items;
    const semiA = ms.find((m: { side1: { team: { id: string } }; side2: { team: { id: string } } }) => [m.side1.team?.id, m.side2.team?.id].includes(a.id));
    const semiB = ms.find((m: { side1: { team: { id: string } }; side2: { team: { id: string } } }) => [m.side1.team?.id, m.side2.team?.id].includes(b.id));
    expect([semiA.side1.team, semiA.side2.team].find((t: { id: string }) => t.id === d.body.id).historic).toBe(true);

    // Semi A: un mix de hace 40 días, vinculado por el organizador (queda por aprobar)
    const srv = (await sb.from('game_servers').insert({ name: `ht-${rnd()}`, token_hash: rnd() + rnd(), active: true }).select('id').single()).data!.id as string;
    const g = (
      await sb.from('matches').insert({ kind: 'mix', status: 'finished', map: 'de_dust2', score1: 16, score2: 10, server_id: srv, played_at: new Date(Date.now() - 40 * 864e5).toISOString() }).select('id').single()
    ).data!.id as string;
    const cands = await req('GET', `/api/v1/matches/${semiA.id}/games/candidates?server=${srv}`, { token: org.token });
    expect(cands.body).toMatchObject({ total: 1, items: [expect.objectContaining({ game_id: g, linked: false, approved: null })] });
    const side1 = semiA.side1.team.id === a.id ? 1 : 2;
    expect((await req('PUT', `/api/v1/matches/${semiA.id}/maps`, { token: org.token, body: { maps: [{ game_id: g, side1 }] } })).status).toBe(204);
    const pub = await req('GET', `/api/v1/matches/${semiA.id}`, { token: org.token });
    expect(pub.body.maps_detail[0]).toMatchObject({ game_id: g, approved: false });
    // Los demás no ven el mix por aprobar (cuando el torneo se publique); el staff lo tiene en su lista
    const pending = await req('GET', `/api/v1/admin/pending-games?match=${semiA.id}`, { token: mod.token });
    expect(pending.body).toMatchObject({ total: 1, items: [{ game: { id: g, map: 'de_dust2' }, match: { id: semiA.id } }] });
    expect((await req('GET', '/api/v1/admin/pending-games', { token: org.token })).status).toBe(403);

    // Semi B: a mano, con fecha
    const bIs1 = semiB.side1.team.id === b.id;
    expect(
      (await req('PUT', `/api/v1/matches/${semiB.id}/maps`, { token: org.token, body: { maps: [{ map: 'de_nuke', r1: bIs1 ? 13 : 16, r2: bIs1 ? 16 : 13, played_at: '2025-07-15' }] } })).status,
    ).toBe(204);
    expect((await req('GET', `/api/v1/matches/${semiB.id}`, { token: org.token })).body).toMatchObject({ played_at: expect.stringContaining('2025-07-15'), maps_detail: [{ played_at: expect.stringContaining('2025-07-15'), approved: null }] });

    // Final por W.O. con fecha
    const fin = (await req('GET', `/api/v1/events/${ev}/matches?round=2`, { token: org.token })).body.items[0];
    expect((await req('POST', `/api/v1/matches/${fin.id}/result`, { token: org.token, body: { walkover: a.id, played_at: '2025-07-20' } })).status).toBe(204);
    expect((await req('GET', `/api/v1/matches/${fin.id}`, { token: org.token })).body.played_at).toContain('2025-07-20');

    // Aprobado el torneo: se ve, y el mix queda aprobado
    expect((await req('POST', `/api/v1/events/${ev}/review`, { token: mod.token, body: { approve: true } })).status).toBe(204);
    const seen = await req('GET', `/api/v1/matches/${semiA.id}`);
    expect(seen.body.maps_detail[0]).toMatchObject({ game_id: g, approved: true });
    expect(seen.body.games.map((x: { id: string }) => x.id)).toEqual([g]);
    expect((await req('GET', `/api/v1/events/${ev}`)).body).toMatchObject({ status: 'finished', champion: { id: a.id }, pending_games: 0 });
  });

  it('un mix vinculado por un organizador en un torneo público no se ve hasta que se aprueba; rechazado queda a mano', async () => {
    const sb = admin();
    const ev = (await req('POST', '/api/v1/events', { token: org.token, body: { name: `Pub ${rnd()}`, template: 'single', game_mode: '1v1', config: { bo: 1, bo_semi: 1, bo_final: 1 } } })).body.id as string;
    expect((await req('POST', `/api/v1/events/${ev}/review`, { token: adm.token, body: { approve: true } })).status).toBe(204);
    const [a, b] = [await team(), await team()];
    for (const t of [a, b]) {
      const r1 = await sb.from('tournament_registrations').insert({ event_id: ev, team_id: t.id });
      if (r1.error) throw r1.error;
      const r2 = await sb.from('tournament_registration_players').insert({ event_id: ev, team_id: t.id, player_id: t.player });
      if (r2.error) throw r2.error;
    }
    expect((await req('POST', `/api/v1/events/${ev}/generate`, { token: org.token })).status).toBe(204);
    const m = (await req('GET', `/api/v1/events/${ev}/matches`)).body.items[0];
    const g = (await sb.from('matches').insert({ kind: 'mix', status: 'finished', map: 'de_inferno', score1: 16, score2: 9, played_at: new Date().toISOString() }).select('id').single()).data!.id as string;
    expect((await req('PUT', `/api/v1/matches/${m.id}/maps`, { token: org.token, body: { maps: [{ game_id: g, side1: 1 }] } })).status).toBe(204);
    const anon = await req('GET', `/api/v1/matches/${m.id}`);
    expect(anon.body).toMatchObject({ status: 'finished', games: [], maps_detail: [{ map: 'de_inferno', game_id: null, approved: false }] });
    expect((await req('GET', `/api/v1/events/${ev}`, { token: mod.token })).body.pending_games).toBe(1);
    expect((await req('POST', `/api/v1/matches/${m.id}/games/${g}/review`, { token: org.token, body: { approve: false } })).status).toBe(403);
    expect((await req('POST', `/api/v1/matches/${m.id}/games/${g}/review`, { token: mod.token, body: { approve: false } })).status).toBe(204);
    const after = await req('GET', `/api/v1/matches/${m.id}`);
    expect(after.body).toMatchObject({ status: 'finished', games: [], maps_detail: [{ map: 'de_inferno', r1: 16, r2: 9, game_id: null, approved: null }] });
  });
});
