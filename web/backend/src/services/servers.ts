import { a2sInfo, parseAddress, type UdpExchange } from '../lib/a2s';
import type { Db } from '../lib/supabase';

export const STATUS_TIMEOUT_MS = 1500;
export const STATUS_CACHE_MS = 20_000;

export type ServerStatusItem = {
  id: string;
  name: string;
  address: string | null;
  online: boolean;
  map: string | null;
  players: number | null;
  max_players: number | null;
  bots: number | null;
};
export type ServersStatus = {
  servers: ServerStatusItem[];
  totals: { servers: number; online: number; players: number };
  checked_at: string;
};

type Row = { id: string | null; name: string | null; connect_address: string | null };

/** Los servidores activos con licencia vigente, consultados a la vez. Uno que no responde no frena a los demás. */
export async function serversStatus(sb: Db, udp: UdpExchange, timeoutMs = STATUS_TIMEOUT_MS): Promise<ServersStatus> {
  const { data, error } = await sb.from('game_servers_public').select('id, name, connect_address').order('name');
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  const servers = await Promise.all(
    rows.map(async (r): Promise<ServerStatusItem> => {
      const base = { id: r.id!, name: r.name ?? '', address: r.connect_address };
      const off = { ...base, online: false, map: null, players: null, max_players: null, bots: null };
      const addr = parseAddress(r.connect_address);
      if (!addr) return off;
      try {
        const info = await a2sInfo(udp, addr.host, addr.port, timeoutMs);
        // Los bots (SourceTV entre ellos) no son jugadores.
        return { ...base, online: true, map: info.map, players: Math.max(0, info.players - info.bots), max_players: info.max_players, bots: info.bots };
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
