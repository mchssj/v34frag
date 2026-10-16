import type { z } from '@hono/zod-openapi';
import type { Config } from '../env';
import type { MatchSummary, VetoState } from '../schemas/matches';
import { stageLabel, type StageInfo } from './stages';

// Columnas de la vista match_list (replanteo 11) que arman un MatchSummary.
export const MATCH_LIST =
  'id, kind, status, event_id, event_name, stage, phase, grp, round, pos, bye, best_of, map, starts_at, played_at, score1, score2, winner_side, ' +
  'side1_name, side2_name, team1_id, team1_name, team1_tag, team2_id, team2_name, team2_tag, end_reason, demo_status, parent_match_id, last_round';

export type MatchRow = StageInfo & {
  id: string; kind: string; status: string; event_id: string | null; event_name: string | null; pos: number | null; bye: boolean;
  best_of: number; map: string | null; starts_at: string | null; played_at: string | null; score1: number | null; score2: number | null;
  winner_side: number | null; side1_name: string | null; side2_name: string | null; team1_id: string | null; team1_name: string | null;
  team1_tag: string | null; team2_id: string | null; team2_name: string | null; team2_tag: string | null; end_reason: string | null;
  demo_status: string; parent_match_id: string | null; last_round: number | null;
};

const team = (id: string | null, name: string | null, tag: string | null) => (id ? { id, name: name ?? '', tag } : null);

export function toSummary(m: MatchRow): z.infer<typeof MatchSummary> {
  const last = new Map<string, number>();
  if (m.stage && m.last_round !== null) last.set(`${m.stage}:${m.phase ?? 1}`, m.last_round);
  return {
    id: m.id,
    kind: m.kind as 'mix' | 'pcw' | 'official',
    status: m.status as 'upcoming' | 'live' | 'finished' | 'cancelled',
    label: m.event_id ? stageLabel(m, last) : null,
    event: m.event_id ? { id: m.event_id, name: m.event_name ?? '' } : null,
    side1: { name: m.team1_name ?? m.side1_name, team: team(m.team1_id, m.team1_name, m.team1_tag), score: m.score1 },
    side2: { name: m.team2_name ?? m.side2_name, team: team(m.team2_id, m.team2_name, m.team2_tag), score: m.score2 },
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
