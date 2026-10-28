import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Plantilla groups_double y sorteo contra la Supabase local (replanteo 17).
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
      headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    },
    env,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** Equipo oficial con capitán y 5 jugadores con SteamID. */
async function team() {
  const cap = await createUser({ tag: `Cap${rnd()}` });
  const sb = admin();
  const t = (await sb.from('teams').insert({ name: `GD ${rnd()}`, tag: 'GD', kind: 'official', captain_id: cap.id, owner_id: cap.id }).select('id, name').single()).data!;
  const capPlayer = (await sb.from('players').insert({ nick: `C${rnd()}`, user_id: cap.id, steam_id: steam() }).select('id').single()).data!.id as string;
  const others = (await sb.from('players').insert(Array.from({ length: 4 }, (_, i) => ({ nick: `G${i}${rnd()}`, steam_id: steam() }))).select('id')).data!.map((p) => p.id as string);
  const players = [capPlayer, ...others];
  const r = await sb.from('team_members').insert(players.map((p) => ({ team_id: t.id, player_id: p, joined_at: new Date().toISOString() })));
  if (r.error) throw r.error;
  return { id: t.id as string, name: t.name as string, cap, players };
}

type M = { id: string; label: string; status: string; best_of: number; side1: { team: { id: string } | null }; side2: { team: { id: string } | null } };

let adm: U;
let org: U;
beforeAll(async () => {
  adm = await createUser({ role: 'admin' });
  org = await createUser({ tag: `Org${rnd()}` });
  expect((await req('PUT', `/api/v1/admin/users/${org.id}/role`, { token: adm.token, body: { role: 'organizer' } })).status).toBe(204);
});

describe('grupos de doble eliminación + playoffs', () => {
  it('valores por defecto, sorteo, grupos, tabla, playoffs y campeón', async () => {
    // Por defecto: el formato del plan (2 grupos, clasifican 3, grupos BO3, playoffs BO3 y final BO5).
    const def = await req('POST', '/api/v1/events', { token: org.token, body: { name: `GD def ${rnd()}`, template: 'groups_double' } });
    expect(def.status).toBe(201);
    const dd = await req('GET', `/api/v1/events/${def.body.id}`);
    expect(dd.body.config).toMatchObject({ groups: 2, advance: 3, bo_group: 3, playoffs: { bo: 3, bo_semi: 3, bo_final: 5, third_place: false } });
    expect(dd.body.draw).toBeNull();
    expect((await req('POST', '/api/v1/events', { token: org.token, body: { name: 'X', template: 'groups_double', config: { advance: 1 } } })).status).toBe(400);

    // 8 equipos en 2 grupos de 4, clasifican 2 por grupo, con 3.er puesto.
    const created = await req('POST', '/api/v1/events', {
      token: org.token,
      body: { name: `GD ${rnd()}`, template: 'groups_double', config: { advance: 2, playoffs: { third_place: true } } },
    });
    expect(created.status).toBe(201);
    const ev = created.body.id as string;
    const teams = await Promise.all(Array.from({ length: 8 }, () => team()));
    for (const t of teams) expect((await req('PUT', `/api/v1/events/${ev}/registrations/${t.id}`, { token: t.cap.token, body: { active: t.players } })).status).toBe(204);

    // Sorteo: solo el organizador; trae los 8 y queda registrado.
    expect((await req('POST', `/api/v1/events/${ev}/draw`, { token: teams[0]!.cap.token })).status).toBe(403);
    const drawn = await req('POST', `/api/v1/events/${ev}/draw`, { token: org.token });
    expect(drawn.status).toBe(200);
    expect(drawn.body.seeds.map((t: { id: string }) => t.id).sort()).toEqual(teams.map((t) => t.id).sort());
    const regs = await req('GET', `/api/v1/events/${ev}/registrations?per=20`);
    expect(regs.body.items.map((r: { team: { id: string } }) => r.team.id)).toEqual(drawn.body.seeds.map((t: { id: string }) => t.id));
    let d = await req('GET', `/api/v1/events/${ev}`);
    expect(d.body.draw).toMatchObject({ at: drawn.body.drawn_at, by: { user_id: org.id } });
    // Cambiar la siembra a mano borra el registro del sorteo; se vuelve a sortear.
    expect((await req('PUT', `/api/v1/events/${ev}/seeds`, { token: org.token, body: { teams: teams.map((t) => t.id) } })).status).toBe(204);
    expect((await req('GET', `/api/v1/events/${ev}`)).body.draw).toBeNull();
    expect((await req('POST', `/api/v1/events/${ev}/draw`, { token: org.token })).status).toBe(200);

    expect((await req('POST', `/api/v1/events/${ev}/generate`, { token: org.token })).status).toBe(204);
    const r = await req('POST', `/api/v1/events/${ev}/draw`, { token: org.token });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/antes de generar/);

    // Nombres de las fases.
    let ms = await req('GET', `/api/v1/events/${ev}/matches?per=100`);
    const labels = new Set(ms.body.items.map((m: M) => m.label));
    for (const l of ['Grupo A · upper · ronda 1', 'Grupo A · final del upper', 'Grupo B · lower · ronda 1', 'Grupo B · final del lower']) expect(labels).toContain(l);

    // Se juega todo con resultados del organizador: gana siempre el bando 1.
    for (let guard = 0; guard < 40; guard++) {
      ms = await req('GET', `/api/v1/events/${ev}/matches?per=100&status=upcoming`);
      const next = (ms.body.items as M[]).find((m) => m.side1.team && m.side2.team);
      if (!next) break;
      const maps = Array.from({ length: Math.floor(next.best_of / 2) + 1 }, () => ({ map: 'de_dust2', r1: 16, r2: 10 }));
      expect((await req('POST', `/api/v1/matches/${next.id}/result`, { token: org.token, body: { maps } })).status).toBe(204);
    }

    const st = await req('GET', `/api/v1/events/${ev}/standings?stage=group_double&per=20`);
    expect(st.body.total).toBe(8);
    const rows = st.body.items as { grp: number; place: number; state: string; won: number; lost: number }[];
    for (const g of [1, 2]) {
      const grp = rows.filter((x) => x.grp === g).sort((a, b) => a.place - b.place);
      expect(grp.map((x) => x.state)).toEqual(['qualified', 'qualified', 'eliminated', 'eliminated']);
      expect(grp[0]).toMatchObject({ place: 1, won: 2, lost: 0 });
    }

    ms = await req('GET', `/api/v1/events/${ev}/matches?per=100`);
    const items = ms.body.items as M[];
    expect(items.filter((m) => m.label === 'Semifinal')).toHaveLength(2);
    expect(items.find((m) => m.label === 'Final')).toMatchObject({ best_of: 5, status: 'finished' });
    expect(items.find((m) => m.label === 'Tercer puesto')).toMatchObject({ status: 'finished' });
    d = await req('GET', `/api/v1/events/${ev}`);
    expect(d.body.status).toBe('finished');
    expect(d.body.champion).not.toBeNull();
  });
});
