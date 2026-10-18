import { describe, expect, it } from 'vitest';
import { liveRounds, toLiveGame, toLiveSummary, type LiveRow } from '../../src/services/live';
import { crashMinRounds, mixReview } from '../../src/services/matches';

const row: LiveRow = {
  uid: 'srv1-x', server_id: '00000000-0000-4000-8000-000000000001', server_name: 'S', seq: 3, map: 'dust2', score1: 7, score2: 2,
  rounds_played: 9, max_rounds: 24, started_at: null, updated_at: '2026-10-17T00:00:00Z', stale: null,
  side1_name: 'Equipo A', side2_name: 'Mix de B', parent_match_id: null, parent_side1: null,
};

describe('crashMinRounds', () => {
  it('35 % de las rondas del mix, hacia arriba (igual que crash_min_rounds)', () => {
    expect(crashMinRounds(24)).toBe(9);
    expect(crashMinRounds(30)).toBe(11);
    expect(crashMinRounds(20)).toBe(7);
    expect(crashMinRounds(4)).toBe(2);
    expect(crashMinRounds(0)).toBe(1);
  });
});

describe('mixReview', () => {
  const base = { review: 'pending', review_max_rounds: 24, score1: 5, score2: 4 };
  it('null si no es un interrumpido', () => {
    expect(mixReview({ ...base, review: null })).toBeNull();
    expect(mixReview({ ...base, review_max_rounds: null })).toBeNull();
  });
  it('pendiente que se puede aprobar', () => {
    expect(mixReview(base)).toEqual({ status: 'pending', max_rounds: 24, rounds_played: 9, min_rounds: 9, can_apply: true, blocked_reason: null });
  });
  it('pendiente sin el mínimo o empatado', () => {
    expect(mixReview({ ...base, score1: 4, score2: 4 })?.blocked_reason).toMatch(/Se jugaron 8 de 24 rondas: hacen falta 9/);
    expect(mixReview({ ...base, score1: 5, score2: 5 })).toMatchObject({ can_apply: false, blocked_reason: expect.stringMatching(/empatados/) });
    expect(mixReview({ ...base, score1: null, score2: null })).toMatchObject({ rounds_played: 0, can_apply: false });
  });
  it('revisado: sin motivo de bloqueo', () => {
    expect(mixReview({ ...base, review: 'discarded', score1: 1, score2: 1 })).toMatchObject({ status: 'discarded', can_apply: false, blocked_reason: null });
  });
});

describe('mixes en vivo', () => {
  it('resumen', () => {
    expect(toLiveSummary(row)).toMatchObject({ side1: { name: 'Equipo A', score: 7 }, side2: { name: 'Mix de B', score: 2 }, stale: false, rounds_played: 9 });
    expect(toLiveSummary({ ...row, rounds_played: null, stale: true })).toMatchObject({ rounds_played: 0, stale: true });
  });
  it('juego de una serie: parent_side1 = 2 da vuelta el marcador', () => {
    expect(toLiveGame(row)).toMatchObject({ score1: 7, score2: 2 });
    expect(toLiveGame({ ...row, parent_side1: 2 })).toMatchObject({ score1: 2, score2: 7 });
  });
  it('rondas de la foto', () => {
    expect(liveRounds(null)).toEqual([]);
    expect(liveRounds([{ n: 1, winner: 'a', a_side: 'CT', reason: 8 }, { winner: 'b', a_side: 'x' }])).toEqual([
      { n: 1, winner_side: 1, side1_as: 'CT', reason: 8 },
      { n: 2, winner_side: 2, side1_as: null, reason: null },
    ]);
  });
});
