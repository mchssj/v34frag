import { mustHave } from '../lib/db';
import type { Db } from '../lib/supabase';

// Relay del HUD (plan docs/bitacora/2026-10-29-hud-relay-vps): filas de la base a la respuesta de la API.

type HudRow = {
  connect_address: string | null; tv_port: number | null; hud_port: number | null; hud_enabled: boolean | null;
  hud_key: string | null; hud_seen_at: string | null; hud_streaming: unknown;
};

/** Host del relay para csstv_hud_host: el de HUD_BASE_URL (null si no está configurada). */
export const hudHost = (base: string | undefined) => (base ? new URL(base).hostname : null);

/** Las líneas del cfg del HUD de un servidor. Sin host, la del host queda para completar a mano. */
export function hudCfg(host: string | null, port: number, key: string) {
  return [
    'csstv_hud "1"',
    `csstv_hud_host "${host ?? 'COMPLETAR'}"`,
    `csstv_hud_port "${port}"`,
    `csstv_hud_key "${key}"`,
  ].join('\n');
}

export function toServerHud(r: HudRow, host: string | null, now = Date.now()) {
  const streaming = Array.isArray(r.hud_streaming) ? (r.hud_streaming as { user_id: string; alias: string }[]) : [];
  const port = r.hud_port ?? null;
  const key = r.hud_key ?? null;
  const seen = r.hud_seen_at ?? null;
  return {
    port,
    enabled: !!r.hud_enabled,
    key,
    can_enable: !!r.connect_address && r.tv_port != null,
    last_packet_at: seen,
    receiving: !!seen && now - Date.parse(seen) < 60_000,
    streaming: streaming.map((s) => ({ id: s.user_id, alias: s.alias })),
    cfg: port !== null && key ? hudCfg(host, port, key) : null,
  };
}

export const STREAMER_FIELDS = 'user_id, alias, granted_at, granted_by_alias, revoked_at, active, has_link, token_created_at';

export type StreamerRow = {
  user_id: string | null; alias: string | null; granted_at: string | null; granted_by_alias: string | null;
  revoked_at: string | null; active: boolean | null; has_link: boolean | null; token_created_at: string | null;
};

export const toStreamer = (r: StreamerRow) => ({
  user: { id: r.user_id!, alias: r.alias ?? '' },
  active: !!r.active,
  granted_at: r.granted_at!,
  granted_by: r.granted_by_alias,
  revoked_at: r.revoked_at,
  has_link: !!r.has_link,
  link_created_at: r.token_created_at,
});

/** La marca de streamer de cada cuenta (hud_streamer_list: la propia, o todas para un admin). */
export async function streamersOf(sb: Db, users: string[]) {
  if (!users.length) return new Map<string, StreamerRow>();
  const rows = mustHave(await sb.from('hud_streamer_list').select(STREAMER_FIELDS).in('user_id', users)) as StreamerRow[];
  return new Map(rows.map((r) => [r.user_id!, r]));
}
