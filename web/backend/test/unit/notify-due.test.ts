import { describe, expect, it } from 'vitest';
import { runNotifyDue, summary } from '../../src/jobs/notify-due';

describe('notificaciones programadas', () => {
  it('devuelve el resumen de notify_due', async () => {
    const calls: string[] = [];
    const r = await runNotifyDue(async (fn) => {
      calls.push(fn);
      return { data: { match_soon: 2, vip_expiring: 0 }, error: null };
    });
    expect(calls).toEqual(['notify_due']);
    expect(r).toEqual({ match_soon: 2, vip_expiring: 0 });
  });

  it('tira el error de la base', async () => {
    await expect(runNotifyDue(async () => ({ data: null, error: { code: 'PGRST202', message: 'no existe' } }))).rejects.toThrow(
      'PGRST202 no existe',
    );
    await expect(runNotifyDue(async () => ({ data: null, error: null }))).rejects.toThrow('no devolvió');
  });

  it('el resumen solo nombra lo que mandó', () => {
    expect(summary({ match_soon: 2, pcw_soon: 0, vip_expiring: 1 })).toBe('match_soon 2, vip_expiring 1');
    expect(summary({ match_soon: 0, season_ending: 0 })).toBeNull();
    expect(summary({})).toBeNull();
  });
});
