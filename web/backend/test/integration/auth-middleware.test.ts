import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { requireAdmin, requireUser } from '../../src/lib/auth';
import { createUser, local, localEnv } from './local';

function app() {
  const a = createApp();
  a.get('/yo', requireUser, async (c) => {
    // El cliente del contexto actúa como el usuario: la RLS de profiles solo deja ver el propio.
    const { data } = await c.var.sb.from('profiles').select('id, tag');
    return c.json({ id: c.var.user.id, visibles: data });
  });
  a.get('/admin', requireUser, requireAdmin, (c) => c.json({ ok: true }));
  return a;
}
const get = (path: string, token?: string) =>
  app().request(path, token ? { headers: { Authorization: `Bearer ${token}` } } : {}, localEnv());

describe('requireUser / requireAdmin contra la Supabase local', () => {
  it('un usuario real pasa requireUser y su cliente aplica la RLS', async () => {
    const u = await createUser({ tag: 'Integra1' });
    await createUser(); // otro usuario, que no debe ser visible
    const res = await get('/yo', u.token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(u.id);
    expect(body.visibles).toEqual([{ id: u.id, tag: 'Integra1' }]);
  });

  it('la clave pública (anon) no sirve como sesión', async () => {
    expect((await get('/yo', local().ANON_KEY)).status).toBe(401);
  });

  it('un admin pasa requireAdmin y un usuario común recibe 403', async () => {
    const adm = await createUser({ role: 'admin' });
    const usr = await createUser();
    expect((await get('/admin', adm.token)).status).toBe(200);
    expect((await get('/admin', usr.token)).status).toBe(403);
  });
});
