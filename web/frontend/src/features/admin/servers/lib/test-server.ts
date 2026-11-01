import type { AdminServer } from "../types"

/** Servidor de ejemplo para las pruebas de admin/servers. */
export const server = (o: Partial<AdminServer> = {}): AdminServer => ({
  id: "s1",
  name: "CMLeague #1",
  active: true,
  license_state: "ok",
  license_expires_at: null,
  allowed_ip: null,
  online: true,
  last_seen_at: "2026-10-28T11:57:00Z",
  last_ip: null,
  plugin_version: "2.5.0",
  connect_address: null,
  panel_server_id: null,
  mode: "mix",
  region: null,
  tv_port: null,
  matches: 10,
  last_match_at: null,
  created_at: "2026-10-01T00:00:00Z",
  hud: {
    port: null,
    enabled: false,
    key: null,
    can_enable: false,
    last_packet_at: null,
    receiving: false,
    streaming: [],
    cfg: null,
  },
  ...o,
})
