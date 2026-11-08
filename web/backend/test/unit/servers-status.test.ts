import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { A2sError, a2sInfo, infoRequest, parseAddress, parseInfo, type UdpExchange, type UdpSession } from '../../src/lib/a2s';
import { STATUS_CACHE_MS, cachedServersStatus, serversStatus } from '../../src/services/servers';
import { json, testEnv } from '../helpers';

// Respuesta real del servidor local de pruebas (CS:S v34, de_dust2, 2 bots de 20), grabada el 2026-10-19.
const V34 = Uint8Array.from(
  Buffer.from(
    'ffffffff49074353532076333420436c69656e744d6f64205365727665720064655f64757374320063737472696b6500436f756e7465722d537472696b653a20536f7572636500f00002140264770000312e302e302e333400',
    'hex',
  ),
);
/** La misma respuesta con otros jugadores y bots. */
const withPlayers = (players: number, bots: number, max = 12) => {
  const b = V34.slice();
  const i = b.indexOf(0xf0) + 2; // después del id de la app (f0 00)
  b[i] = players;
  b[i + 1] = max;
  b[i + 2] = bots;
  return b;
};
const CHALLENGE = Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0x41, 1, 2, 3, 4]);

/**
 * UDP simulado: reply(host, paquete, socket) responde cada envío (o lanza). socket numera las conversaciones,
 * como el puerto de origen. calls guarda cada envío.
 */
function fakeUdp(reply: (host: string, packet: Uint8Array, socket: number) => Uint8Array) {
  const calls: { host: string; packet: Uint8Array; socket: number }[] = [];
  let sockets = 0;
  const udp: UdpExchange = async (host, _port, _timeoutMs, talk) => {
    const socket = ++sockets;
    const session: UdpSession = {
      send: async (packet) => {
        calls.push({ host, packet, socket });
        return reply(host, packet, socket);
      },
    };
    return talk(session);
  };
  return { udp, calls };
}

afterEach(() => vi.unstubAllGlobals());

describe('A2S', () => {
  it('lee la respuesta de un servidor v34', () => {
    expect(parseInfo(V34)).toEqual({ name: 'CSS v34 ClientMod Server', map: 'de_dust2', players: 2, max_players: 20, bots: 2 });
  });

  it('rechaza lo que no es S2A_INFO o viene cortado', () => {
    expect(() => parseInfo(Uint8Array.from([1, 2, 3, 4, 0x49]))).toThrow(A2sError);
    expect(() => parseInfo(CHALLENGE)).toThrow('no es una respuesta S2A_INFO');
    expect(() => parseInfo(V34.subarray(0, 30))).toThrow('respuesta cortada');
    expect(() => parseInfo(V34.subarray(0, 3))).toThrow('respuesta cortada');
  });

  it('reenvía el desafío por el mismo socket (como pide el servidor real)', async () => {
    // Como el servidor real: el desafío vale solo para el socket que lo recibió; si no, manda otro.
    const issued = new Map<number, number>();
    const { udp, calls } = fakeUdp((_h, packet, socket) => {
      const sent = packet.length > infoRequest().length ? packet[packet.length - 4]! : null;
      if (sent !== null && sent === issued.get(socket)) return V34;
      issued.set(socket, 7);
      return Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0x41, 7, 0, 0, 0]);
    });
    // performance.now: el primer envío tarda 5 ms y el segundo 12; ping_ms es solo el del segundo.
    const now = [0, 5, 100, 112];
    vi.spyOn(performance, 'now').mockImplementation(() => now.shift()!);
    const info = await a2sInfo(udp, 'h', 1, 1000);
    vi.mocked(performance.now).mockRestore();
    expect(info.map).toBe('de_dust2');
    expect(info.ping_ms).toBe(12);
    expect(calls.map((c) => c.socket)).toEqual([1, 1]);
    expect(calls[0]!.packet).toEqual(infoRequest());
    expect(Array.from(calls[1]!.packet.slice(-4))).toEqual([7, 0, 0, 0]);
    expect(CHALLENGE[4]).toBe(0x41);
  });

  it('direcciones', () => {
    expect(parseAddress('1.2.3.4:27062')).toEqual({ host: '1.2.3.4', port: 27062 });
    expect(parseAddress('connect css.ejemplo.com')).toEqual({ host: 'css.ejemplo.com', port: 27015 });
    expect(parseAddress('1.2.3.4:99999')).toBeNull();
    expect(parseAddress('no es una dirección')).toBeNull();
    expect(parseAddress(null)).toBeNull();
  });
});

