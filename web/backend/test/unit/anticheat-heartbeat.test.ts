import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeApp, testEnv } from '../helpers';

// Latido del agente con el token de acceso vencido (2026-11-27, prueba en el servidor local, docs/bitacora/2026-11-27-anticheat-sin-eac).
// El agente solo renueva el token con un 401. Con el latido firmado, la API pregunta primero la clave del equipo
// (ac_device_key), y con el token vencido la base da 42501, que fromPostgrest vuelve 403: el agente quedaba sin latidos.
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const SECRET = 'a'.repeat(64);
const pgError = (code: string, message: string) => Response.json({ code, message, details: null, hint: null }, { status: 403 });

function postgrest(deviceKey: () => Response) {
  const rpcs: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      const rpc = url.pathname.split('/rpc/')[1] ?? url.pathname;
      rpcs.push(rpc);
      if (rpc === 'ac_device_key') return deviceKey();
      return new Response('no simulado: ' + url, { status: 599 });
    }),
  );
  return rpcs;
}

const beat = () =>
  makeApp().request(
    '/api/v1/anticheat/heartbeat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agent-Token': 'token-vencido', 'X-AC-Ts': '1795800000', 'X-AC-Sig': 'firma' },
      body: JSON.stringify({ agent_version: '0.6.0' }),
    },
    testEnv({ AC_API_SECRET: SECRET }),
  );

describe('POST /api/v1/anticheat/heartbeat firmado', () => {
  it('con el token vencido responde 401, para que el agente lo renueve', async () => {
    const rpcs = postgrest(() => pgError('42501', 'Token de agente inválido'));
    const res = await beat();
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
    // El agente no renueva si el mensaje habla de la firma.
    expect(body.error.message).not.toContain('firma');
    expect(rpcs).toEqual(['ac_device_key']);
  });

  it('sin el secreto de la API correcto sigue siendo 403', async () => {
    postgrest(() => pgError('42501', 'Solo la API puede llamar a esta función'));
    expect((await beat()).status).toBe(403);
  });
});
