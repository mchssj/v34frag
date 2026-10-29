// Modo VPS (docs/bitacora/2026-10-29-hud-relay-vps): un relay para todos los servidores. Cada servidor con HUD activo
// tiene su puerto UDP y su canal; cada streamer entra con su token y elige qué servidor transmite. La configuración
// sale de la base cada 30 segundos (remote.ts): abrir y cerrar puertos, claves nuevas y streamers revocados se aplican
// sin reiniciar.

import { Channel, emptyState } from "./channel.ts";
import { type Control, type ControlStore, mergeControl } from "./control.ts";
import type { RemoteConfig, RemoteServer, RemoteStreamer, Session } from "./remote.ts";
import { sha256 } from "./remote.ts";
import type { Client, HttpServer } from "./server.ts";
import type { GameState } from "./state.ts";

export interface Socket {
  close(): void;
}

export interface HubDeps {
  /** Abre el puerto UDP de un servidor. Tira un error si no se puede (puerto ocupado). */
  bind(port: number, onMessage: (text: string) => void): Promise<Socket>;
  fetchRemote(sessions: Session[], seen: Record<string, string>): Promise<RemoteConfig>;
  controls: ControlStore;
  /** Retraso fijo en segundos, o null para el tv_delay de cada servidor. */
  delay: number | null;
  log(msg: string): void;
  now?: () => number;
}

interface Slot {
  server: RemoteServer;
  channel: Channel;
  socket: Socket;
}

const RECEIVING_MS = 15000;

export class Hub {
  private readonly deps: HubDeps;
  private readonly slots = new Map<string, Slot>();
  private readonly byHash = new Map<string, RemoteStreamer>();
  private readonly byUser = new Map<string, RemoteStreamer>();
  private readonly reported = new Map<string, number>();
  http: HttpServer | null = null;
  loaded = false;