type ServerRow = { id: string; name: string; connect_address: string | null; mode?: string | null; region?: string | null; tv_port?: number | null };
/**
 * Supabase simulado: game_servers_public (solo con el filtro listed, replanteo 83), los server_id de live_match_list (ya
 * filtrados por stale = false) y la cola (mm_public_counts).
 */
function db(rows: ServerRow[], live: { server_id: string }[] = [], counts: { open: boolean; in_queue: number } = { open: true, in_queue: 4 }) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/game_servers_public')) {
      if (!url.includes('listed=eq.true')) return new Response('falta el filtro listed', { status: 599 });
      return Response.json(rows.map((r) => ({ mode: null, region: null, ...r })));
    }
    if (url.includes('/rest/v1/rpc/mm_public_counts')) return Response.json(counts);
    if (url.includes('/rest/v1/live_match_list')) {
      if (!url.includes('stale=eq.false')) return new Response('falta el filtro stale', { status: 599 });
      return Response.json(live);
    }
    return new Response('no simulado: ' + url, { status: 599 });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const ROWS: ServerRow[] = [
  { id: A, name: 'v34frag #1', connect_address: '10.0.0.1:27062', mode: 'mix', region: 'Argentina', tv_port: 27020 },
  { id: B, name: 'RBK', connect_address: '10.0.0.2:27015' },
  { id: C, name: 'Sin dirección', connect_address: null },
];
// #1 responde con 10 jugadores y SourceTV; RBK no responde.
const servers = () =>
  fakeUdp((host) => {
    if (host === '10.0.0.1') return withPlayers(11, 1);
    throw new A2sError('sin respuesta');
  });

describe('GET /api/v1/servers/status', () => {
  const get = (app: ReturnType<typeof createApp>, headers: Record<string, string> = {}) =>
    app.request('/api/v1/servers/status', { headers }, testEnv());

  it('estado de cada servidor y totales; uno que no responde no frena a los demás', async () => {
    // Dos mixes en vivo en #1, uno en RBK y uno de un servidor que ya no está en la lista (no cuenta).
    db(ROWS, [{ server_id: A }, { server_id: A }, { server_id: B }, { server_id: '44444444-4444-4444-8444-444444444444' }]);
    const { udp, calls } = servers();
    const res = await get(createApp({ udp }));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.servers[0].ping_ms).toEqual(expect.any(Number));
    expect(body.servers).toEqual([
      { id: A, name: 'v34frag #1', address: '10.0.0.1:27062', tv_address: '10.0.0.1:27020', mode: 'mix', region: 'Argentina', online: true, ping_ms: body.servers[0].ping_ms,
        map: 'de_dust2', players: 10, max_players: 12, bots: 1, live_matches: 2 },
      { id: B, name: 'RBK', address: '10.0.0.2:27015', tv_address: null, mode: null, region: null, online: false, ping_ms: null,
        map: null, players: null, max_players: null, bots: null, live_matches: 1 },
      { id: C, name: 'Sin dirección', address: null, tv_address: null, mode: null, region: null, online: false, ping_ms: null,
        map: null, players: null, max_players: null, bots: null, live_matches: 0 },
    ]);
    expect(body.totals).toEqual({ servers: 3, online: 1, players: 10, live_matches: 3, in_queue: 4 });
    expect(body.mm_open).toBe(true);
    expect(calls).toHaveLength(2); // al de sin dirección no se le pregunta
  });

  it('guarda la respuesta 20 s y responde 304 con el mismo ETag', async () => {
    db(ROWS);
    const { udp, calls } = servers();
    const app = createApp({ udp });
    const first = await get(app);
    const etag = first.headers.get('etag')!;
    expect(etag).toMatch(/^W\//);
    expect((await get(app, { 'If-None-Match': etag })).status).toBe(304);
    expect(calls).toHaveLength(2);
  });

  it('501 sin UDP (Worker)', async () => {
    const res = await get(createApp());
    expect(res.status).toBe(501);
    expect((await json(res)).error.code).toBe('NOT_AVAILABLE');
  });

  it('si la base falla responde 500 y no guarda el error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 'XX000', message: 'caída' }, { status: 500 })));
    const app = createApp({ udp: servers().udp });
    expect((await get(app)).status).toBe(500);
    db(ROWS);
    expect((await get(app)).status).toBe(200);
  });
});

describe('la cola en el estado (replanteo 83)', () => {
  it('cola cerrada y vacía', async () => {
    db(ROWS, [], { open: false, in_queue: 0 });
    const res = await createApp({ udp: servers().udp }).request('/api/v1/servers/status', {}, testEnv());
    const body = await json(res);
    expect(body.totals.in_queue).toBe(0);
    expect(body.mm_open).toBe(false);
  });
});

