import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';
import { manualDefinitionId } from './manual-medal';

// Pines y premios de torneo contra la Supabase local (replanteo 123): configurar al crear, jugar un torneo de 4 equipos
// (1v1, BO1), los pines por puesto, la vitrina del jugador y del equipo, cambiar la configuración con el torneo
// terminado (y el registro), y elegir un premio a mano (sin stats: del plantel), con los permisos.
const app = createApp();
const env = localEnv();
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
let adminToken: string;
let ownerToken: string;
let otherToken: string;
let eventId: string;
const teams: string[] = [];
const players: string[] = [];
let ownerNick: string;

const call = (method: string, path: string, body?: unknown, token: string | undefined = adminToken) =>
  app.request(
    path,
    {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
  ownerNick = `PinA${seed}`;
  const owner = await createUser({ tag: ownerNick });
  ownerToken = owner.token;
  otherToken = (await createUser()).token;
  const a = admin();
  // Equipo A (el que gana todo): su jugador es la ficha de `owner`.
  for (const [i, name] of ['A', 'B', 'C', 'D'].entries()) {
    const t = check(await a.from('teams').insert({ name: `Pin${seed} ${name}`, tag: `P${name}${seed.slice(0, 3)}` }).select('id').single()).data!.id;
    teams.push(t);
    const p = check(
      await a.from('players').insert({ nick: i === 0 ? ownerNick : `Pin${name}${seed}`, ...(i === 0 ? { user_id: owner.id } : {}) }).select('id').single(),
    ).data!.id;
    players.push(p);
  }
  const r = await call('POST', '/api/v1/events', {
    name: `Copa Pines ${seed}`,
    template: 'single',
    config: { bo: 1, bo_semi: 1, bo_final: 1 },
    game_mode: '1v1',
    pins: { style: 'cristal', tiers: { semifinalist: { min_teams: null } } },
  });
  expect(r.status).toBe(201);
  eventId = ((await r.json()) as { id: string }).id;
  check(await a.from('tournament_registrations').insert(teams.map((team_id) => ({ event_id: eventId, team_id }))));
  check(
    await a.from('tournament_registration_players').insert(teams.map((team_id, i) => ({ event_id: eventId, team_id, player_id: players[i]!, role: 'active' }))),
  );
  expect((await call('POST', `/api/v1/events/${eventId}/generate`)).status).toBe(204);
  // Gana siempre el de nombre menor (A, después B…).
  for (let i = 0; i < 10; i++) {
    const m = check(
      await a.from('matches').select('id, team1, team2').eq('event_id', eventId).eq('status', 'upcoming').eq('bye', false)
        .not('team1', 'is', null).not('team2', 'is', null).limit(1),
    ).data![0];
    if (!m) break;
    const first = teams.indexOf(m.team1!) < teams.indexOf(m.team2!);
    const res = await call('POST', `/api/v1/matches/${m.id}/result`, { maps: [first ? { r1: 13, r2: 5 } : { r1: 5, r2: 13 }] });
    expect(res.status).toBe(204);
  }
});

afterAll(async () => {
  const a = admin();
  if (eventId) await a.from('events').delete().eq('id', eventId);
  if (players.length) await a.from('players').delete().in('id', players);
  if (teams.length) await a.from('teams').delete().in('id', teams);
});

