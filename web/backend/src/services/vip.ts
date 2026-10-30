import { must, mustHave } from '../lib/db';
import type { Db } from '../lib/supabase';

// VIP (plan docs/bitacora/2026-10-28-vip-fase-0): filas de vip_status a la respuesta de la API y el `vip` público.

export const VIP_FIELDS = 'user_id, alias, player_id, photo_url, status, active, lifetime, until, since, last_change';

export type VipRow = {
  user_id: string | null; alias: string | null; player_id: string | null; photo_url: string | null; status: string | null;
  active: boolean | null; lifetime: boolean | null; until: string | null; since: string | null; last_change: string | null;
};

export const toVipStatus = (r: VipRow) => ({ active: !!r.active, lifetime: !!r.lifetime, until: r.until, since: r.since! });

export const toAdminVip = (r: VipRow) => ({
  user: { id: r.user_id!, alias: r.alias ?? '' },
  player: r.player_id ? { id: r.player_id, photo_url: r.photo_url } : null,
  status: r.status as 'lifetime' | 'active' | 'revoked' | 'expired',
  ...toVipStatus(r),
  last_change: r.last_change!,
});

/** Estado VIP de cada cuenta (vip_status: el dueño ve la suya; los admins, todas). Sin fila: nunca fue VIP. */
export async function vipStatusOf(sb: Db, users: string[]) {
  if (!users.length) return new Map<string, ReturnType<typeof toVipStatus>>();
  const rows = mustHave(await sb.from('vip_status').select(VIP_FIELDS).in('user_id', users)) as VipRow[];
  return new Map(rows.map((r) => [r.user_id!, toVipStatus(r)]));
}

/** Las fichas VIP hoy (vip_public: pública, sin fechas). */
export async function vipPlayers(sb: Db, players: string[]) {
  const ids = [...new Set(players.filter(Boolean))];
  if (!ids.length) return new Set<string>();
  const rows = mustHave(await sb.from('vip_public').select('player_id').in('player_id', ids));
  return new Set(rows.map((r) => r.player_id!));
}

/** Si la cuenta existe (para el 404 antes de llamar a las funciones). */
export async function userExists(sb: Db, id: string) {
  return !!must(await sb.from('admin_user_list').select('id').eq('id', id).limit(1).maybeSingle());
}