describe('GET /api/v1/community/discord', () => {
  afterEach(async () => (await import('../../src/services/discord')).clearDiscordCache());
  const get = () => createApp().request('/api/v1/community/discord', {}, testEnv());

  it('los números de la invitación pública, sin datos del visitante', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ approximate_presence_count: 180, approximate_member_count: 1500, guild: { name: 'x' } }));
    vi.stubGlobal('fetch', fetch);
    const res = await get();
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ online: 180, members: 1500, invite_url: 'https://discord.gg/bn5Yxsh9tc' });
    expect(String(fetch.mock.calls[0]![0])).toBe('https://discord.com/api/v9/invites/bn5Yxsh9tc?with_counts=true');
    // Una segunda visita sale de la caché.
    await get();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('si Discord no responde, sin números (y 200)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('rate limited', { status: 429 })));
    const res = await get();
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ online: null, members: null, invite_url: 'https://discord.gg/bn5Yxsh9tc' });
  });

  it('la caché: 10 minutos con números, 1 minuto sin ellos', async () => {
    const { cachedDiscordCounts, DISCORD_CACHE_MS } = await import('../../src/services/discord');
    const ok = vi.fn(async () => Response.json({ approximate_presence_count: 1, approximate_member_count: 2 }));
    const t0 = 5_000_000;
    await cachedDiscordCounts('abc', ok, t0);
    await cachedDiscordCounts('abc', ok, t0 + DISCORD_CACHE_MS - 1);
    expect(ok).toHaveBeenCalledTimes(1);
    await cachedDiscordCounts('abc', ok, t0 + DISCORD_CACHE_MS);
    expect(ok).toHaveBeenCalledTimes(2);
    const falla = vi.fn(async () => new Response('', { status: 500 }));
    await cachedDiscordCounts('def', falla, t0);
    await new Promise((r) => setTimeout(r, 0));
    await cachedDiscordCounts('def', falla, t0 + 59_999);
    expect(falla).toHaveBeenCalledTimes(1);
    await cachedDiscordCounts('def', falla, t0 + 60_000);
    expect(falla).toHaveBeenCalledTimes(2);
  });
});

describe('caché', () => {
  it('pasados 20 s vuelve a consultar; mientras tanto, la misma promesa', async () => {
    db(ROWS);
    const { udp, calls } = servers();
    const sb = (await import('../../src/lib/supabase')).anonClient((await import('../../src/env')).loadConfig(testEnv()));
    const t0 = 1_000_000;
    const a = cachedServersStatus(sb, udp, t0);
    expect(cachedServersStatus(sb, udp, t0 + STATUS_CACHE_MS - 1)).toBe(a);
    await a;
    const b = cachedServersStatus(sb, udp, t0 + STATUS_CACHE_MS);
    expect(b).not.toBe(a);
    await b;
    expect(calls).toHaveLength(4);
  });

  it('jugadores sin bots y nunca negativos', async () => {
    db([ROWS[0]!]);
    const { udp } = fakeUdp(() => withPlayers(1, 2));
    const sb = (await import('../../src/lib/supabase')).anonClient((await import('../../src/env')).loadConfig(testEnv()));
    expect((await serversStatus(sb, udp)).servers[0]!.players).toBe(0);
  });
});

describe('UDP de Node', () => {
  it('devuelve la respuesta, y rechaza si no llega a tiempo', async () => {
    const { createSocket } = await import('node:dgram');
    const { nodeUdp } = await import('../../src/lib/udp-node');
    // Un "servidor" local que pide desafío atado al puerto de origen (como el real), y otro que nunca responde.
    const desafios = new Map<number, number>();
    const responde = createSocket('udp4').on('message', (m, r) => {
      if (m[4] !== 0x54) return;
      const enviado = m.length > infoRequest().length ? m[m.length - 4] : undefined;
      if (enviado !== undefined && enviado === desafios.get(r.port)) return responde.send(V34, r.port, r.address);
      const nuevo = (desafios.get(r.port) ?? 0) + 1;
      desafios.set(r.port, nuevo);
      responde.send(Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0x41, nuevo, 0, 0, 0]), r.port, r.address);
    });
    const mudo = createSocket('udp4');
    await Promise.all([new Promise<void>((ok) => responde.bind(0, '127.0.0.1', ok)), new Promise<void>((ok) => mudo.bind(0, '127.0.0.1', ok))]);
    try {
      expect((await a2sInfo(nodeUdp, '127.0.0.1', responde.address().port, 1000)).map).toBe('de_dust2');
      await expect(nodeUdp('127.0.0.1', mudo.address().port, 200, (s) => s.send(infoRequest()))).rejects.toThrow('sin respuesta');
    } finally {
      responde.close();
      mudo.close();
    }
  });
});
