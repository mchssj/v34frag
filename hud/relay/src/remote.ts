// Modo VPS: la configuración sale de la base (hud_relay_config, replanteo 36) con la clave anon y el token del relay,
// como el Worker de demos. Ver docs/bitacora/2026-10-29-hud-relay-vps.

import { createHash } from "node:crypto";

export interface RemoteServer {
  id: string;
  name: string;
  port: number;
  key: string;
  /** host:puerto de la SourceTV, para el connect del streamer. */
  tvAddress: string;
}

export interface RemoteStreamer {
  userId: string;
  alias: string;
  tokenHash: string;
}

export interface RemoteConfig {
  servers: RemoteServer[];
  streamers: RemoteStreamer[];
}

export interface RemoteOptions {
  apiUrl: string;
  anonKey: string;
  relayToken: string;
}

/** Quién tiene el HUD abierto en qué servidor, para "Transmitiendo" en la web. */
export interface Session {
  userId: string;
  serverId: string;
}

export const sha256 = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const str = (v: unknown): v is string => typeof v === "string" && v !== "";

/** Valida la respuesta de la base. Lo que venga mal formado se descarta (no tira abajo al relay). */
export function parseRemote(data: unknown): RemoteConfig {
  const d = isObj(data) ? data : {};
  const servers: RemoteServer[] = [];
  for (const s of Array.isArray(d.servers) ? d.servers : []) {
    if (!isObj(s) || !str(s.id) || !str(s.key) || !Number.isInteger(s.port)) continue;
    const port = s.port as number;
    if (port < 1 || port > 65535 || servers.some((x) => x.port === port)) continue;
    servers.push({ id: s.id, name: str(s.name) ? s.name : s.id, port, key: s.key, tvAddress: str(s.tv_address) ? s.tv_address : "" });
  }
  const streamers: RemoteStreamer[] = [];
  for (const s of Array.isArray(d.streamers) ? d.streamers : []) {
    if (!isObj(s) || !str(s.user_id) || !str(s.token_hash)) continue;
    streamers.push({ userId: s.user_id, alias: str(s.alias) ? s.alias : "", tokenHash: s.token_hash });
  }
  return { servers, streamers };
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Pide la configuración e informa las sesiones y el último paquete de cada servidor (seen: id → fecha ISO).
 * Tira un error con el mensaje de la base si el token es malo o la base no responde.
 */
export async function fetchRemote(
  opts: RemoteOptions,
  sessions: Session[],
  seen: Record<string, string>,
  fetchImpl: Fetch = fetch,
): Promise<RemoteConfig> {
  const res = await fetchImpl(`${opts.apiUrl.replace(/\/+$/, "")}/rest/v1/rpc/hud_relay_config`, {
    method: "POST",
    headers: { apikey: opts.anonKey, authorization: `Bearer ${opts.anonKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      p_token: opts.relayToken,
      p_sessions: sessions.map((s) => ({ user_id: s.userId, server_id: s.serverId })),
      p_seen: seen,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = isObj(body) && str(body.message) ? body.message : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return parseRemote(body);
}
