import { must } from '../lib/db';
import type { Db } from '../lib/supabase';

// Baneos (plan docs/bitacora/2026-10-25-baneos-web): filas de ban_list a la respuesta de la API.

export const BAN_FIELDS =
  'id, player_id, nick, steam_id, reason, created_at, expires_at, permanent, status, source, server_id, server_name, ' +
  'created_by, created_by_alias, created_by_name, lifted_at, lift_reason, lifted_by, lifted_by_alias, lifted_by_name, replaced_by';

export type BanRow = {
  id: string | null; player_id: string | null; nick: string | null; steam_id: string | null; reason: string | null;
  created_at: string | null; expires_at: string | null; permanent: boolean | null; status: string | null; source: string | null;
  server_id: string | null; server_name: string | null; created_by: string | null; created_by_alias: string | null;
  created_by_name: string | null; lifted_at: string | null; lift_reason: string | null; lifted_by: string | null;
  lifted_by_alias: string | null; lifted_by_name: string | null; replaced_by: string | null;
};

/** `seesSteam`: moderadores y admins ven el SteamID también de los baneos con ficha. */
export const toBan = (r: BanRow, seesSteam: boolean) => ({
  id: r.id!,
  player: r.player_id ? { id: r.player_id, alias: r.nick ?? '' } : null,
  nick: r.nick,
  steam_id: !r.player_id || seesSteam ? r.steam_id : null,
  reason: r.reason ?? '',
  created_at: r.created_at!,
  expires_at: r.expires_at,
  permanent: !!r.permanent,
  status: r.status as 'active' | 'expired' | 'lifted',
  source: r.source as 'web' | 'server' | 'import',
  server: r.server_id ? { id: r.server_id, name: r.server_name ?? '' } : null,
  created_by: r.created_by || r.created_by_name ? { id: r.created_by, alias: r.created_by_alias ?? r.created_by_name } : null,
  lifted: r.lifted_at
    ? {
        at: r.lifted_at,
        reason: r.lift_reason,
        by: r.lifted_by || r.lifted_by_name ? { id: r.lifted_by, alias: r.lifted_by_alias ?? r.lifted_by_name } : null,
        replaced_by: r.replaced_by,
      }
    : null,
});

/** Baneo activo de una ficha (`player`) o de un SteamID sin ficha (`steam`): el permanente o el que vence último. */
export async function activeBan(sb: Db, by: { player: string } | { steam: string }) {
  let q = sb.from('ban_list').select('id, reason, created_at, expires_at').eq('status', 'active');
  q = 'player' in by ? q.eq('player_id', by.player) : q.eq('steam_id', by.steam).is('player_id', null);
  const row = must(
    await q.order('permanent', { ascending: false }).order('expires_at', { ascending: false, nullsFirst: true }).limit(1).maybeSingle(),
  );
  return row ? { id: row.id!, reason: row.reason ?? '', created_at: row.created_at!, expires_at: row.expires_at } : null;
}
