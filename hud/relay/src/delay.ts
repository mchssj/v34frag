// Cola de retraso: cada paquete se guarda con la hora en que llegó y recién se entrega cuando pasaron los
// segundos de tv_delay. Así el HUD va junto con la imagen de la SourceTV y el dato en vivo nunca sale del relay.

import type { Packet } from "./protocol.ts";

interface Queued {
  releaseAt: number;
  packet: Packet;
}

export class DelayQueue {
  private queue: Queued[] = [];
  private lastSeq = 0;

  /** Encola un paquete. Devuelve false si es viejo (llegó desordenado) y se descartó. */
  push(packet: Packet, now: number, delaySeconds: number): boolean {
    // La foto completa siempre entra: si el plugin se recargó, la secuencia vuelve a empezar desde 1.
    if (packet.type !== "F" && packet.seq <= this.lastSeq) return false;
    this.lastSeq = packet.seq;
    const releaseAt = now + Math.max(0, delaySeconds) * 1000;
    // Si el retraso bajó, un paquete nuevo no puede salir antes que uno anterior.
    const last = this.queue.at(-1);
    this.queue.push({ releaseAt: last && last.releaseAt > releaseAt ? last.releaseAt : releaseAt, packet });
    return true;
  }

  /** Saca los paquetes que ya cumplieron el retraso, en orden de llegada. */
  release(now: number): Packet[] {
    let n = 0;
    while (n < this.queue.length && this.queue[n]!.releaseAt <= now) n++;
    return n === 0 ? [] : this.queue.splice(0, n).map((q) => q.packet);
  }

  get size(): number {
    return this.queue.length;
  }
}
