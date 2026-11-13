import { HTTPException } from 'hono/http-exception';
import { describe, expect, it, vi } from 'vitest';
import { AppError, fromAuthError, fromPostgrest } from '../../src/lib/errors';
import { json, makeApp, testEnv } from '../helpers';

describe('fromPostgrest', () => {
  it.each([
    ['PGRST301', 401, 'UNAUTHORIZED'],
    ['PGRST303', 401, 'UNAUTHORIZED'],
    ['42501', 403, 'FORBIDDEN'],
    ['PGRST116', 404, 'NOT_FOUND'],
    ['23505', 409, 'CONFLICT'],
    ['23503', 400, 'VALIDATION_ERROR'],
    ['23514', 400, 'VALIDATION_ERROR'],
    ['22P02', 400, 'VALIDATION_ERROR'],
    // La base no da abasto (sin conexiones libres en PostgREST o statement_timeout): pasajero.
    ['PGRST003', 503, 'UNAVAILABLE'],
    ['57014', 503, 'UNAVAILABLE'],
    ['XX000', 500, 'INTERNAL'],
    [undefined, 500, 'INTERNAL'],
  ])('%s → %i %s', (code, status, appCode) => {
    // Mensaje como los que genera Postgres (en inglés): no se muestra.
    const pg = code === '42501' ? 'permission denied for table x: ' : code === '23505' ? 'duplicate key value violates x: ' : '';
    const e = fromPostgrest({ code, message: pg + 'detalle interno' });
    expect(e.status).toBe(status);
    expect(e.code).toBe(appCode);
    expect(e.message).not.toContain('detalle interno');
  });

  it.each([
    ['42501', 403, 'Solo el capitán o un admin puede invitar jugadores'],
    ['23505', 409, 'Ese alias ya está en uso'],
  ])('%s con un raise propio conserva el mensaje', (code, status, message) => {
    expect(fromPostgrest({ code, message })).toMatchObject({ status, message });
  });

  it.each([
    ['V3401', 404, 'NOT_A_MEMBER'],
    ['V3402', 409, 'ROSTER_FULL'],
    ['V3403', 400, 'COACH_NOT_ALLOWED'],
    ['V3404', 409, 'REGISTRATION_CLOSED'],
  ])('%s (código propio del replanteo 33) → %i %s con el mensaje de la función', (code, status, appCode) => {
    expect(fromPostgrest({ code, message: 'Mensaje para el usuario' })).toMatchObject({ status, code: appCode, message: 'Mensaje para el usuario' });
  });

  it('V3405 → 400 PLAYER_NOT_LINKED con los alias del detail', () => {
    const e = fromPostgrest({ code: 'V3405', message: 'No tienen el SteamID vinculado: A, B', details: '["A", "B"]' });
    expect(e).toMatchObject({ status: 400, code: 'PLAYER_NOT_LINKED', details: { aliases: ['A', 'B'] } });
    expect(fromPostgrest({ code: 'V3405', message: 'x', details: 'no es JSON' }).details).toEqual({ aliases: [] });
  });

  it('P0001 conserva el mensaje de la función SQL (es para el usuario)', () => {
    const e = fromPostgrest({ code: 'P0001', message: 'El tag debe tener entre 2 y 24 caracteres' });
    expect(e).toMatchObject({ status: 400, code: 'BUSINESS_RULE', message: 'El tag debe tener entre 2 y 24 caracteres' });
  });

  it('P0002 → 404 NOT_FOUND con el mensaje de la función (replanteo 39)', () => {
    expect(fromPostgrest({ code: 'P0002', message: 'No existe ese equipo' })).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'No existe ese equipo' });
  });

  it('V3901 → 409 CONFLICT con el objeto del detail, si viene (replanteo 39)', () => {
    const e = fromPostgrest({ code: 'V3901', message: 'Una vez cada 30 días', details: '{"next_change_at": "2026-11-29T10:00:00+00:00"}' });
    expect(e).toMatchObject({ status: 409, code: 'CONFLICT', message: 'Una vez cada 30 días', details: { next_change_at: '2026-11-29T10:00:00+00:00' } });
    expect(fromPostgrest({ code: 'V3901', message: 'x' }).details).toBeUndefined();
    expect(fromPostgrest({ code: 'V3901', message: 'x', details: '["no", "objeto"]' }).details).toBeUndefined();
  });

  it('V8904 → 409 CONFLICT con next_change_at (límite de cambios de bloqueo, replanteo 104)', () => {
    const e = fromPostgrest({ code: 'V8904', message: 'Ya cambiaste tu bloqueo 5 veces en los últimos 7 días', details: '{"next_change_at": "2026-11-16T21:00:00+00:00"}' });
    expect(e.status).toBe(409);
    expect(e.code).toBe('CONFLICT');
    expect(e.message).toBe('Ya cambiaste tu bloqueo 5 veces en los últimos 7 días');
    expect(e.details).toEqual({ next_change_at: '2026-11-16T21:00:00+00:00' });
  });
});

describe('fromAuthError', () => {
  it('sesión cerrada: el AuthSessionMissingError de supabase-js (status 400, sin code) es 401', () => {
    const e = fromAuthError({ name: 'AuthSessionMissingError', status: 400, code: undefined, message: 'Auth session missing!' });
    expect(e).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  it('un error desconocido sigue siendo 500', () => {
    expect(fromAuthError({ name: 'AuthApiError', status: 400, message: 'x' })).toMatchObject({ status: 500, code: 'INTERNAL' });
  });
});

describe('onError', () => {
  const appWith = (handler: () => never) => {
    const app = makeApp();
    app.get('/boom', handler);
    return app;
  };

  it('AppError → su status, código, detalles y headers', async () => {
    const res = await appWith(() => {
      throw new AppError(429, 'RATE_LIMITED', 'Espera un minuto.', { intentos: 10 }, { 'Retry-After': '60' });
    }).request('/boom', {}, testEnv());
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
    expect((await json(res)).error).toMatchObject({ code: 'RATE_LIMITED', message: 'Espera un minuto.', details: { intentos: 10 } });
  });

  it('HTTPException → código según el status', async () => {
    const res = await appWith(() => {
      throw new HTTPException(401, { message: 'Falta el token.' });
    }).request('/boom', {}, testEnv());
    expect(res.status).toBe(401);
    expect((await json(res)).error).toMatchObject({ code: 'UNAUTHORIZED', message: 'Falta el token.' });
  });

  it('error inesperado → 500 genérico, sin filtrar el mensaje, y lo registra con el requestId', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await appWith(() => {
      throw new Error('password=hunter2 en la consulta');
    }).request('/boom', {}, testEnv());
    expect(res.status).toBe(500);
    const body = await json(res);
    expect(body.error.code).toBe('INTERNAL');
    expect(JSON.stringify(body)).not.toContain('hunter2');
    const line = JSON.parse(String(log.mock.calls[0]?.[0]));
    expect(line).toMatchObject({ level: 'error', path: '/boom', requestId: body.error.requestId });
    log.mockRestore();
  });
});
