import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Medallas automáticas y Administración › Medallas contra la Supabase local (replanteo 72).
const app = createApp();
const env = localEnv();
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

async function newPlayer() {
  const { data, error } = await admin().from('players').insert({ nick: `M${rnd()}`, steam_id: steam() }).select('id, steam_id').single();
  if (error) throw error;
  return data as { id: string; steam_id: string };
}

let adm: Awaited<ReturnType<typeof createUser>>;
let season: string;

beforeAll(async () => {
  adm = await createUser({ tag: `A${rnd()}`, role: 'admin' });
  const cfg = (await admin().from('season_config').select('tiers').eq('id', 1).single()).data!;
  const now = new Date();
  const s = await admin()
    .from('seasons')
    .insert({
      number: 700 + Math.floor(Math.random() * 200), name: `Prueba ${rnd()}`, status: 'closed',
      starts_at: new Date(now.getTime() - 86400000).toISOString(), ends_at: now.toISOString(), closed_at: now.toISOString(),
      top_n: 20, min_matches: 1, reset_pct: 0, reset_floor: 2001, tiers: cfg.tiers,
    })
    .select('id')
    .single();
  if (s.error) throw s.error;
  season = s.data.id;
});

describe('Administración › Medallas', () => {
  it('da a varios con temporada, saltea repetidos, corrige y quita', async () => {
    const [a, b] = [await newPlayer(), await newPlayer()];
    const body = { title: 'Campeón de torneo', medal_key: 'campeon_torneo', season_id: season, player_ids: [a.id, b.id] };
    expect((await req('POST', '/api/v1/admin/medals', { token: (await createUser()).token, body })).status).toBe(403);

    const first = await req('POST', '/api/v1/admin/medals', { token: adm.token, body });
    expect(first).toMatchObject({ status: 201, body: { given: 2, skipped: [] } });
    const again = await req('POST', '/api/v1/admin/medals', { token: adm.token, body: { ...body, player_ids: [a.id] } });
    expect(again.body).toMatchObject({ given: 0, skipped: [a.id] });

    const pub = await req('GET', `/api/v1/players/${a.id}/medals`);
    expect(pub.body.items[0]).toMatchObject({ medal_key: 'campeon_torneo', source: 'admin', season: { id: season } });
    const sum = await req('GET', `/api/v1/players/${a.id}/medals/summary`);
    expect(sum.body.items[0]).toMatchObject({ medal_key: 'campeon_torneo', season: { number: expect.any(Number) }, count: 1 });

    const list = await req('GET', `/api/v1/admin/medals?season=${season}&medal_key=campeon_torneo&per=100`, { token: adm.token });
    expect(list.body.total).toBe(2);
    const mine = list.body.items.find((i: { player: { id: string } }) => i.player.id === a.id);

    const moved = await req('PATCH', `/api/v1/admin/medals/${mine.id}`, { token: adm.token, body: { season_id: null, title: 'Campeón' } });
    expect(moved.body).toMatchObject({ title: 'Campeón', season: null });

    const gone = await req('POST', '/api/v1/admin/medals/delete', { token: adm.token, body: { ids: list.body.items.map((i: { id: string }) => i.id) } });
    expect(gone.body).toEqual({ deleted: 2 });
  });

  it('las automáticas se dan solas y no se editan', async () => {
    const p = await newPlayer();
    const m = (await admin()
      .from('matches')
      .insert({ kind: 'mix', status: 'finished', best_of: 1, side1_name: 'A', side2_name: 'B', map: 'de_dust2', winner_side: 1, played_at: new Date().toISOString() })
      .select('id')
      .single()).data!.id;
    await admin().from('match_player_stats').insert({ match_id: m, steam_id: p.steam_id, player_id: p.id, team: 1, nick: 'x', kills: 10, deaths: 5, rounds: 16 });

    const r = await req('POST', '/api/v1/admin/medal-rules/recalculate', { token: adm.token });
    expect(r.status).toBe(200);
    expect(r.body.given).toBeGreaterThanOrEqual(2);

    const medals = await req('GET', `/api/v1/players/${p.id}/medals?per=50`);
    const keys = medals.body.items.map((i: { medal_key: string }) => i.medal_key);
    expect(keys).toEqual(expect.arrayContaining(['primer_mix', 'primera_victoria']));
    expect(medals.body.items.every((i: { source: string }) => i.source === 'auto')).toBe(true);
    // Una segunda corrida no las repite.
    await req('POST', '/api/v1/admin/medal-rules/recalculate', { token: adm.token });
    expect((await req('GET', `/api/v1/players/${p.id}/medals?per=50`)).body.total).toBe(medals.body.total);

    const fix = await req('PATCH', `/api/v1/admin/medals/${medals.body.items[0].id}`, { token: adm.token, body: { title: 'x' } });
    expect(fix).toMatchObject({ status: 400, body: { error: { code: 'BUSINESS_RULE' } } });
  });

  it('reglas: listar y cambiar', async () => {
    const rules = await req('GET', '/api/v1/admin/medal-rules', { token: adm.token });
    expect(rules.body.items.find((r: { medal_key: string }) => r.medal_key === 'kda_1_5')).toMatchObject({ metric: 'kda', threshold: 1.5, min_matches: 20 });
    const off = await req('PATCH', '/api/v1/admin/medal-rules/kda_1_5', { token: adm.token, body: { min_matches: 25 } });
    expect(off.body).toMatchObject({ medal_key: 'kda_1_5', min_matches: 25 });
    await req('PATCH', '/api/v1/admin/medal-rules/kda_1_5', { token: adm.token, body: { min_matches: 20 } });
    expect((await req('PATCH', '/api/v1/admin/medal-rules/no_existe', { token: adm.token, body: { active: false } })).status).toBe(404);
  });
});
