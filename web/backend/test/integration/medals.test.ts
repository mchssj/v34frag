import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Medallas configurables contra la Supabase local (replanteo 79): crear desde una plantilla, calcular, activar con y sin
// retroactiva, el motor (medals_evaluate_pending), el progreso, el perfil privado, la manual de Fichas y los permisos.
// Usa un objetivo de kills que solo alcanzan las fichas de prueba, para no tocar a los jugadores de la base local.
// Las stats de la BETA no cuentan (2026-11-06): si la base no tiene temporada 2, se crea una (desde el 2000) y se borra al final.
const app = createApp();
const env = localEnv();
const TARGET = 987_654;
let adminToken: string;
let userToken: string;
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
const steam = [0, 1].map((i) => `7656119${seed}${String(i).padStart(4, '0')}`);
const players = [0, 1].map(() => crypto.randomUUID());
const nicks = ['Medal', 'Motor'].map((n) => `${n}${seed}`);
const mixes = [crypto.randomUUID(), crypto.randomUUID()];
let defId: string;
let season2: string | undefined;

const call = (method: string, path: string, body?: unknown, token = adminToken) =>
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
const stats = (match: string, steamId: string, playerId: string, kills: number) => ({
  match_id: match, steam_id: steamId, player_id: playerId, team: 1, nick: 'x', rounds: 26, rating: 1, kills, deaths: 10, headshots: 0, k1: 0,
});

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
  userToken = (await createUser()).token;
  const a = admin();
  check(await a.from('players').insert(players.map((id, i) => ({ id, nick: nicks[i], steam_id: steam[i] }))));
  const at = new Date().toISOString();
  check(await a.from('matches').insert(mixes.map((id) => ({ id, kind: 'mix', status: 'finished', map: 'nuke', score1: 16, score2: 10, winner_side: 1, played_at: at }))));
  if (!check(await a.rpc('medal_stats_since' as never)).data) {
    const cfg = check(await a.from('season_config').select('top_n, reset_pct, reset_floor, tiers').single()).data!;
    const others = check(await a.from('seasons').select('number, status')).data ?? [];
    const active = others.some((x) => x.status === 'active');
    season2 = check(
      await a.from('seasons').insert({
        ...cfg, number: Math.max(1, ...others.map((x) => x.number)) + 1, name: `Medallas ${seed}`, min_matches: 1,
        starts_at: '2000-01-01T00:00:00Z', ends_at: active ? '2000-01-02T00:00:00Z' : '2099-01-01T00:00:00Z',
        ...(active ? { status: 'closed', closed_at: '2000-01-02T00:00:00Z' } : {}),
      }).select('id').single(),
    ).data!.id;
    await a.from('medal_queue').delete().not('player_id', 'is', null);   // el trigger anota a todos: aquí no hacen falta
  }
  check(await a.from('match_player_stats').insert([stats(mixes[0]!, steam[0]!, players[0]!, TARGET)]));
});

afterAll(async () => {
  const a = admin();
  await a.from('player_medals').delete().in('player_id', players);
  if (defId) {
    await a.from('notifications').delete().filter('data->medal->>id', 'eq', defId);
    await a.from('medal_definitions').delete().eq('id', defId);
  }
  await a.from('medal_queue').delete().in('player_id', players);
  await a.from('match_player_stats').delete().in('match_id', mixes);
  await a.from('matches').delete().in('id', mixes);
  await a.from('players').delete().in('id', players);
  if (season2) await a.from('seasons').delete().eq('id', season2);
});

