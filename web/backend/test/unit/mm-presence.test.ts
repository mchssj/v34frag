import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WSContext } from 'hono/ws';
import { createMmHub, MM_GRACE_S, MM_POLL_PRESENCE_MS, type MmPresence } from '../../src/mm/socket';

// Presencia en la cola (replanteo 63): pausa al cerrarse la última conexión y salida a los 10 s si no vuelve.
type Call = [string, ...unknown[]];

function setup() {
  const calls: Call[] = [];
  const presence: MmPresence = {
    away: async (u) => calls.push(['away', u]),
    back: async (u) => calls.push(['back', u]),
    dropAway: async (u, g) => calls.push(['drop', u, g]),
    sweep: async (online, g) => calls.push(['sweep', [...online].sort(), g]),
  };
  const hub = createMmHub(async (token) => ({ id: token }), presence, () => Date.now());
  const connect = async (user: string) => {
    const ws = { send: () => {}, close: () => {} } as unknown as WSContext;
    const conn = hub.open(ws)!;
    await hub.message(conn, JSON.stringify({ t: 'auth', token: user }));
    return conn;
  };
  return { hub, calls, connect };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('presencia en la cola', () => {
  it('al cerrarse la última conexión: pausa al instante y sale a los 10 s', async () => {
    const { hub, calls, connect } = setup();
    const c = await connect('u1');
    expect(calls).toEqual([['back', 'u1']]);
    hub.closed(c);
    expect(calls.at(-1)).toEqual(['away', 'u1']);
    await vi.advanceTimersByTimeAsync(MM_GRACE_S * 1000 - 1);
    expect(calls.some(([k]) => k === 'drop')).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls.at(-1)).toEqual(['drop', 'u1', MM_GRACE_S]);
  });

  it('con dos pestañas, cerrar una no pausa', async () => {
    const { hub, calls, connect } = setup();
    const a = await connect('u1');
    await connect('u1');
    hub.closed(a);
    await vi.advanceTimersByTimeAsync(MM_GRACE_S * 1000 + 1);
    expect(calls).toEqual([['back', 'u1']]);
  });

  it('si vuelve dentro de la gracia (recarga), no sale', async () => {
    const { hub, calls, connect } = setup();
    hub.closed(await connect('u1'));
    await vi.advanceTimersByTimeAsync(3_000);
    await connect('u1');
    expect(calls.at(-1)).toEqual(['back', 'u1']);
    await vi.advanceTimersByTimeAsync(MM_GRACE_S * 1000);
    expect(calls.some(([k]) => k === 'drop')).toBe(false);
  });

  it('un despliegue (shutdown) no pausa ni saca a nadie', async () => {
    const { hub, calls, connect } = setup();
    await connect('u1');
    await connect('u2');
    calls.length = 0;
    hub.shutdown();
    await vi.advanceTimersByTimeAsync(MM_GRACE_S * 1000 + 1);
    expect(calls).toEqual([]);
    await hub.sweep();
    expect(calls).toEqual([]);
  });

  it('sin socket, pedir el estado cuenta como conectado', async () => {
    const { hub, calls, connect } = setup();
    hub.polled('u2');
    expect(calls).toEqual([['back', 'u2']]);
    hub.polled('u2');
    expect(calls).toHaveLength(1);
    // Se le cae el socket pero sigue pidiendo el estado: no se lo pausa.
    hub.closed(await connect('u2'));
    expect(calls.some(([k]) => k === 'away')).toBe(false);
    expect(hub.online()).toEqual(['u2']);
    await vi.advanceTimersByTimeAsync(MM_POLL_PRESENCE_MS);
    expect(hub.online()).toEqual([]);
  });

  it('la red de seguridad manda los conectados por socket y por pedidos', async () => {
    const { hub, calls, connect } = setup();
    await connect('u1');
    hub.polled('u3');
    await hub.sweep();
    expect(calls.at(-1)).toEqual(['sweep', ['u1', 'u3'], MM_GRACE_S]);
  });

  it('sin presencia configurada (sin MM_LISTEN_URL) no hace nada', async () => {
    const hub = createMmHub(async (token) => ({ id: token }));
    const ws = { send: () => {}, close: () => {} } as unknown as WSContext;
    const conn = hub.open(ws)!;
    await hub.message(conn, JSON.stringify({ t: 'auth', token: 'u1' }));
    hub.closed(conn);
    hub.polled('u1');
    await expect(hub.sweep()).resolves.toBeUndefined();
  });
});
