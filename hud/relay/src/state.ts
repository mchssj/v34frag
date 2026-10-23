// Estado de la partida tal como lo ve el HUD: solo se le aplican los paquetes que ya cumplieron el retraso.

import type { NameLine, Packet, Phase, PlayerLine } from "./protocol.ts";

export interface Player extends PlayerLine {
  name: string;
  steamid: string;
}

export interface Kill {
  at: number;
  attacker: number;
  victim: number;
  weapon: string;
  headshot: boolean;
}

export interface GameState {
  map: string;
  round: number;
  scoreT: number;
  scoreCT: number;
  phase: Phase;
  phaseEndsAt: number | null; // ms (Date.now()) en que termina la fase; null = sin reloj
  players: Player[];
  kills: Kill[];
  lastEnd: { at: number; winner: number; reason: number } | null;
  bomb: { what: "plant" | "defuse" | "explode"; uid: number; at: number } | null;
  updatedAt: number;
}

const MAX_KILLS = 6;

export class GameModel {
  private players = new Map<number, PlayerLine>();
  private names = new Map<number, NameLine>();
  private state: Omit<GameState, "players"> = {
    map: "",
    round: 0,
    scoreT: 0,
    scoreCT: 0,
    phase: "live",
    phaseEndsAt: null,
    kills: [],
    lastEnd: null,
    bomb: null,
    updatedAt: 0,
  };

  apply(packet: Packet, now: number): void {
    this.state.updatedAt = now;
    switch (packet.type) {
      case "F":
        this.state.map = packet.map;
        this.state.round = packet.round;
        this.state.scoreT = packet.scoreT;
        this.state.scoreCT = packet.scoreCT;
        this.setPhase(packet.phase, packet.seconds, now);
        // La foto completa manda: el que no está, se fue.
        this.players = new Map(packet.players.map((p) => [p.uid, p]));
        break;
      case "N":
        this.names = new Map(packet.names.map((n) => [n.uid, n]));
        break;
      case "D":
        for (const p of packet.players) this.players.set(p.uid, p);
        break;
      case "E": {
        const e = packet.event;
        if (e.kind === "kill") {
          this.state.kills = [...this.state.kills, { at: now, ...stripKind(e) }].slice(-MAX_KILLS);
        } else if (e.kind === "phase") {
          this.setPhase(e.phase, e.seconds, now);
          if (e.phase === "freeze") {
            this.state.bomb = null;
            this.state.lastEnd = null;
          }
        } else if (e.kind === "bomb") {
          this.state.bomb = { what: e.what, uid: e.uid, at: now };
        } else {
          this.state.lastEnd = { at: now, winner: e.winner, reason: e.reason };
        }
        break;
      }
    }
  }

  private setPhase(phase: Phase, seconds: number, now: number): void {
    this.state.phase = phase;
    this.state.phaseEndsAt = seconds >= 0 ? now + seconds * 1000 : null;
  }

  snapshot(): GameState {
    const players: Player[] = [...this.players.values()].map((p) => {
      const n = this.names.get(p.uid);
      return { ...p, name: n?.name ?? `#${p.uid}`, steamid: n?.steamid ?? "" };
    });
    players.sort((a, b) => a.team - b.team || a.uid - b.uid);
    return { ...this.state, players };
  }
}

function stripKind<T extends { kind: string }>(e: T): Omit<T, "kind"> {
  const { kind: _kind, ...rest } = e;
  return rest;
}