describe('medallas configurables', () => {
  it('un usuario no entra al admin', async () => {
    expect((await call('GET', '/api/v1/admin/medals/definitions', undefined, userToken)).status).toBe(403);
    expect((await call('POST', '/api/v1/admin/medals/definitions', { template: 'kills', target: TARGET }, userToken)).status).toBe(403);
  });

  it('crea un borrador desde una plantilla: la condición sale del manifiesto', async () => {
    const res = await call('POST', '/api/v1/admin/medals/definitions', {
      template: 'kills', target: TARGET, design: { number: '1M', label: 'kills', metal: 'diamante', band: 'no va' },
    });
    expect(res.status).toBe(201);
    const d = (await res.json()) as Record<string, unknown> & { design: Record<string, unknown> };
    defId = d.id as string;
    expect(d).toMatchObject({ key: `kills_${TARGET}`, status: 'draft', metric: 'kills', aggregation: 'total', series: 'kills', holders: 0 });
    // La plantilla de kills no tiene banda: se descarta.
    expect(d.design).toMatchObject({ template: 'kills', number: '1M', label: 'KILLS', metal: 'diamante', band: null });
    const pub = (await (await call('GET', '/api/v1/medals/definitions', undefined, '')).json()) as { items: { id: string }[] };
    expect(pub.items.some((x) => x.id === defId)).toBe(false);
    expect((await call('POST', '/api/v1/admin/medals/definitions', { template: 'kills', target: TARGET })).status).toBe(409);
    expect((await call('POST', '/api/v1/admin/medals/definitions', { template: 'no_existe', target: 1 })).status).toBe(400);
    expect((await call('POST', '/api/v1/admin/medals/definitions', { template: 'primer_mix', target: 5 })).status).toBe(400);
  });

  it('calcula y activa con retroactiva', async () => {
    const pre = (await (await call('POST', '/api/v1/admin/medals/preview', { template: 'kills', target: TARGET })).json()) as { players: number };
    expect(pre.players).toBe(1);
    const res = await call('POST', `/api/v1/admin/medals/definitions/${defId}/activate`, { retroactive: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ awarded: 1, definition: { status: 'active', holders: 1 } });
    const list = (await (await call('GET', `/api/v1/players/${players[0]}/medals`, undefined, '')).json()) as { items: { design: { id: string }; source: string }[] };
    expect(list.items.find((m) => m.design.id === defId)).toMatchObject({ source: 'auto' });
  });

  it('el objetivo de una activa no cambia; el dibujo sí', async () => {
    expect((await call('PATCH', `/api/v1/admin/medals/definitions/${defId}`, { target: TARGET + 1 })).status).toBe(400);
    const res = await call('PATCH', `/api/v1/admin/medals/definitions/${defId}`, { design: { metal: 'oro' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ design: { metal: 'oro', number: '1M' } });
  });

  it('al guardar el mix la da en el acto; el cron queda de respaldo', async () => {
    const a = admin();
    check(await a.from('match_player_stats').insert([stats(mixes[1]!, steam[1]!, players[1]!, TARGET)]));
    expect((await a.from('player_medals').select('id').eq('player_id', players[1]!).eq('definition_id', defId)).data?.length).toBe(1);
    expect((await a.from('medal_queue').select('player_id').eq('player_id', players[1]!)).data?.length).toBe(0);
    const tick = check(await a.rpc('medals_evaluate_pending', { p_limit: 5000 })).data as { medals: number };
    expect(tick.medals).toBe(0);
  });

  it('progreso: solo el dueño (y el admin) lo ven; los demás, solo las ganadas', async () => {
    type Progress = { hidden: boolean; stats_since: string | null; items: { design: { id: string }; value: number; earned_at: string | null }[] };
    const get = async (token: string) =>
      (await (await call('GET', `/api/v1/players/${players[0]}/medals/progress`, undefined, token)).json()) as Progress;
    const owner = await createUser();
    check(await admin().from('players').update({ user_id: owner.id }).eq('id', players[0]!));
    try {
      const mine = await get(owner.token);
      expect(mine.hidden).toBe(false);
      expect(mine.stats_since).not.toBeNull();
      const won = mine.items.find((x) => x.design.id === defId);
      expect(won?.value).toBe(TARGET);
      expect(won?.earned_at).not.toBeNull();
      expect(mine.items.some((x) => x.earned_at === null)).toBe(true);
      expect((await get(adminToken)).hidden).toBe(false);
      for (const token of [userToken, '']) {
        const other = await get(token);
        expect(other.hidden).toBe(true);
        expect(other.items.length).toBeGreaterThan(0);
        expect(other.items.every((x) => x.earned_at !== null)).toBe(true);
      }
    } finally {
      check(await admin().from('players').update({ user_id: null }).eq('id', players[0]!));
    }
  });

  it('Fichas: solo medallas manuales, con su título', async () => {
    const defs = (await (await call('GET', '/api/v1/admin/medals/definitions')).json()) as { items: { id: string; key: string }[] };
    const manual = defs.items.find((x) => x.key === 'campeon_torneo')!;
    const res = await call('POST', `/api/v1/admin/players/${players[0]}/medals`, { definition_id: manual.id, title: 'Torneo de prueba' });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ title: 'Torneo de prueba', source: 'admin', design: { template: 'campeon_torneo' } });
    expect((await call('POST', `/api/v1/admin/players/${players[0]}/medals`, { definition_id: defId })).status).toBe(400);
  });

  it('no se archiva una de temporada usada en los tramos; la de carrera sí y se conserva', async () => {
    const all = (await (await call('GET', '/api/v1/admin/medals/definitions')).json()) as { items: { id: string; key: string }[] };
    const podio = all.items.find((x) => x.key === 'season_podio_1')!;
    expect((await call('POST', `/api/v1/admin/medals/definitions/${podio.id}/archive`)).status).toBe(400);
    const res = await call('POST', `/api/v1/admin/medals/definitions/${defId}/archive`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'archived', holders: 2 });
    expect((await call('DELETE', `/api/v1/admin/medals/definitions/${defId}`)).status).toBe(400);
  });

  it('durante la BETA (sin temporada 2) no cuenta nada y el progreso lo dice', async () => {
    if (!season2) return;   // la base ya tenía una temporada 2 propia: no se toca
    const a = admin();
    check(await a.from('seasons').delete().eq('id', season2));
    season2 = undefined;
    const body = (await (await call('GET', `/api/v1/players/${players[0]}/medals/progress`)).json()) as {
      stats_since: string | null; items: { value: number; earned_at: string | null }[];
    };
    expect(body.stats_since).toBeNull();
    expect(body.items.filter((x) => x.earned_at === null).every((x) => x.value === 0)).toBe(true);
    check(await a.from('player_medals').delete().eq('player_id', players[1]!).eq('source', 'auto'));
    check(await a.from('match_player_stats').update({ kills: TARGET }).eq('match_id', mixes[1]!));   // se vuelve a guardar el mix
    expect((await a.from('player_medals').select('id').eq('player_id', players[1]!).eq('source', 'auto')).data?.length).toBe(0);
  });
});
