import { a2sInfo, parseAddress, type UdpExchange } from '../lib/a2s';
import type { Db } from '../lib/supabase';
import type { SERVER_MODES } from '../schemas/servers';

export const STATUS_TIMEOUT_MS = 1500;
export const STATUS_CACHE_MS = 20_000;

export type ServerStatusItem = {
  id: string;
  name: string;
  address: string | null;
  mode: (typeof SERVER_MODES)[number] | null;
  region: string | null;
  online: boolean;
  ping_ms: number | null;
  map: string | null;
  players: number | null;
  max_players: number | null;
  bots: number | null;
  live_matches: number;
};
export type ServersStatus = {
  servers: ServerStatusItem[];
  totals: { servers: number; online: number; players: number; live_matches: number };
  checked_at: string;
};

type Row = { id: string | null; name: string | null; connect_address: string | null; mode: string | null; region: string | null };

/**
 * Los servidores activos con licencia vigente, consultados a la vez. Uno que no responde no frena a los demás.
 * live_matches: mixes con foto en los últimos 10 minutos (los mismos que GET /api/v1/mixes/live muestra en curso).
 */
export async function serversStatus(sb: Db, udp: UdpExchange, timeoutMs = STATUS_TIMEOUT_MS): Promise<ServersStatus> {
  const [srv, live] = await Promise.all([
    sb.from('game_servers_public').select('id, name, connect_address, mode, region').order('name'),
    sb.from('live_match_list').select('server_id').eq('stale', false),
  ]);
  if (srv.error) throw srv.error;
  if (live.error) throw live.error;
  const rows = (srv.data ?? []) as Row[];
  const liveBy = new Map<string, number>();
  for (const l of live.data ?? []) if (l.server_id) liveBy.set(l.server_id, (liveBy.get(l.server_id) ?? 0) + 1);
  const servers = await Promise.all(
    rows.map(async (r): Promise<ServerStatusItem> => {
      const base = {
        id: r.id!,
        name: r.name ?? '',
        address: r.connect_address,
        mode: r.mode as ServerStatusItem['mode'],
        region: r.region,
        live_matches: liveBy.get(r.id!) ?? 0,
      };
      const off = { ...base, online: false, ping_ms: null, map: null, players: null, max_players: null, bots: null };
      const addr = parseAddress(r.connect_address);
      if (!addr) return off;
      try {
        const info = await a2sInfo(udp, addr.host, addr.port, timeoutMs);
        // Los bots (SourceTV entre ellos) no son jugadores.
        return {
          ...base,
          online: true,
          ping_ms: info.ping_ms,
          map: info.map,
          players: Math.max(0, info.players - info.bots),
          max_players: info.max_players,
          bots: info.bots,
        };
      } catch {
        return off;
      }
    }),
  );
  return {
    servers,
    totals: {
      servers: servers.length,
      online: servers.filter((s) => s.online).length,
      players: servers.reduce((n, s) => n + (s.players ?? 0), 0),
      live_matches: servers.reduce((n, s) => n + s.live_matches, 0),
    },
    checked_at: new Date().toISOString(),
  };
}

/**
 * Caché de 20 s: la página puede consultar seguido sin que cada visita dispare consultas UDP. Mientras una
 * consulta está en curso, los pedidos que llegan esperan esa misma. Una por cada envío UDP (una por app).
 */
const cache = new WeakMap<UdpExchange, { at: number; value: Promise<ServersStatus> }>();

export function cachedServersStatus(sb: Db, udp: UdpExchange, now = Date.now()): Promise<ServersStatus> {
  const hit = cache.get(udp);
  if (hit && now - hit.at < STATUS_CACHE_MS) return hit.value;
  const value = serversStatus(sb, udp);
  cache.set(udp, { at: now, value });
  // Si falla (la base no respondió), no se guarda: el próximo pedido vuelve a probar.
  value.catch(() => {
    if (cache.get(udp)?.value === value) cache.delete(udp);
  });
  return value;
}
