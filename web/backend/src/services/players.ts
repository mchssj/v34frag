import { must, notFound } from '../lib/db';
import type { Db } from '../lib/supabase';

// Las rutas públicas de un jugador aceptan su id o su nick (plan docs/bitacora/2026-10-24-api-mixes-perfil-ranking).
// El nick es único sin distinguir mayúsculas ni espacios de los costados (índice players_nick_unico del replanteo 27).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El nick tal cual para un `ilike` exacto: sin comodines de LIKE. */
export const likeExact = (v: string) => v.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`);

/**
 * La insignia de verificado de cada ficha (replanteo 90): id → 'gray' | 'gold'. Las que no tienen no aparecen.
 * Para las listas (replanteo 94): la vista de los jugadores no la trae.
 */
export async function verifiedPlayers(sb: Db, players: string[]) {
  const ids = [...new Set(players.filter(Boolean))];
  const map = new Map<string, 'gray' | 'gold'>();
  if (!ids.length) return map;
  const rows = must(await sb.from('players').select('id, verified').in('id', ids).not('verified', 'is', null)) ?? [];
  for (const r of rows) if (r.verified === 'gray' || r.verified === 'gold') map.set(r.id, r.verified);
  return map;
}

/** Las fichas con insignia (para el filtro "Verificados" de la lista de jugadores). */
export async function verifiedIds(sb: Db) {
  const rows = must(await sb.from('players').select('id').not('verified', 'is', null)) ?? [];
  return rows.map((r) => r.id);
}

/** Id de la ficha a partir de su id o su nick. 404 si no existe. */
export async function resolvePlayer(sb: Db, ref: string): Promise<string> {
  const v = ref.trim();
  const q = sb.from('players').select('id');
  const row = must(await (UUID.test(v) ? q.eq('id', v.toLowerCase()) : q.ilike('nick', likeExact(v))).maybeSingle());
  if (!row) throw notFound('ese jugador');
  return row.id;
}
