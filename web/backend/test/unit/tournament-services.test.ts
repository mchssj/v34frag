import { describe, expect, it } from 'vitest';
import { sumSeries, vetoSequence, vetoState } from '../../src/services/matches';
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
  it('grupos de doble eliminación (groups_double)', () => {
    const l = new Map([['group_upper:1', 3], ['group_lower:1', 4]]);
    expect(stageLabel({ stage: 'group_upper', phase: 1, grp: 1, round: 2 }, l)).toBe('Grupo A · upper · ronda 2');
    expect(stageLabel({ stage: 'group_upper', phase: 1, grp: 2, round: 3 }, l)).toBe('Grupo B · final del upper');
    expect(stageLabel({ stage: 'group_lower', phase: 1, grp: 1, round: 1 }, l)).toBe('Grupo A · lower · ronda 1');
    expect(stageLabel({ stage: 'group_lower', phase: 1, grp: 2, round: 4 }, l)).toBe('Grupo B · final del lower');
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

describe('sumSeries (E21)', () => {
  const zeros = { kills: 0, deaths: 0, assists: 0, headshots: 0, damage: 0, rounds: 0, k2: 0, k3: 0, k4: 0, k5: 0, first_kills: 0, first_deaths: 0, plants: 0, defuses: 0 };
  const row = (match_id: string, player_id: string | null, steam_id: string, team: number, rounds: number, rating: number | null, kills: number) =>
    ({ ...zeros, match_id, player_id, steam_id, nick: steam_id, team, rounds, rating, kills });

  it('suma los juegos con el lado de la serie y el rating ponderado por rondas', () => {
    // En el juego g2 los bandos están invertidos: el lado 2 del juego es el lado 1 de la serie.
    const out = sumSeries(
      [row('g1', 'p1', 's1', 1, 30, 1.5, 25), row('g2', 'p1', 's1', 2, 20, 0.5, 10), row('g1', null, 's9', 2, 30, 1, 20)],
      new Map([['g1', false], ['g2', true]]),
    );
    const p1 = out.find((x) => x.player_id === 'p1');
    expect(p1).toMatchObject({ team: 1, kills: 35, rounds: 50, rating: 1.1, elo_delta: null });
    expect(out.find((x) => x.steam_id === 's9')).toMatchObject({ team: 2, rounds: 30, rating: 1 });
    expect(out).toHaveLength(2);
  });

  it('sin rating en ningún juego queda en null', () => {
    expect(sumSeries([row('g1', 'p1', 's1', 1, 0, null, 0)], new Map())[0]?.rating).toBeNull();
  });
});