  constructor(deps: HubDeps) {
    this.deps = deps;
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  /** El streamer del token, o null (404). Sin token no hay nada en el modo VPS. */
  viewer(token: string | null): string | null {
    return token ? (this.byHash.get(sha256(token))?.userId ?? null) : null;
  }

  /** El servidor que ve el streamer: el que eligió si sigue activo; si hay uno solo, ese. */
  selected(viewer: string): string | null {
    const chosen = this.deps.controls.get(viewer).server;
    if (chosen && this.slots.has(chosen)) return chosen;
    return this.slots.size === 1 ? [...this.slots.keys()][0]! : null;
  }

  private control(viewer: string): Control {
    return { ...this.deps.controls.get(viewer), server: this.selected(viewer) };
  }

  stateFor(viewer: string): GameState {
    const id = this.selected(viewer);
    return id ? this.slots.get(id)!.channel.snapshot() : emptyState();
  }

  initial(viewer: string): { event: string; data: unknown }[] {
    return [
      { event: "state", data: this.stateFor(viewer) },
      { event: "control", data: this.control(viewer) },
    ];
  }

  onControl(viewer: string, body: unknown): void {
    const before = this.selected(viewer);
    const next = mergeControl(this.deps.controls.get(viewer), body);
    // Solo se guarda un servidor que existe.
    if (next.server !== null && !this.slots.has(next.server)) next.server = this.deps.controls.get(viewer).server;
    this.deps.controls.set(viewer, next);
    const mine = (c: Client) => c.viewer === viewer;
    this.http?.broadcast("control", this.control(viewer), mine);
    if (this.selected(viewer) !== before) this.http?.broadcast("state", this.stateFor(viewer), mine);
  }

  /** Quién tiene el HUD abierto (OBS) en qué servidor. */
  sessions(): Session[] {
    const seen = new Set<string>();
    const out: Session[] = [];
    for (const c of this.http?.connections() ?? []) {
      const serverId = c.page === "hud" ? this.selected(c.viewer) : null;
      if (!serverId || seen.has(`${c.viewer}/${serverId}`)) continue;
      seen.add(`${c.viewer}/${serverId}`);
      out.push({ userId: c.viewer, serverId });
    }
    return out;
  }

  status(viewer: string, extra: Record<string, unknown> = {}): unknown {
    const now = this.now();
    const sel = this.selected(viewer);
    const watchers = new Map<string, Set<string>>();
    for (const s of this.sessions()) {
      if (s.userId === viewer) continue;
      const alias = this.byUser.get(s.userId)?.alias ?? "";
      watchers.set(s.serverId, (watchers.get(s.serverId) ?? new Set()).add(alias));
    }
    const servers = [...this.slots.values()]
      .sort((a, b) => a.server.name.localeCompare(b.server.name))
      .map(({ server, channel }) => ({
        id: server.id,
        name: server.name,
        tvAddress: server.tvAddress,
        lastPacketMsAgo: channel.lastPacketAt ? now - channel.lastPacketAt : null,
        receiving: channel.lastPacketAt > 0 && now - channel.lastPacketAt < RECEIVING_MS,
        streaming: [...(watchers.get(server.id) ?? [])],
      }));
    const hudOpen = (this.http?.connections() ?? []).filter((c) => c.viewer === viewer && c.page === "hud").length;
    return {
      mode: "vps",
      alias: this.byUser.get(viewer)?.alias ?? "",
      selected: sel,
      delaySeconds: sel ? this.slots.get(sel)!.channel.delaySeconds() : null,
      servers,
      hudOpen,
      ...extra,
    };
  }

  /** Aplica los paquetes que cumplieron el retraso y se los manda a quien mira cada servidor. */
  tick(): void {
    const now = this.now();
    for (const [id, slot] of this.slots) {
      if (!slot.channel.release(now)) continue;
      const state = slot.channel.snapshot();
      this.http?.broadcast("state", state, (c) => this.selected(c.viewer) === id);
    }
  }

  /** Pide la configuración a la base (informando sesiones y paquetes) y la aplica. */
  async refresh(): Promise<void> {
    const seen: Record<string, string> = {};
    for (const [id, slot] of this.slots) {
      const at = slot.channel.lastPacketAt;
      if (at > (this.reported.get(id) ?? 0)) seen[id] = new Date(at).toISOString();
    }
    const cfg = await this.deps.fetchRemote(this.sessions(), seen);
    for (const [id, iso] of Object.entries(seen)) this.reported.set(id, Date.parse(iso));
    await this.apply(cfg);
  }

  async apply(cfg: RemoteConfig): Promise<void> {
    const viewersBefore = new Map((this.http?.connections() ?? []).map((c) => [c.viewer, this.selected(c.viewer)]));

    this.byHash.clear();
    this.byUser.clear();
    for (const s of cfg.streamers) {
      this.byHash.set(s.tokenHash, s);
      this.byUser.set(s.userId, s);
    }
    for (const viewer of viewersBefore.keys()) {
      if (!this.byUser.has(viewer)) {
        this.http?.disconnect(viewer);
        this.deps.log(`Streamer sin acceso (le quitaron la marca o generó otro link): se cortó su conexión.`);
      }
    }

    const wanted = new Map(cfg.servers.map((s) => [s.id, s]));
    for (const [id, slot] of this.slots) {
      const s = wanted.get(id);
      if (s && s.port === slot.server.port) {
        if (s.key !== slot.channel.key) this.deps.log(`${s.name}: clave nueva.`);
        slot.channel.key = s.key;
        slot.server = s;
        continue;
      }
      slot.socket.close();
      this.slots.delete(id);
      this.reported.delete(id);
      this.deps.log(`${slot.server.name}: se cerró el puerto UDP ${slot.server.port}.`);
    }
    for (const s of wanted.values()) {
      if (this.slots.has(s.id)) continue;
      const channel = new Channel(s.key, this.deps.delay);
      try {
        const socket = await this.deps.bind(s.port, (text) => channel.handle(text, this.now()));
        this.slots.set(s.id, { server: s, channel, socket });
        this.deps.log(`${s.name}: escuchando en UDP ${s.port}.`);
      } catch (e) {
        this.deps.log(`${s.name}: no se pudo abrir el puerto UDP ${s.port}: ${(e as Error).message}`);
      }
    }
    this.loaded = true;

    // Al que le cambió el servidor (se apagó, o quedó uno solo), el estado nuevo y su control.
    for (const [viewer, before] of viewersBefore) {
      if (!this.byUser.has(viewer) || this.selected(viewer) === before) continue;
      const mine = (c: Client) => c.viewer === viewer;
      this.http?.broadcast("state", this.stateFor(viewer), mine);
      this.http?.broadcast("control", this.control(viewer), mine);
    }
  }

  /** Una línea para el log: servidores, paquetes por segundo y HUD abiertos. */
  summary(seconds: number): string {
    const parts = [...this.slots.values()].map(({ server, channel }) => {
      const rate = (channel.receivedWindow / seconds).toFixed(1);
      let s = `${server.name} ${rate}/s`;
      if (channel.badKey) s += ` (${channel.badKey} con clave incorrecta)`;
      channel.receivedWindow = 0;
      channel.badKey = 0;
      channel.badFormat = 0;
      return s;
    });
    const huds = (this.http?.connections() ?? []).filter((c) => c.page === "hud").length;
    return `${parts.length ? parts.join(" · ") : "ningún servidor con HUD activo"} · HUD abiertos: ${huds}`;
  }

  close(): void {
    for (const slot of this.slots.values()) slot.socket.close();
    this.slots.clear();
  }
}
