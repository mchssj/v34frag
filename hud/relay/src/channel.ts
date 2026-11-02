// Un canal por servidor de juego: su clave, la historia de sus paquetes y una vía por cada retraso que alguien mira.
// Así los paquetes de un servidor nunca descartan ni pisan los de otro (cada uno tiene su propia secuencia), y dos
// streamers del mismo servidor pueden ir con retrasos distintos (docs/bitacora/2026-11-01-hud-retraso-por-servidor).

import { DelayQueue } from "./delay.ts";
import { type Packet, parsePacket } from "./protocol.ts";
import { GameModel, type GameState } from "./state.ts";

/** Lo que elige el streamer: el tv_delay del servidor, en vivo (0 s) o un retraso fijo de 1 a 300 s. */
export type DelayMode = "tv" | "live" | number;

/** Una vía: "tv" sigue el tv_delay; un número, ese retraso fijo en segundos (0 = en vivo). */
export type LaneKey = "tv" | number;

export const MAX_DELAY = 300;
/** Historia de paquetes: el retraso más largo más un margen para que entre una foto completa (llega cada 3 s). */
const HISTORY_MS = (MAX_DELAY + 15) * 1000;
/** Una vía que nadie mira en este tiempo se borra (la "tv" nunca). */
export const LANE_IDLE_MS = 60_000;

interface Lane {
  queue: DelayQueue;
  model: GameModel;
  usedAt: number;
}

export class Channel {
  key: string;
  private readonly fixedDelay: number | null;
  /** Solo para la secuencia: descarta lo viejo una vez, antes de repartirlo a las vías. */
  private readonly gate = new DelayQueue();
  private readonly history: { at: number; packet: Packet }[] = [];
  private readonly lanes = new Map<LaneKey, Lane>();
  tvDelay = 0;
  lastPacketAt = 0;
  received = 0;
  receivedWindow = 0;
  badKey = 0;
  badFormat = 0;

  /** fixedDelay: segundos fijos para todos (el "delay" de la configuración del relay), o null para que elija cada uno. */
  constructor(key: string, fixedDelay: number | null) {
    this.key = key;
    this.fixedDelay = fixedDelay;
    this.lanes.set("tv", { queue: new DelayQueue(), model: new GameModel(), usedAt: 0 });
  }

  /** Si el retraso lo fija la configuración del relay: entonces todos van por la vía "tv" con ese valor. */
  get locked(): boolean {
    return this.fixedDelay !== null;
  }

  laneKey(mode: DelayMode = "tv"): LaneKey {
    if (this.fixedDelay !== null || mode === "tv") return "tv";
    return mode === "live" ? 0 : mode;
  }

  private laneDelay(key: LaneKey): number {
    return key === "tv" ? (this.fixedDelay ?? this.tvDelay) : key;
  }

  delaySeconds(mode: DelayMode = "tv"): number {
    return this.laneDelay(this.laneKey(mode));
  }

  /** La vía de un modo; si no existe, se arma con la historia: lo que ya cumplió el retraso se aplica, el resto se encola. */
  private lane(key: LaneKey, now: number): Lane {
    let lane = this.lanes.get(key);
    if (!lane) {
      lane = { queue: new DelayQueue(), model: new GameModel(), usedAt: now };
      const ms = this.laneDelay(key) * 1000;
      for (const h of this.history) {
        if (h.at + ms <= now) lane.model.apply(h.packet, h.at + ms);
        else lane.queue.push(h.packet, h.at, this.laneDelay(key));
      }
      this.lanes.set(key, lane);
    }
    lane.usedAt = Math.max(lane.usedAt, now);
    return lane;
  }

  /** Un paquete UDP del servidor. Devuelve si se aceptó. */
  handle(text: string, now: number): boolean {
    const result = parsePacket(text, this.key);
    if (!result.ok) {
      if (result.reason === "key") this.badKey++;
      else this.badFormat++;
      return false;
    }
    const packet = result.packet;
    if (!this.gate.push(packet, now, 0)) return false;
    this.gate.release(now);
    if (packet.type === "F") this.tvDelay = packet.tvDelay;
    this.history.push({ at: now, packet });
    let old = 0;
    while (old < this.history.length && this.history[old]!.at < now - HISTORY_MS) old++;
    if (old) this.history.splice(0, old);
    for (const [key, lane] of this.lanes) lane.queue.push(packet, now, this.laneDelay(key));
    this.received++;
    this.receivedWindow++;
    this.lastPacketAt = now;
    return true;
  }

  /** Aplica los paquetes que ya cumplieron el retraso. Devuelve las vías que cambiaron. */
  release(now: number): Set<LaneKey> {
    const changed = new Set<LaneKey>();
    for (const [key, lane] of this.lanes) {
      const out = lane.queue.release(now);
      for (const p of out) lane.model.apply(p, now);
      if (out.length) changed.add(key);
    }
    return changed;
  }

  /** Marca la vía de un modo como mirada (se llama con cada HUD conectado) para que no se borre. */
  touch(mode: DelayMode, now: number): void {
    this.lane(this.laneKey(mode), now);
  }

  /** Borra las vías que nadie mira hace LANE_IDLE_MS. */
  prune(now: number): void {
    for (const [key, lane] of this.lanes) if (key !== "tv" && now - lane.usedAt > LANE_IDLE_MS) this.lanes.delete(key);
  }

  get laneCount(): number {
    return this.lanes.size;
  }

  get queued(): number {
    return this.lanes.get("tv")!.queue.size;
  }

  /** El estado que ve quien usa ese modo. Sin "now", solo vale para la vía "tv" (que siempre existe). */
  snapshot(mode: DelayMode = "tv", now = this.lastPacketAt): GameState {
    return this.lane(this.laneKey(mode), now).model.snapshot();
  }
}

/** Estado vacío: lo que ve un streamer que todavía no eligió servidor (o cuyo servidor se apagó). */
export const emptyState = (): GameState => new GameModel().snapshot();

/** Lee un modo de retraso de lo que manda /control; null si no es válido. */
export function parseDelayMode(v: unknown): DelayMode | null {
  if (v === "tv" || v === "live") return v;
  if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_DELAY) return v;
  return null;
}
