import { describe, expect, it } from 'vitest';
import { boolParam, envelope, listQuery, runList } from '../../src/lib/list';

describe('listQuery', () => {
  const Q = listQuery(['elo', 'alias'], { sort: 'elo', order: 'desc' });
  it('valores por defecto', () => {
    expect(Q.parse({})).toEqual({ page: 1, per: 20, sort: 'elo', order: 'desc' });
  });
  it('convierte los números del query string', () => {
    expect(Q.parse({ page: '3', per: '50', sort: 'alias', order: 'asc' })).toEqual({ page: 3, per: 50, sort: 'alias', order: 'asc' });
  });
  it.each([[{ sort: 'rating' }], [{ order: 'up' }], [{ per: '101' }], [{ page: '0' }]])('rechaza %j', (q) => {
    expect(Q.safeParse(q).success).toBe(false);
  });
  it('máximo por página configurable', () => {
    expect(listQuery(['x'], { sort: 'x', order: 'asc' }, 200).parse({ per: '200' }).per).toBe(200);
  });
  it('booleanos como texto', () => {
    expect(boolParam('x').parse('true')).toBe(true);
    expect(boolParam('x').parse('false')).toBe(false);
    expect(boolParam('x').parse(undefined)).toBeUndefined();
  });
});

describe('runList', () => {
  // Simula el query builder de PostgREST y registra cómo se usó.
  const fake = () => {
    const calls: unknown[][] = [];
    const q = {
      order(col: string, opts: object) {
        calls.push(['order', col, opts]);
        return q;
      },
      range(from: number, to: number) {
        calls.push(['range', from, to]);
        return Promise.resolve({ data: [{ id: 'a' }], error: null, count: 41 });
      },
    };
    return { q, calls };
  };

  it('ordena por las columnas del campo, desempata por id y pagina', async () => {
    const { q, calls } = fake();
    const r = await runList(q, { page: 3, per: 20, sort: 'bracket', order: 'asc' }, { bracket: ['phase', 'round'] });
    expect(calls).toEqual([
      ['order', 'phase', { ascending: true, nullsFirst: false }],
      ['order', 'round', { ascending: true, nullsFirst: false }],
      ['order', 'id', { ascending: true }],
      ['range', 40, 59],
    ]);
    expect(r).toEqual({ rows: [{ id: 'a' }], total: 41 });
  });

  it('sin traducción usa el mismo nombre; sin desempate si se pasa null', async () => {
    const { q, calls } = fake();
    await runList(q, { page: 1, per: 10, sort: 'elo', order: 'desc' }, {}, null);
    expect(calls).toEqual([['order', 'elo', { ascending: false, nullsFirst: false }], ['range', 0, 9]]);
  });

  it('una columna con dirección fija no sigue a `order` (desempate que no se invierte)', async () => {
    const { q, calls } = fake();
    await runList(q, { page: 1, per: 5, sort: 'rank', order: 'asc' }, { rank: ['rank', 'elo:desc'] }, null);
    expect(calls).toEqual([
      ['order', 'rank', { ascending: true, nullsFirst: false }],
      ['order', 'elo', { ascending: false, nullsFirst: false }],
      ['range', 0, 4],
    ]);
  });

  it('un error de la base se traduce', async () => {
    const q = {
      order: () => q,
      range: () => Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied for view x' }, count: null }),
    };
    await expect(runList(q, { page: 1, per: 1, sort: 'x', order: 'asc' }, {})).rejects.toMatchObject({ status: 403 });
  });

  it('envelope', () => {
    expect(envelope([1], 5, { page: 2, per: 1, sort: 'x', order: 'asc' })).toEqual({ items: [1], total: 5, page: 2, per: 1, sort: 'x', order: 'asc' });
  });
});
