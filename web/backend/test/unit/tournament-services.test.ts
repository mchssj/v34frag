import { describe, expect, it } from 'vitest';
import { vetoSequence, vetoState } from '../../src/services/matches';
import { lastRounds, stageLabel } from '../../src/services/stages';

describe('stageLabel', () => {
  const rows = [
    { stage: 'ko', phase: 2, grp: null, round: 1 },
    { stage: 'ko', phase: 2, grp: null, round: 4 },
    { stage: 'upper', phase: 1, grp: null, round: 3 },
    { stage: 'lower', phase: 1, grp: null, round: 4 },
  ];
  const last = lastRounds(rows);
  it.each([
    [{ stage: 'ko', phase: 2, grp: null, round: 4 }, 'Final'],
    [{ stage: 'ko', phase: 2, grp: null, round: 3 }, 'Semifinal'],
    [{ stage: 'ko', phase: 2, grp: null, round: 2 }, 'Cuartos de final'],
    [{ stage: 'ko', phase: 2, grp: null, round: 1 }, 'Octavos de final'],
    [{ stage: 'third', phase: 2, grp: null, round: 4 }, 'Tercer puesto'],
    [{ stage: 'upper', phase: 1, grp: null, round: 3 }, 'Final del upper'],
    [{ stage: 'upper', phase: 1, grp: null, round: 1 }, 'Upper · ronda 1'],
    [{ stage: 'lower', phase: 1, grp: null, round: 4 }, 'Final del lower'],
    [{ stage: 'lower', phase: 1, grp: null, round: 2 }, 'Lower · ronda 2'],
    [{ stage: 'grand', phase: 1, grp: null, round: 1 }, 'Gran final'],
    [{ stage: 'group', phase: 1, grp: 2, round: 3 }, 'Grupo B · fecha 3'],
    [{ stage: 'swiss', phase: 2, grp: null, round: 4 }, 'Suizo · fase 2 · ronda 4'],
    [{ stage: null, phase: null, grp: null, round: null }, null],
  ])('%j → %s', (m, label) => {
    expect(stageLabel(m, last)).toBe(label);
  });
  it('ronda lejana de la final', () => {
    expect(stageLabel({ stage: 'ko', phase: 1, grp: null, round: 1 }, new Map([['ko:1', 6]]))).toBe('Ronda 1');
  });
});

describe('veto', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((n) => ({ name: n, versions: n === 'd' ? ['d', 'd_classic'] : [n] }));
  it('secuencias por BO con 8 mapas', () => {
    expect(vetoSequence(1, 8)).toEqual(Array(7).fill('ban'));
    expect(vetoSequence(3, 8)).toEqual(['ban', 'ban', 'pick', 'pick', 'ban', 'ban', 'ban']);
    expect(vetoSequence(5, 8)).toEqual(['ban', 'ban', 'pick', 'pick', 'pick', 'pick', 'ban']);
  });
  it('turnos alternados y mapas a jugar con la versión del decisivo', () => {
    let s = vetoState(pool, [], 1, 't1', 't2', {});
    expect(s.next).toEqual({ team_id: 't1', action: 'ban' });
    const acts = ['a', 'b', 'c', 'e', 'f', 'g', 'h'].map((map, i) => ({ seq: i + 1, team_id: i % 2 ? 't2' : 't1', map, action: 'ban', version: null }));
    s = vetoState(pool, acts.slice(0, 1), 1, 't1', 't2', {});
    expect(s.next).toEqual({ team_id: 't2', action: 'ban' });
    s = vetoState(pool, acts, 1, 't1', 't2', { d: 'd_classic' });
    expect(s.next).toBeNull();
    expect(s.maps_to_play).toEqual([{ map: 'd', version: 'd_classic', decider: true }]);
    expect(vetoState(pool, acts, 1, 't1', 't2', {}).maps_to_play[0]!.version).toBe('d');
  });
});
