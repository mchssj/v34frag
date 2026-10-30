import type { z } from '@hono/zod-openapi';
import { levelOf } from '../lib/db';
import { fromPostgrest } from '../lib/errors';
import type { Db } from '../lib/supabase';
import type { LiveGameRef, LiveMixSummary, TvRef } from '../schemas/live';

// Columnas de la vista live_match_list (replanteo 16) que arman un LiveMixSummary.
export const LIVE_LIST =
  'uid, server_id, server_name, seq, map, score1, score2, rounds_played, max_rounds, started_at, updated_at, stale, ' +
  'side1_name, side2_name, parent_match_id, parent_side1';

export type LiveRow = {
  uid: string; server_id: string; server_name: string | null; seq: number; map: string | null; score1: number | null; score2: number | null;
  rounds_played: number | null; max_rounds: number | null; started_at: string | null; updated_at: string; stale: boolean | null;
  side1_name: string | null; side2_name: string | null; parent_match_id: string | null; parent_side1: number | null;
};

type Tv = z.infer<typeof TvRef>;

/** SourceTV para "Ver en TV": host de la dirección del servidor y su tv_port. null si falta alguno. */
export function toTv(host: string | null | undefined, port: number | null | undefined): Tv | null {
  return host && port ? { host, port } : null;
}

/** SourceTV de cada servidor (los activos con licencia vigente, como game_servers_public). */
export async function serverTvs(sb: Db, ids: string[]): Promise<Map<string, Tv>> {
  const out = new Map<string, Tv>();
  if (!ids.length) return out;
  const { data, error } = await sb.from('game_servers_public').select('id, connect_address, tv_port').in('id', [...new Set(ids)]);
  if (error) throw error;
  for (const s of data ?? []) {
    const tv = toTv((s.connect_address ?? '').split(':')[0], s.tv_port);
    if (s.id && tv) out.set(s.id, tv);
  }
  return out;
}

export const toLiveSummary = (l: LiveRow, tv: Tv | null = null): z.infer<typeof LiveMixSummary> => ({
  uid: l.uid,
  server: { id: l.server_id, name: l.server_name },
  map: l.map,
  side1: { name: l.side1_name, score: l.score1 },
  side2: { name: l.side2_name, score: l.score2 },
  rounds_played: l.rounds_played ?? 0,
  max_rounds: l.max_rounds,
  started_at: l.started_at,
  updated_at: l.updated_at,
  stale: !!l.stale,
  parent_match_id: l.parent_match_id,
  tv,
});

/** Juego en curso visto desde su partida de torneo o PCW: parent_side1 = 2 da vuelta el marcador. */
export const toLiveGame = (l: LiveRow): z.infer<typeof LiveGameRef> => {
  const flip = l.parent_side1 === 2;
  return {
    uid: l.uid,
    map: l.map,
    score1: flip ? l.score2 : l.score1,
    score2: flip ? l.score1 : l.score2,
    rounds_played: l.rounds_played ?? 0,
    max_rounds: l.max_rounds,
    updated_at: l.updated_at,
    stale: !!l.stale,
  };
};

type PayloadRound = { n?: unknown; winner?: unknown; a_side?: unknown; reason?: unknown };

/** Rondas de la foto ({n, winner: 'a'|'b', a_side: 'CT'|'T', reason}) en el orden de los bandos del mix (a = 1). */
export function liveRounds(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return (raw as PayloadRound[]).map((r, i) => ({
    n: typeof r.n === 'number' ? r.n : i + 1,
    winner_side: r.winner === 'a' ? 1 : r.winner === 'b' ? 2 : null,
    side1_as: r.a_side === 'CT' || r.a_side === 'T' ? (r.a_side as 'CT' | 'T') : null,
    reason: typeof r.reason === 'number' ? r.reason : null,
  }));
}

/**
 * ELO actual de cada SteamID (`player_elo`), en una sola consulta. Para una línea con ficha va el SteamID
 * principal de la ficha; sin ficha, el de la línea. Bots y NOSTEAM no tienen fila: quedan sin ELO.
 */
export async function eloBySteam(sb: Db, steamIds: (string | null | undefined)[]): Promise<Map<string, number>> {
  const ids = [...new Set(steamIds.filter((x): x is string => !!x))];
  if (!ids.length) return new Map();
  const { data, error } = await sb.from('player_elo').select('steam_id, elo').in('steam_id', ids);
  if (error) throw fromPostgrest(error);
  return new Map((data ?? []).map((r) => [r.steam_id, r.elo]));
}

/** `elo` y `level` de una línea de jugador a partir de `eloBySteam`. */
export function eloLevel(elos: Map<string, number>, steamId: string | null | undefined): { elo: number | null; level: number | null } {
  const elo = steamId ? (elos.get(steamId) ?? null) : null;
  return { elo, level: levelOf(elo) };
}
