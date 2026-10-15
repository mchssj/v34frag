import type { User as SbUser } from '@supabase/supabase-js';
import type { Config } from '../env';
import { fromPostgrest } from '../lib/errors';
import { userClient } from '../lib/supabase';
import type { AuthUserT } from '../schemas/auth';

// Rol y tag de la cuenta (la RLS de profiles deja leer solo la propia).
export async function profileOf(cfg: Config, token: string, id: string) {
  const { data, error } = await userClient(cfg, token).from('profiles').select('role, tag').eq('id', id).maybeSingle();
  if (error) throw fromPostgrest(error);
  return data;
}

export async function toAuthUser(
  cfg: Config,
  token: string,
  user: Pick<SbUser, 'id' | 'email'> & { created_at?: string | null | undefined },
): Promise<AuthUserT> {
  const p = await profileOf(cfg, token, user.id);
  return {
    id: user.id,
    email: user.email ?? null,
    tag: p?.tag ?? null,
    role: p?.role === 'admin' ? 'admin' : 'user',
    created_at: user.created_at ?? null,
  };
}
