// Un canal por servidor de juego: su clave, su cola de retraso y su modelo de la partida. Así los paquetes de un
// servidor nunca descartan ni pisan los de otro (cada uno tiene su propia secuencia).

import { DelayQueue } from "./delay.ts";
import { parsePacket } from "./protocol.ts";
import { GameModel, type GameState } from "./state.ts";

export class Channel {
  key: string;
  private readonly fixedDelay: number | null;
  private readonly queue = new DelayQueue();
  private readonly model = new GameModel();
  private tvDelay = 0;
  lastPacketAt = 0;
  received = 0;
  receivedWindow = 0;
  badKey = 0;
  badFormat = 0;

  /** fixedDelay: segundos de retraso fijos, o null para usar el tv_delay que manda el servidor. */
  constructor(key: string, fixedDelay: number | null) {
    this.key = key;
    this.fixedDelay = fixedDelay;
  }

  delaySeconds(): number {
    return this.fixedDelay ?? this.tvDelay;
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
    if (packet.type === "F") this.tvDelay = packet.tvDelay;
    if (!this.queue.push(packet, now, this.delaySeconds())) return false;
    this.received++;
    this.receivedWindow++;
    this.lastPacketAt = now;
    return true;
  }

  /** Aplica los paquetes que ya cumplieron el retraso. Devuelve si cambió el estado. */
  release(now: number): boolean {
    const out = this.queue.release(now);
    for (const p of out) this.model.apply(p, now);
    return out.length > 0;
  }

  get queued(): number {
    return this.queue.size;
  }

  snapshot(): GameState {
    return this.model.snapshot();
  }
}

/** Estado vacío: lo que ve un streamer que todavía no eligió servidor (o cuyo servidor se apagó). */
export const emptyState = (): GameState => new GameModel().snapshot();
