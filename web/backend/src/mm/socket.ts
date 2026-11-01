import type { WSContext } from 'hono/ws';
import postgres from 'postgres';

// Socket del matchmaking, solo en Node (plan, sección 5). El socket solo avisa: cada evento lleva el tipo y la sala, y el
// navegador vuelve a pedir el estado por REST. Lo que hay en memoria es el índice de quién está conectado.

const MAX_PER_USER = 5;
const MAX_TOTAL = 2000;
const MAX_MESSAGE = 4096;
const AUTH_TIMEOUT_MS = 5_000;

export type MmEvent = { t: string; lobby?: string | null; users?: string[] };
type Verify = (token: string) => Promise<{ id: string; exp?: number } | null>;
type Conn = { ws: WSContext; user: string | null; timer: ReturnType<typeof setTimeout> | null };

export function createMmHub(verify: Verify) {
  const conns = new Set<Conn>();
  const byUser = new Map<string, Set<Conn>>();

  const detach = (conn: Conn) => {
    if (conn.timer) clearTimeout(conn.timer);
    conns.delete(conn);
    if (conn.user) {
      const set = byUser.get(conn.user);
      set?.delete(conn);
      if (set?.size === 0) byUser.delete(conn.user);
    }
  };
  const close = (conn: Conn, code: number, reason: string) => {
    detach(conn);
    conn.ws.close(code, reason);
  };

  return {
    open(ws: WSContext): Conn | null {
      if (conns.size >= MAX_TOTAL) {
        ws.close(1013, 'Demasiadas conexiones');
        return null;
      }
      const conn: Conn = { ws, user: null, timer: null };
      conn.timer = setTimeout(() => close(conn, 4001, 'Falta auth'), AUTH_TIMEOUT_MS);
      conns.add(conn);
      return conn;
    },

    async message(conn: Conn, raw: string) {
      if (raw.length > MAX_MESSAGE) return close(conn, 1009, 'Mensaje muy largo');
      let msg: { t?: string; token?: string };
      try {
        msg = JSON.parse(raw) as { t?: string; token?: string };
      } catch {
        return close(conn, 1003, 'JSON inválido');
      }
      if (msg.t !== 'auth' || !msg.token) return;
      const user = await verify(msg.token).catch(() => null);
      if (!user) return close(conn, 4001, 'Token inválido');
      const set = byUser.get(user.id) ?? new Set<Conn>();
      if (!set.has(conn) && set.size >= MAX_PER_USER) return close(conn, 4002, 'Demasiadas conexiones de esta cuenta');
      // El cliente manda un auth nuevo al renovar el token; si no lo hace, se corta al vencer.
      if (conn.timer) clearTimeout(conn.timer);
      conn.timer = user.exp ? setTimeout(() => close(conn, 4001, 'Token vencido'), Math.max(0, user.exp * 1000 - Date.now())) : null;
      conn.user = user.id;
      set.add(conn);
      byUser.set(user.id, set);
      conn.ws.send(JSON.stringify({ t: 'ready' }));
    },

    closed: detach,

    /** `users` vacío = a todos los autenticados. */
    dispatch({ t, lobby, users }: MmEvent) {
      const data = JSON.stringify({ t, lobby });
      const targets = users?.length ? users.flatMap((u) => [...(byUser.get(u) ?? [])]) : [...conns].filter((c) => c.user);
      for (const conn of targets) conn.ws.send(data);
    },

    /** Despliegue: el cliente reconecta con una espera aleatoria. */
    shutdown() {
      for (const conn of [...conns]) close(conn, 1012, 'Reinicio del servicio');
    },

    size: () => conns.size,
  };
}

/** Escucha los NOTIFY de la base. Si la conexión se recupera pudo perderse algo: se pide resincronizar a todos. */
export async function listenMm(url: string, hub: ReturnType<typeof createMmHub>) {
  const sql = postgres(url, { max: 1, onclose: () => console.error('mm: se cortó el LISTEN') });
  await sql.listen(
    'mm',
    (payload) => {
      try {
        hub.dispatch(JSON.parse(payload) as MmEvent);
      } catch (e) {
        console.error(`mm: evento inválido: ${(e as Error).message}`);
      }
    },
    () => hub.dispatch({ t: 'resync' })
  );
  return () => sql.end({ timeout: 2 });
}
