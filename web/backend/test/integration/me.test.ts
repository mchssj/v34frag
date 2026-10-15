import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

const app = createApp();
const env = localEnv();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const getProfile = (token: string) => app.request('/api/v1/me/profile', { headers: auth(token) }, env);
const patch = (token: string, body: unknown) =>
  app.request('/api/v1/me/profile', { method: 'PATCH', headers: { ...auth(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, env);
const upload = (token: string, file?: File) => {
  const fd = new FormData();
  if (file) fd.append('file', file);
  return app.request('/api/v1/me/avatar', { method: 'POST', headers: auth(token), body: fd }, env);
};
const requestClaim = (token: string, player_id: string) =>
  app.request('/api/v1/me/profile-requests', { method: 'POST', headers: { ...auth(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ player_id }) }, env);

const uid = () => Math.random().toString(36).slice(2, 8);
async function insert<T = { id: string }>(table: string, row: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin().from(table).insert(row).select().single();
  if (error) throw error;
  return data as T;
}
const PNG = (size = 64) => {
  const b = new Uint8Array(size);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return b;
};

describe('GET /api/v1/me/profile', () => {
  it('usuario nuevo: tag, fecha de alta y sin jugador ni equipo', async () => {
    const u = await createUser({ tag: 'Perfil1' });
    const res = await getProfile(u.token);
    expect(res.status).toBe(200);
    const p = await res.json();
    expect(p.user).toMatchObject({ id: u.id, email: u.email, tag: 'Perfil1', role: 'user' });
    expect(Date.parse(p.user.created_at)).toBeGreaterThan(0);
    expect(p.details.joined_at).toBe(p.user.created_at);
    expect(p).toMatchObject({ player: null, team: null, matches_played: 0 });
  });

  it('con jugador vinculado: equipo oficial (no el de PCW) y solo partidas válidas', async () => {
    const u = await createUser();
    const pl = await insert('players', { nick: `Jug${uid()}`, user_id: u.id, steam_id: `7656119${Date.now().toString().slice(-10)}` });
    await insert('teams', { name: `PCW ${uid()}`, kind: 'pcw', members: [pl.id] }); // desde el replanteo 04 no existen equipos mix
    const team = await insert<{ id: string; name: string }>('teams', { name: `Oficial ${uid()}`, tag: 'OFI', kind: 'official', members: [pl.id] });
    const rival = await insert('teams', { name: `Rival ${uid()}`, kind: 'official' });
    const ev = await insert('events', { name: `Torneo ${uid()}` });
    const m = (extra: Record<string, unknown>) => insert('matches', { team1: team.id, team2: rival.id, status: 'finished', ...extra });
    await m({});
    await m({ team1: rival.id, team2: team.id, stage: 'Final', event_id: ev.id });
    await m({ bye: true });
    await m({ status: 'upcoming' });
    await m({ stage: 'Semifinal' }); // huérfana: etapa sin torneo
    const res = await getProfile(u.token);
    const p = await res.json();
    expect(p.player).toMatchObject({ id: pl.id, nick: expect.stringMatching(/^Jug/) });
    expect(p.team).toEqual({ id: team.id, name: team.name, tag: 'OFI' });
    expect(p.matches_played).toBe(2);
  });

  it('sin jugador: usa el equipo del que es capitán', async () => {
    const u = await createUser();
    const team = await insert<{ id: string }>('teams', { name: `Capi ${uid()}`, kind: 'official', captain_id: u.id });
    expect((await (await getProfile(u.token)).json()).team.id).toBe(team.id);
  });
});

describe('PATCH /api/v1/me/profile', () => {
  it('actualiza y normaliza los campos, y cambia el tag', async () => {
    const u = await createUser({ tag: 'Viejo' });
    const res = await patch(u.token, {
      tag: '  Nuevo  ',
      real_name: '  José Pérez ',
      country: 'Colombia',
      game_role: 'AWPer',
      steam: 'http://steamcommunity.com/id/mecha',
      faceit: 'https://www.faceit.com/es/players/mecha',
      discord: 'mecha_css',
    });
    expect(res.status).toBe(200);
    const p = await res.json();
    expect(p.user.tag).toBe('Nuevo');
    expect(p.details).toMatchObject({
      real_name: 'José Pérez',
      country: 'Colombia',
      game_role: 'AWPer',
      steam: 'https://steamcommunity.com/id/mecha',
      faceit: 'https://www.faceit.com/es/players/mecha',
      discord: 'mecha_css',
    });
  });

  it('solo cambia lo enviado y borra con null o ""', async () => {
    const u = await createUser();
    await patch(u.token, { country: 'Chile', discord: 'abc', steam: '76561198000000001' });
    const p = await (await patch(u.token, { country: null, discord: '' })).json();
    expect(p.details).toMatchObject({ country: null, discord: null, steam: '76561198000000001' });
  });

  it('400 con detalle por campo', async () => {
    const u = await createUser();
    const res = await patch(u.token, { tag: 'x', country: 'Narnia', steam: 'no válido!', real_name: 'R2D2' });
    expect(res.status).toBe(400);
    const paths = (await res.json()).error.details.map((d: { path: string }) => d.path).sort();
    expect(paths).toEqual(['country', 'real_name', 'steam', 'tag']);
  });

  it('400 si no hay nada para actualizar', async () => {
    const u = await createUser();
    expect((await patch(u.token, {})).status).toBe(400);
  });

  it('un user_id en el cuerpo se ignora: no toca el perfil de otro', async () => {
    const victima = await createUser();
    const atacante = await createUser();
    await patch(victima.token, { discord: 'victima' });
    await patch(atacante.token, { user_id: victima.id, discord: 'hackeado' } as Record<string, unknown>);
    const v = await (await getProfile(victima.token)).json();
    expect(v.details.discord).toBe('victima');
  });
});

describe('POST /api/v1/me/avatar', () => {
  it('sube la imagen a la carpeta del usuario, la guarda en el perfil y borra la anterior', async () => {
    const u = await createUser();
    const r1 = await upload(u.token, new File([PNG()], 'a.png', { type: 'image/png' }));
    expect(r1.status).toBe(200);
    const { avatar_url: url1 } = await r1.json();
    expect(url1).toContain(`/storage/v1/object/public/avatars/${u.id}/`);
    expect(url1).toMatch(/\.png$/);
    expect((await fetch(url1)).status).toBe(200);

    // El tipo se detecta por los bytes: un JPEG con nombre .png se guarda como .jpg.
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    const r2 = await upload(u.token, new File([jpeg], 'b.png', { type: 'image/png' }));
    const { avatar_url: url2 } = await r2.json();
    expect(url2).toMatch(/\.jpg$/);
    expect((await (await getProfile(u.token)).json()).details.avatar_url).toBe(url2);

    await expect
      .poll(async () => (await admin().storage.from('avatars').list(u.id)).data?.length, { timeout: 3000 })
      .toBe(1);
  });

  it('400 INVALID_FILE si no es una imagen permitida (aunque diga image/png)', async () => {
    const u = await createUser();
    const res = await upload(u.token, new File([new TextEncoder().encode('MZ no soy una imagen')], 'x.png', { type: 'image/png' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_FILE');
    const gif = new TextEncoder().encode('GIF89a......');
    expect((await upload(u.token, new File([gif], 'x.gif', { type: 'image/gif' }))).status).toBe(400);
  });

  it('413 si pesa más de 1 MB', async () => {
    const u = await createUser();
    const res = await upload(u.token, new File([PNG(1024 * 1024 + 1)], 'grande.png', { type: 'image/png' }));
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe('FILE_TOO_LARGE');
  });

  it('400 si falta el archivo', async () => {
    const u = await createUser();
    expect((await upload(u.token)).status).toBe(400);
  });
});

describe('solicitudes de reclamo de perfil', () => {
  it('crea una solicitud pendiente, la lista y rechaza el duplicado', async () => {
    const u = await createUser();
    const pl = await insert<{ id: string; nick: string }>('players', { nick: `Libre${uid()}` });
    const res = await requestClaim(u.token, pl.id);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ player_id: pl.id, status: 'pending', player: { id: pl.id, nick: pl.nick } });
    expect((await requestClaim(u.token, pl.id)).status).toBe(409);

    const otro = await createUser();
    await requestClaim(otro.token, pl.id);
    const list = await (await app.request('/api/v1/me/profile-requests', { headers: auth(u.token) }, env)).json();
    expect(list).toHaveLength(1);
    expect(list[0].player_id).toBe(pl.id);
  });

  it('409 si el jugador ya tiene cuenta, 404 si no existe, 400 si el id no es uuid', async () => {
    const u = await createUser();
    const dueno = await createUser();
    const pl = await insert('players', { nick: `Tomado${uid()}`, user_id: dueno.id });
    expect((await requestClaim(u.token, pl.id)).status).toBe(409);
    expect((await requestClaim(u.token, '00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await requestClaim(u.token, 'no-es-uuid')).status).toBe(400);
  });
});
