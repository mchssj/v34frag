import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WSContext } from 'hono/ws';
import { claimsVerifier, createMmHub, MM_DEAD_MS, MM_GRACE_S, MM_PING_MS, MM_POLL_PRESENCE_MS, MM_QUEUE_COALESCE_MS, type MmPresence } from '../../src/mm/socket';

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
  const sent = new Map<object, string[]>();
  const connect = async (user: string) => {
    const out: string[] = [];
    const ws = { send: (m: string) => out.push(m), close: () => {} } as unknown as WSContext;
    const conn = hub.open(ws)!;
    sent.set(conn, out);
    await hub.message(conn, JSON.stringify({ t: 'auth', token: user }));
    out.length = 0;
    return conn;
  };
  return { hub, calls, connect, sent };
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
    const { hub, calls } = setup();
    hub.polled('u2');
    expect(calls).toEqual([['back', 'u2']]);
    hub.polled('u2');
    expect(calls).toHaveLength(1);
    expect(hub.online()).toEqual(['u2']);
    await vi.advanceTimersByTimeAsync(MM_POLL_PRESENCE_MS);
    expect(hub.online()).toEqual([]);
  });

  it('con el socket abierto, pedir el estado no evita la pausa al cerrar (error 1)', async () => {
    const { hub, calls, connect } = setup();
    const c = await connect('u1');
    // La web pide el estado cada 30 s aunque el socket ande.
    hub.polled('u1');
    hub.closed(c);
    expect(calls.at(-1)).toEqual(['away', 'u1']);
    await vi.advanceTimersByTimeAsync(MM_GRACE_S * 1000);
    expect(calls.at(-1)).toEqual(['drop', 'u1', MM_GRACE_S]);
  });

  it('si el socket se cae y la web sigue pidiendo el estado, vuelve', async () => {
    const { hub, calls, connect } = setup();
    hub.closed(await connect('u2'));
    expect(calls.at(-1)).toEqual(['away', 'u2']);
    hub.polled('u2');
    expect(calls.at(-1)).toEqual(['back', 'u2']);
    await vi.advanceTimersByTimeAsync(MM_GRACE_S * 1000 + 1);
    expect(calls.some(([k]) => k === 'drop')).toBe(false);
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

describe('latido (error 2)', () => {
  it('manda ping y corta la conexión que no dio señales en 35 s; esa cuenta queda en pausa', async () => {
    const { hub, calls, connect, sent } = setup();
    const c = await connect('u1');
    await vi.advanceTimersByTimeAsync(MM_PING_MS);
    hub.heartbeat();
    expect(sent.get(c)).toEqual(['{"t":"ping"}']);
    await vi.advanceTimersByTimeAsync(MM_DEAD_MS);
    hub.heartbeat();
    expect(hub.size()).toBe(0);
    expect(calls.at(-1)).toEqual(['away', 'u1']);
  });

  it('un pong (o cualquier mensaje) la mantiene viva', async () => {
    const { hub, connect } = setup();
    const c = await connect('u1');
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(MM_PING_MS);
      await hub.message(c, '{"t":"pong"}');
      hub.heartbeat();
    }
    expect(hub.size()).toBe(1);
  });
});

describe('queue.changed agrupado (mejora C)', () => {
  it('varios seguidos a todos: llega uno solo, el último', async () => {
    const { hub, connect, sent } = setup();
    const c = await connect('u1');
    for (let n = 10; n > 0; n--) hub.dispatch({ t: 'queue.changed', users: [], d: { size: n } });
    expect(sent.get(c)).toEqual([]);
    await vi.advanceTimersByTimeAsync(MM_QUEUE_COALESCE_MS);
    expect(sent.get(c)!.map((m) => JSON.parse(m))).toEqual([{ t: 'queue.changed', d: { size: 1 } }]);
  });

  it('los demás avisos salen en el acto', async () => {
    const { hub, connect, sent } = setup();
    const c = await connect('u1');
    hub.dispatch({ t: 'lobby.found', lobby: 'L', users: ['u1'] });
    expect(sent.get(c)).toHaveLength(1);
  });

  it('un socket que falla al enviar no corta el envío a los demás', async () => {
    const { hub, connect, sent } = setup();
    const roto = hub.open({ send: () => { throw new Error('cerrado'); }, close: () => {} } as unknown as WSContext)!;
    await hub.message(roto, JSON.stringify({ t: 'auth', token: 'u0' })).catch(() => {});
    const c = await connect('u1');
    hub.dispatch({ t: 'lobby.update', lobby: 'L', users: ['u0', 'u1'] });
    expect(sent.get(c)).toHaveLength(1);
  });
});

describe('validación del token del socket (mejora D)', () => {
  const client = (data: unknown, error: unknown = null) => ({ auth: { getClaims: vi.fn(async () => ({ data, error })) } });

  it('un usuario autenticado: su id y el vencimiento', async () => {
    const c = client({ claims: { sub: 'u1', role: 'authenticated', exp: 123 } });
    await expect(claimsVerifier(c)('tok')).resolves.toEqual({ id: 'u1', exp: 123 });
    expect(c.auth.getClaims).toHaveBeenCalledWith('tok');
  });

  it('la clave anon, un token inválido o sin sub: null', async () => {
    await expect(claimsVerifier(client({ claims: { role: 'anon' } }))('tok')).resolves.toBeNull();
    await expect(claimsVerifier(client(null, new Error('firma')))('tok')).resolves.toBeNull();
    await expect(claimsVerifier(client({ claims: { role: 'authenticated' } }))('tok')).resolves.toBeNull();
  });
});
