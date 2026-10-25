import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';
// Sufijo para que los alias (únicos desde el replanteo 09) no choquen entre corridas.
const sfx = Date.now().toString(36).slice(-5);

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
    const u = await createUser({ tag: `Perfil${sfx}` });
    const res = await getProfile(u.token);
    expect(res.status).toBe(200);
    const p = await res.json();
    expect(p.user).toMatchObject({ id: u.id, email: u.email, tag: `Perfil${sfx}`, role: 'user' });
    expect(Date.parse(p.user.created_at)).toBeGreaterThan(0);
    expect(p.details.joined_at).toBe(p.user.created_at);
    expect(p).toMatchObject({ player: null, teams: [], matches_played: 0 });
  });

  it('con jugador vinculado: equipos oficiales (no los de PCW) y partidas jugadas terminadas', async () => {
    const u = await createUser();
    const steam = `7656119${Date.now().toString().slice(-10)}`;
    const pl = await insert('players', { nick: `Jug${uid()}`, user_id: u.id, steam_id: steam });
    // Juega en un equipo PCW (se ignora) y en dos oficiales; desde el replanteo 05 el plantel va en team_members.
    const pcw = await insert('teams', { name: `PCW ${uid()}`, kind: 'pcw' });
    const team = await insert<{ id: string; name: string }>('teams', { name: `A Oficial ${uid()}`, tag: 'OFI', kind: 'official' });
    const team2 = await insert<{ id: string; name: string }>('teams', { name: `B Oficial ${uid()}`, tag: 'DOS', kind: 'official' });
    await insert('team_members', { team_id: pcw.id, player_id: pl.id });
    await insert('team_members', { team_id: team.id, player_id: pl.id });
    await insert('team_members', { team_id: team2.id, player_id: pl.id });
    // Partidas jugadas: cuenta la terminada, no la cancelada.
    const mix = (status: string) => insert<{ id: string }>('matches', { kind: 'mix', status, side1_name: 'A', side2_name: 'B' });
    for (const m of [await mix('finished'), await mix('cancelled')]) {
      await insert('match_player_stats', { match_id: m.id, steam_id: steam, player_id: pl.id, team: 1, nick: 'x', rounds: 10 });
    }
    const p = await (await getProfile(u.token)).json();
    expect(p.player).toMatchObject({ id: pl.id, nick: expect.any(String) });
    expect(p.teams).toEqual([
      { id: team.id, name: team.name, tag: 'OFI', is_captain: false, is_member: true },
      { id: team2.id, name: team2.name, tag: 'DOS', is_captain: false, is_member: true },
    ]);
    expect(p.matches_played).toBe(1);
  });

  it('sin jugador: muestra el equipo del que es capitán', async () => {
    const u = await createUser();
    const team = await insert<{ id: string }>('teams', { name: `Capi ${uid()}`, kind: 'official', captain_id: u.id });
    expect((await (await getProfile(u.token)).json()).teams).toEqual([expect.objectContaining({ id: team.id, is_captain: true, is_member: false })]);
  });
});

describe('PATCH /api/v1/me/profile', () => {
  it('actualiza y normaliza los campos, y cambia el tag', async () => {
    const u = await createUser({ tag: `Viejo${sfx}` });
    const res = await patch(u.token, {
      tag: `  Nuevo${sfx}  `,
      real_name: '  José Pérez ',
      country: 'Colombia',
      game_role: 'AWPer',
      steam: 'http://steamcommunity.com/id/mecha',
      faceit: 'https://www.faceit.com/es/players/mecha',
      discord: 'mecha_css',
    });
    expect(res.status).toBe(200);
    const p = await res.json();
    expect(p.user.tag).toBe(`Nuevo${sfx}`);
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

  it('preferencias: theme_fx se guarda, se cambia, se borra y es de cada cuenta', async () => {
    const u = await createUser();
    const otro = await createUser();
    expect((await (await getProfile(u.token)).json()).preferences).toEqual({ theme_fx: null, notifications: expect.objectContaining({ team: true, news: false }) });
    let res = await patch(u.token, { preferences: { theme_fx: 'silent' } });
    expect(res.status).toBe(200);
    expect((await res.json()).preferences).toMatchObject({ theme_fx: 'silent' });
    // Otro campo del perfil no toca las preferencias.
    expect((await (await patch(u.token, { discord: 'pref' })).json()).preferences).toMatchObject({ theme_fx: 'silent' });
    expect((await (await patch(u.token, { preferences: { theme_fx: 'off' } })).json()).preferences).toMatchObject({ theme_fx: 'off' });
    expect((await (await getProfile(otro.token)).json()).preferences).toMatchObject({ theme_fx: null });
    res = await patch(u.token, { preferences: { theme_fx: 'fuerte' } });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    expect((await (await patch(u.token, { preferences: { theme_fx: null } })).json()).preferences).toMatchObject({ theme_fx: null });
    // Borrar la última preferencia deja la fila con el objeto vacío.
    const { data } = await admin().from('user_preferences').select('preferences').eq('user_id', u.id).single();
    expect(data?.preferences).toEqual({});
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
