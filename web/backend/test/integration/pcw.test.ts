import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Formatos de PCW contra la Supabase local (con el replanteo 08 aplicado).
const app = createApp();
const env = localEnv();
const getFormats = () => app.request('/api/v1/pcw/formats', {}, env);
const put = (token: string, formats: unknown) =>
  app.request(
    '/api/v1/admin/pcw/formats',
    { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ formats }) },
    env,
  );

// Deja la configuración como la deja la migración.
afterAll(async () => {
  const { error } = await admin().from('pcw_config').update({ best_of: [1, 3, 5] }).eq('id', 1);
  if (error) throw error;
});

describe('formatos de PCW', () => {
  it('un anónimo los lee', async () => {
    const res = await getFormats();
    expect(res.status).toBe(200);
    expect((await res.json()).formats).toEqual(expect.arrayContaining([1]));
  });

  it('un usuario común no los puede cambiar', async () => {
    const u = await createUser();
    const res = await put(u.token, [1]);
    expect(res.status).toBe(403);
  });

  it('un admin los cambia y la base hace cumplir la regla al publicar', async () => {
    const a = await createUser({ role: 'admin' });
    const res = await put(a.token, [3, 1, 3]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ formats: [1, 3] });
    expect((await (await getFormats()).json()).formats).toEqual([1, 3]);

    // Publicar un BO5 ahora falla con el mensaje de la base (la validación del formato va antes que la del roster).
    const u = await createUser();
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${u.token}` } },
    });
    const r = await sb.rpc('create_pcw_post', {
      p_name: 'BO5', p_best_of: 5, p_maps: '', p_starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      p_note: '', p_players: [], p_guests: [],
    });
    expect(r.error?.message).toBe('El formato BO5 no está habilitado para las PCW');
  });
});
