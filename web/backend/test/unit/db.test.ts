import { describe, expect, it } from 'vitest';
import { levelOf, pageRange, searchTerm } from '../../src/lib/db';

describe('levelOf', () => {
  it.each([
    [null, null],
    [undefined, null],
    [0, 1],
    [500, 1],
    [501, 2],
    [1000, 4],
    [1051, 5],
    [1530, 7],
    [1531, 8],
    [2000, 9],
    [2001, 10],
    [3500, 10],
  ])('ELO %s → nivel %s', (elo, level) => {
    expect(levelOf(elo)).toBe(level);
  });
});

describe('searchTerm', () => {
  it('minúsculas, sin tildes ni caracteres especiales de PostgREST', () => {
    expect(searchTerm('  Ñandú  Ácido ')).toBe('nandu acido');
    expect(searchTerm('a%b_c*d,(e)\\"f')).toBe('a b c d e f');
  });
  it('vacío = sin filtro', () => {
    expect(searchTerm(undefined)).toBeNull();
    expect(searchTerm('  %* ')).toBeNull();
  });
});

describe('pageRange', () => {
  it('rango inclusivo para .range()', () => {
    expect(pageRange({ page: 1, per: 20 })).toEqual({ from: 0, to: 19 });
    expect(pageRange({ page: 3, per: 10 })).toEqual({ from: 20, to: 29 });
  });
});