describe('pines de torneo', () => {
  it('reparte un pin por equipo según el puesto, con el estilo del torneo', async () => {
    const r = await call('GET', `/api/v1/events/${eventId}/pins`, undefined, undefined);
    expect(r.status).toBe(200);
    const b = (await r.json()) as any;
    expect(b.config.style).toBe('cristal');
    expect(b.custom).toEqual({ style: 'cristal', tiers: { semifinalist: { min_teams: null } } });
    expect(b.results.map((p: any) => [p.team.id, p.tier, p.place])).toEqual([
      [teams[0], 'champion', 1],
      [teams[1], 'finalist', 2],
      expect.arrayContaining([expect.any(String), 'semifinalist', 3]),
      expect.arrayContaining([expect.any(String), 'semifinalist', 3]),
    ]);
    expect(b.results[0]).toMatchObject({ style: 'cristal', metal: 'oro', event: { id: eventId } });
    // Sin stats: los premios automáticos encendidos quedan pendientes de elegir a mano.
    expect(b.calculable.mvp).toBe(false);
    expect(b.pending).toEqual(expect.arrayContaining(['mvp', 'top_fragger']));
  });

  it('la vitrina del jugador y la del equipo', async () => {
    const r = await call('GET', `/api/v1/players/${ownerNick}/showcase`, undefined, undefined);
    expect(r.status).toBe(200);
    const b = (await r.json()) as any;
    expect(b.mode).toBe('auto');
    expect(b.pins).toHaveLength(1);
    expect(b.featured).toEqual([{ kind: 'pin', pin: expect.objectContaining({ tier: 'champion', team: expect.objectContaining({ id: teams[0] }) }) }]);
    const t = (await (await call('GET', `/api/v1/teams/${teams[1]}/pins`, undefined, undefined)).json()) as any;
    expect(t.items.map((p: any) => p.tier)).toEqual(['finalist']);
  });

  it('el jugador elige sus destacados (solo los suyos)', async () => {
    const mine = ((await (await call('GET', `/api/v1/players/${ownerNick}/showcase`, undefined, undefined)).json()) as any).pins[0].id;
    expect((await call('PUT', '/api/v1/me/showcase', { mode: 'manual', items: [] }, ownerToken)).status).toBe(204);
    let b = (await (await call('GET', `/api/v1/players/${ownerNick}/showcase`, undefined, undefined)).json()) as any;
    expect(b.mode).toBe('manual');
    expect(b.featured).toEqual([]);
    expect((await call('PUT', '/api/v1/me/showcase', { mode: 'manual', items: [{ kind: 'pin', id: mine }] }, ownerToken)).status).toBe(204);
    b = (await (await call('GET', `/api/v1/players/${ownerNick}/showcase`, undefined, undefined)).json()) as any;
    expect(b.featured).toHaveLength(1);
    // Un pin ajeno no.
    const otherPin = check(await admin().from('player_pins').select('id').eq('player_id', players[1]!).single()).data!.id;
    expect((await call('PUT', '/api/v1/me/showcase', { mode: 'manual', items: [{ kind: 'pin', id: otherPin }] }, ownerToken)).status).toBe(400);
    expect((await call('PUT', '/api/v1/me/showcase', { mode: 'manual', items: [] }, otherToken)).status).toBe(403);
  });

  it('el jugador elige los logros de su Resumen (solo los suyos)', async () => {
    const def = await manualDefinitionId();
    check(await admin().from('player_medals').insert({ player_id: players[0]!, definition_id: def, title: `Torneo de afuera ${seed}`, source: 'admin' }));
    const sum = (await (await call('GET', `/api/v1/players/${ownerNick}/medals/summary`, undefined, undefined)).json()) as any;
    const mine = sum.items.find((x: any) => x.title === `Torneo de afuera ${seed}`);
    expect(mine).toMatchObject({ definition_id: def, rank: null });
    let f = (await (await call('GET', `/api/v1/players/${ownerNick}/medals/featured`, undefined, undefined)).json()) as any;
    expect(f).toEqual({ mode: 'auto', items: [] });
    const item = { definition_id: def, title: mine.title, rank: null };
    expect((await call('PUT', '/api/v1/me/medals/featured', { mode: 'manual', items: [item] }, ownerToken)).status).toBe(204);
    f = (await (await call('GET', `/api/v1/players/${ownerNick}/medals/featured`, undefined, undefined)).json()) as any;
    expect(f).toEqual({ mode: 'manual', items: [item] });
    // Un logro que no tiene, no.
    expect((await call('PUT', '/api/v1/me/medals/featured', { mode: 'manual', items: [{ ...item, title: 'Otro' }] }, ownerToken)).status).toBe(400);
    expect((await call('PUT', '/api/v1/me/medals/featured', { mode: 'auto', items: [] }, ownerToken)).status).toBe(204);
    await admin().from('player_medals').delete().eq('player_id', players[0]!);
  });

  it('cambiar la configuración con el torneo terminado recalcula y queda registrado', async () => {
    expect((await call('PATCH', `/api/v1/events/${eventId}`, { pins: { style: 'cristal', tiers: { semifinalist: { on: false } } } })).status).toBe(204);
    let b = (await (await call('GET', `/api/v1/events/${eventId}/pins`, undefined, undefined)).json()) as any;
    expect(b.results.map((p: any) => p.tier)).toEqual(['champion', 'finalist']);
    expect((await call('PATCH', `/api/v1/events/${eventId}`, { pins: { tiers: { champion: { metal: 'bronce' } } } }, otherToken)).status).toBe(403);
    expect((await call('PATCH', `/api/v1/events/${eventId}`, { pins: { tiers: { champion: { metal: 'diamante' } } } })).status).toBe(400);
    expect((await call('PATCH', `/api/v1/events/${eventId}`, { pins: null })).status).toBe(204);
    b = (await (await call('GET', `/api/v1/events/${eventId}/pins`, undefined, undefined)).json()) as any;
    expect(b.config.style).toBe('anillos');
    // Con los valores por defecto, semifinalista pide 4 equipos: los hay.
    expect(b.results).toHaveLength(4);
    const log = check(await admin().from('event_pins_log').select('before, after').eq('event_id', eventId).order('id')).data!;
    expect(log).toHaveLength(2);
  });

  it('elegir un premio a mano: solo el organizador o un admin, entre los del plantel', async () => {
    expect((await call('GET', `/api/v1/events/${eventId}/awards/mvp/candidates`, undefined, otherToken)).status).toBe(403);
    const c = (await (await call('GET', `/api/v1/events/${eventId}/awards/mvp/candidates`)).json()) as any;
    expect(c.items.map((x: any) => x.player.id).sort()).toEqual([...players].sort());
    // Sin stats, nadie es sugerido: todo el plantel, sin cifra.
    expect(c.items.every((x: any) => x.suggested === false && x.value === null)).toBe(true);
    expect((await call('PUT', `/api/v1/events/${eventId}/awards/mvp`, { player_id: players[0] }, otherToken)).status).toBe(403);
    expect((await call('PUT', `/api/v1/events/${eventId}/awards/mvp`, { clip_id: players[0] })).status).toBe(400);
    expect((await call('PUT', `/api/v1/events/${eventId}/awards/mvp`, { player_id: players[0] })).status).toBe(204);
    let b = (await (await call('GET', `/api/v1/events/${eventId}/pins`, undefined, undefined)).json()) as any;
    expect(b.awards).toEqual([expect.objectContaining({ award: 'mvp', manual: true, player: { id: players[0], nick: ownerNick }, value: null })]);
    expect(b.pending).not.toContain('mvp');
    const s = (await (await call('GET', `/api/v1/players/${ownerNick}/showcase`, undefined, undefined)).json()) as any;
    expect(s.awards).toHaveLength(1);
    expect((await call('DELETE', `/api/v1/events/${eventId}/awards/mvp`)).status).toBe(204);
    b = (await (await call('GET', `/api/v1/events/${eventId}/pins`, undefined, undefined)).json()) as any;
    expect(b.awards).toEqual([]);
    expect(b.pending).toContain('mvp');
  });
});
