import type { z } from '@hono/zod-openapi';
import type { Config } from '../env';
import { mustHave } from '../lib/db';
import type { Db } from '../lib/supabase';
import type { MatchSummary, VetoState } from '../schemas/matches';
import { lastRounds, stageLabel, type StageInfo } from './stages';

// Columnas de matches que se pueden leer (link_code está oculto desde el replanteo 10).
export const MATCH_LIST =
  'id, kind, status, event_id, stage, phase, grp, round, best_of, map, starts_at, played_at, score1, score2, winner_side, ' +
  'side1_name, side2_name, end_reason, demo_status, parent_match_id, ' +
  'team1:teams!matches_team1_fkey(id, name, tag), team2:teams!matches_team2_fkey(id, name, tag), event:events!matches_event_id_fkey(id, name)';

type TeamRef = { id: string; name: string; tag: string | null } | null;
export type MatchRow = StageInfo & {
  id: string; kind: string; status: string; event_id: string | null; best_of: number; map: string | null;
  starts_at: string | null; played_at: string | null; score1: number | null; score2: number | null; winner_side: number | null;
  side1_name: string | null; side2_name: string | null; end_reason: string | null; demo_status: string; parent_match_id: string | null;
  team1: TeamRef; team2: TeamRef; event: { id: string; name: string } | null;
};

/** Última ronda de cada etapa de los torneos de estas partidas (para "Final", "Semifinal"…). */
export async function eventRounds(sb: Db, rows: { event_id: string | null }[]) {
  const ids = [...new Set(rows.map((r) => r.event_id).filter((x): x is string => !!x))];
  const out = new Map<string, Map<string, number>>();
  if (!ids.length) return out;
  const all = mustHave(await sb.from('matches').select('event_id, stage, phase, grp, round').in('event_id', ids));
  for (const id of ids) out.set(id, lastRounds(all.filter((r) => r.event_id === id)));
  return out;
}

export function toSummary(m: MatchRow, rounds: Map<string, Map<string, number>>): z.infer<typeof MatchSummary> {
  return {
    id: m.id,
    kind: m.kind as 'mix' | 'pcw' | 'official',
    status: m.status as 'upcoming' | 'live' | 'finished' | 'cancelled',
    label: m.event_id ? stageLabel(m, rounds.get(m.event_id) ?? new Map()) : null,
    event: m.event,
    side1: { name: m.team1?.name ?? m.side1_name, team: m.team1, score: m.score1 },
    side2: { name: m.team2?.name ?? m.side2_name, team: m.team2, score: m.score2 },
    winner_side: m.winner_side,
    best_of: m.best_of,
    map: m.map,
    starts_at: m.starts_at,
    played_at: m.played_at,
    end_reason: m.end_reason,
    demo_status: m.demo_status,
    parent_match_id: m.parent_match_id,
  };
}

export const demoUrl = (cfg: Config, m: { kind: string; external_id: string | null; demo_status: string }) =>
  m.kind === 'mix' && m.external_id && m.demo_status === 'uploaded' && cfg.DEMO_BASE_URL
    ? `${cfg.DEMO_BASE_URL}/demo/${encodeURIComponent(m.external_id)}`
    : null;

/** Secuencia del veto, igual que veto_sequence() en la base. */
export function vetoSequence(bo: number, maps: number): ('ban' | 'pick')[] {
  const a: ('ban' | 'pick')[] = [];
  if (bo >= 3) a.push('ban', 'ban');
  if (bo === 3) a.push('pick', 'pick');
  if (bo >= 5) a.push('pick', 'pick', 'pick', 'pick');
  while (a.length < maps - 1) a.push('ban');
  return a.slice(0, Math.max(0, maps - 1));
}

type VetoRow = { seq: number; team_id: string | null; map: string; action: string; version: string | null };

/** Estado del veto: próximo turno y, al terminar, los mapas a jugar con su versión. */
export function vetoState(
  pool: { name: string; versions: string[] }[],
  rows: VetoRow[],
  bo: number,
  team1: string | null,
  team2: string | null,
  deciderVersions: Record<string, string>,
): z.infer<typeof VetoState> {
  const actions = [...rows].sort((a, b) => a.seq - b.seq).map((r) => ({ ...r, action: r.action as 'ban' | 'pick' }));
  const sequence = vetoSequence(bo, pool.length);
  const n = actions.length;
  const done = n >= sequence.length;
  const used = new Set(actions.map((a) => a.map));
  const rest = pool.filter((p) => !used.has(p.name));
  const maps_to_play = done
    ? [
        ...actions.filter((a) => a.action === 'pick').map((a) => ({ map: a.map, version: a.version ?? a.map, decider: false })),
        ...rest.slice(0, 1).map((p) => ({ map: p.name, version: deciderVersions[p.name] ?? p.versions[0] ?? p.name, decider: true })),
      ]
    : [];
  return {
    pool,
    actions,
    sequence,
    next: done ? null : { team_id: n % 2 === 0 ? team1 : team2, action: sequence[n]! },
    maps_to_play,
  };
}
