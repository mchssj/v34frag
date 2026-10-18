import type { z } from '@hono/zod-openapi';
import type { LiveGameRef, LiveMixSummary } from '../schemas/live';

// Columnas de la vista live_match_list (replanteo 16) que arman un LiveMixSummary.
export const LIVE_LIST =
  'uid, server_id, server_name, seq, map, score1, score2, rounds_played, max_rounds, started_at, updated_at, stale, ' +
  'side1_name, side2_name, parent_match_id, parent_side1';

export type LiveRow = {
  uid: string; server_id: string; server_name: string | null; seq: number; map: string | null; score1: number | null; score2: number | null;
  rounds_played: number | null; max_rounds: number | null; started_at: string | null; updated_at: string; stale: boolean | null;
  side1_name: string | null; side2_name: string | null; parent_match_id: string | null; parent_side1: number | null;
};

export const toLiveSummary = (l: LiveRow): z.infer<typeof LiveMixSummary> => ({
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
