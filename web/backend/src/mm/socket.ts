import type { WSContext } from 'hono/ws';
import postgres from 'postgres';

// Socket del matchmaking, solo en Node (plan, sección 5). El socket solo avisa: cada evento lleva el tipo y la sala, y el
// navegador vuelve a pedir el estado por REST. Lo que hay en memoria es el índice de quién está conectado.

const MAX_PER_USER = 5;
const MAX_TOTAL = 2000;
const MAX_MESSAGE = 4096;
const AUTH_TIMEOUT_MS = 5_000;

// d (replanteo 59): lo que cambió, para que la web no tenga que pedir el estado (tamaños de la cola, quién aceptó…).
export type MmEvent = { t: string; lobby?: string | null; users?: string[]; d?: unknown };
type Verify = (token: string) => Promise<{ id: string; exp?: number } | null>;
type Conn = { ws: WSContext; user: string | null; timer: ReturnType<typeof setTimeout> | null };

// Presencia en la cola (replanteo 63, plan docs/bitacora/2026-11-02-mm-salir-cola-al-cerrar): quien se queda sin
// conexiones queda en pausa al instante (no se le arma sala) y sale de la cola si no vuelve en MM_GRACE_S.
export const MM_GRACE_S = 10;
/** Sin socket, la web pide el estado cada 5 s: un pedido cuenta como presencia durante este tiempo. */
export const MM_POLL_PRESENCE_MS = 15_000;
export type MmPresence = {
  away(user: string): Promise<unknown>;
  back(user: string): Promise<unknown>;
  dropAway(user: string, graceS: number): Promise<unknown>;
  sweep(online: string[], graceS: number): Promise<unknown>;
};

export function createMmHub(verify: Verify, presence?: MmPresence, now: () => number = Date.now) {
  const conns = new Set<Conn>();
  const byUser = new Map<string, Set<Conn>>();
  const graceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const lastPoll = new Map<string, number>();
  let stopping = false;

  const report = (what: string) => (e: unknown) => console.error(`mm: presencia (${what}): ${(e as Error).message}`);
  const polledRecently = (user: string) => now() - (lastPoll.get(user) ?? -Infinity) < MM_POLL_PRESENCE_MS;
  const present = (user: string) => {
    const t = graceTimers.get(user);
    if (t) clearTimeout(t);
    graceTimers.delete(user);
    void presence?.back(user).catch(report('back'));
  };
  const absent = (user: string) => {
    // Un despliegue corta a todos: eso no es irse.
    if (!presence || stopping || polledRecently(user)) return;
    void presence.away(user).catch(report('away'));
    const old = graceTimers.get(user);
    if (old) clearTimeout(old);
    graceTimers.set(
      user,
      setTimeout(() => {
        graceTimers.delete(user);
        if (byUser.has(user) || polledRecently(user)) return;
        void presence.dropAway(user, MM_GRACE_S).catch(report('drop'));
      }, MM_GRACE_S * 1000),
    );
  };
  const online = () => {
    for (const [u, at] of lastPoll) if (now() - at >= MM_POLL_PRESENCE_MS) lastPoll.delete(u);
    return [...new Set([...byUser.keys(), ...lastPoll.keys()])];
  };

  const detach = (conn: Conn) => {
    if (conn.timer) clearTimeout(conn.timer);
    conns.delete(conn);
    if (conn.user) {
      const set = byUser.get(conn.user);
      set?.delete(conn);
      if (set?.size === 0) {
        byUser.delete(conn.user);
        absent(conn.user);
      }
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
      const first = set.size === 0;
      set.add(conn);
      byUser.set(user.id, set);
      if (first) present(user.id);
      conn.ws.send(JSON.stringify({ t: 'ready' }));
    },

    closed: detach,

    /** `users` vacío = a todos los autenticados. */
    dispatch({ t, lobby, users, d }: MmEvent) {
      const data = JSON.stringify(d === undefined || d === null ? { t, lobby } : { t, lobby, d });
      const targets = users?.length ? users.flatMap((u) => [...(byUser.get(u) ?? [])]) : [...conns].filter((c) => c.user);
      for (const conn of targets) conn.ws.send(data);
    },

    /** Despliegue: el cliente reconecta con una espera aleatoria. Estos cortes no sacan a nadie de la cola. */
    shutdown() {
      stopping = true;
      for (const t of graceTimers.values()) clearTimeout(t);
      graceTimers.clear();
      for (const conn of [...conns]) close(conn, 1012, 'Reinicio del servicio');
    },

    /** La web sin socket pide el estado liviano: también cuenta como conectado. */
    polled(user: string) {
      const before = byUser.has(user) || polledRecently(user);
      lastPoll.set(user, now());
      if (!before) present(user);
    },

    /** Las cuentas conectadas (socket o pedidos recientes), para la red de seguridad. */
    online,

    /** Red de seguridad: pausa a los de la cola sin conexión y saca a los que pasaron la gracia. */
    async sweep() {
      if (!presence || stopping) return;
      await presence.sweep(online(), MM_GRACE_S).catch(report('sweep'));
    },

    size: () => conns.size,
  };
}

/** Conexión directa con el rol mm_listener (MM_LISTEN_URL): el LISTEN y las funciones de presencia del replanteo 63. */
export function mmSql(url: string) {
  return postgres(url, { max: 1, onclose: () => console.error('mm: se cortó el LISTEN') });
}

/** La presencia en la base. Los ids vienen de tokens ya verificados. */
export function sqlPresence(sql: postgres.Sql): MmPresence {
  return {
    away: (u) => sql`select public.mm_queue_away(${u}::uuid)`,
    back: (u) => sql`select public.mm_queue_back(${u}::uuid)`,
    dropAway: (u, g) => sql`select public.mm_queue_drop_away(${u}::uuid, ${g}::int)`,
    sweep: (online, g) => sql`select public.mm_queue_presence_sweep(${'{' + online.join(',') + '}'}::uuid[], ${g}::int)`,
  };
}

/** Escucha los NOTIFY de la base. Si la conexión se recupera pudo perderse algo: se pide resincronizar a todos. */
export async function listenMm(sql: postgres.Sql, hub: ReturnType<typeof createMmHub>) {
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
